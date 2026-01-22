import Anthropic from '@anthropic-ai/sdk';

let client = null;

function getClient() {
  if (!client && process.env.ANTHROPIC_API_KEY) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY.trim()
    });
  }
  return client;
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check API key is configured
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY environment variable not configured in Vercel' });
  }

  const anthropic = getClient();
  if (!anthropic) {
    return res.status(500).json({ error: 'Failed to initialize Anthropic client' });
  }

  const { action, ...params } = req.body;

  try {
    // Health check - verify API key is configured (returns masked key)
    if (action === 'health') {
      const key = process.env.ANTHROPIC_API_KEY || '';
      const masked = key ? `${key.slice(0, 10)}...${key.slice(-4)}` : 'NOT SET';
      return res.json({ status: 'ok', apiKey: masked });
    }

    switch (action) {
      case 'detectStructure':
        return res.json(await detectCSVStructure(params.rawLines));

      case 'mergeHeaders':
        return res.json(await mergeMultiRowHeaders(params.headerRows));

      case 'generateSQL':
        return res.json(await generateSQL(params.question, params.schemaContext, params.previousError));

      case 'suggest':
        return res.json(await analyzeAndSuggest(params.schemaContext));

      case 'explain':
        return res.json(await explainResults(params.sql, params.results, params.question));

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('Claude API error:', error);

    // More detailed error info
    const errorDetails = {
      message: error.message || 'Unknown error',
      type: error.constructor?.name,
      status: error.status,
      code: error.code
    };

    // Check for specific error types
    if (error.status === 401) {
      return res.status(500).json({ error: 'Invalid Anthropic API key' });
    }
    if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again.' });
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(500).json({ error: 'Cannot connect to Anthropic API' });
    }

    return res.status(500).json({
      error: error.message || 'Claude API request failed',
      details: errorDetails
    });
  }
}

async function detectCSVStructure(rawLines) {
  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    system: `You are a JSON-only response bot. You NEVER include any text outside the JSON object. No explanations, no commentary, no markdown. Just a raw JSON object starting with { and ending with }.`,
    messages: [{
      role: 'user',
      content: `Analyze this CSV file structure.

Return this exact JSON structure:
{"headerRow": <number>, "dataStartRow": <number>, "skipRows": <number>, "hasMultiRowHeader": <boolean>, "multiRowHeaderEnd": <number or null>, "issues": "<string>"}

Where:
- headerRow: 1-indexed row where column headers start
- dataStartRow: 1-indexed row where actual data begins
- skipRows: rows to skip before headers (0 if headers on row 1)
- hasMultiRowHeader: true if headers span multiple rows
- multiRowHeaderEnd: if multi-row header, the last header row (1-indexed), else null
- issues: brief note about problems found, or "none"

Raw CSV lines:
${rawLines.map((l, i) => `${i + 1}: ${l}`).join('\n')}`
    }]
  });

  let text = response.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    text = jsonMatch[0];
  }
  return JSON.parse(text);
}

async function mergeMultiRowHeaders(headerRows) {
  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: `You are a JSON-only response bot. You NEVER include any text outside the JSON array. No explanations, no commentary, no markdown. Just a raw JSON array starting with [ and ending with ].`,
    messages: [{
      role: 'user',
      content: `These CSV rows form a multi-row header. Merge them into single column names.

Rules:
- Combine related cells vertically (e.g., "Sales" above "Q1" becomes "Sales Q1")
- Skip empty cells when merging
- Keep column order intact
- Return exactly as many column names as there are columns

Header rows:
${headerRows.map((r, i) => `Row ${i + 1}: ${r}`).join('\n')}

Return ONLY a JSON array like: ["Column 1", "Column 2", "Column 3"]`
    }]
  });

  let text = response.content[0].text.trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    text = jsonMatch[0];
  }
  return JSON.parse(text);
}

const SQL_SYSTEM_PROMPT = `You are a SQL query generator for DuckDB. Your job is to translate natural language questions into precise, efficient SQL queries.

RULES:
1. Return ONLY the SQL query - no explanations, no markdown, no backticks
2. Use DuckDB SQL syntax (similar to PostgreSQL with extensions)
3. CRITICAL: Use table names EXACTLY as provided in the schema - do NOT use aliases like "t" or "u" for single-table queries. Only use aliases when doing JOINs with multiple tables.
4. CRITICAL: Always wrap column names in double quotes, especially if they contain hyphens, spaces, or special characters. Example: "May-25", "Total Amount", "credit card"
5. For text matching, prefer ILIKE for case-insensitive searches
6. Use appropriate aggregations (SUM, AVG, COUNT, etc.) when the question implies summarization
7. Include ORDER BY when ranking or "top/bottom" is mentioned
8. Use LIMIT when the user asks for a specific number of results
9. For date operations, use DuckDB date functions (DATE_TRUNC, DATE_PART, etc.)
10. When columns look like months (Jan-25, Feb-25, etc.), they are likely numeric values that need UNPIVOT to analyze across time
11. Always reference the exact table name from the schema, never invent or abbreviate table names

DUCKDB-SPECIFIC FEATURES YOU CAN USE:
- UNPIVOT for converting columns to rows
- PIVOT for converting rows to columns
- LIST() aggregate for collecting values into arrays
- STRUCT for creating nested objects
- STRING_AGG() for concatenating strings
- jaro_winkler_similarity() for fuzzy matching
- QUALIFY for window function filtering
- COLUMNS(*) for dynamic column selection
- EXCLUDE/REPLACE in SELECT for column manipulation

COMMON PATTERNS:
- Fuzzy matching: SELECT * FROM a JOIN b ON jaro_winkler_similarity(a.name, b.name) > 0.85
- Unpivot: UNPIVOT table ON col1, col2, col3 INTO NAME column_name VALUE column_value
- Running totals: SUM(amount) OVER (ORDER BY date ROWS UNBOUNDED PRECEDING)
- Percentages: ROUND(100.0 * amount / SUM(amount) OVER (), 2) as pct`;

async function generateSQL(userQuestion, schemaContext, previousError = null) {
  let userPrompt = `${schemaContext}

USER QUESTION: ${userQuestion}

Generate the SQL query:`;

  if (previousError) {
    userPrompt = `${schemaContext}

USER QUESTION: ${userQuestion}

PREVIOUS ATTEMPT FAILED with error: ${previousError.message}
The failing SQL was: ${previousError.sql}

Please fix the SQL query. Common issues:
- Column names with hyphens/spaces need double quotes: "May-25"
- Don't use empty quotes ""
- Ensure all quotes are properly closed
- Use exact table names from the schema, NOT aliases like "t" or "u"
- If error says "table not found", check the schema for the correct table name

Generate the corrected SQL query:`;
  }

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SQL_SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: userPrompt }
    ]
  });

  const sql = response.content[0].text.trim();
  return sql
    .replace(/^```sql\n?/i, '')
    .replace(/^```\n?/, '')
    .replace(/\n?```$/g, '')
    .trim();
}

async function analyzeAndSuggest(schemaContext) {
  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: `You analyze data schemas and suggest useful queries. Be concise and practical.`,
    messages: [
      {
        role: 'user',
        content: `${schemaContext}\n\nBased on this data, suggest 5 useful questions a business user might ask. Return as a simple numbered list, one per line.`
      }
    ]
  });

  return response.content[0].text
    .split('\n')
    .filter(line => line.trim())
    .map(line => line.replace(/^\d+\.\s*/, '').trim());
}

async function explainResults(sql, results, userQuestion) {
  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `User asked: "${userQuestion}"

Query executed: ${sql}

Results (first 10 rows): ${JSON.stringify(results.slice(0, 10), (k, v) => typeof v === 'bigint' ? Number(v) : v, 2)}

Total rows: ${results.length}

Provide a 2-3 sentence summary of what these results show. Be specific with numbers.`
      }
    ]
  });

  return response.content[0].text;
}
