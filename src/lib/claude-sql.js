import Anthropic from '@anthropic-ai/sdk';

/**
 * Detect CSV structure (header row, skip rows, issues)
 */
export async function detectCSVStructure(rawLines, apiKey) {
  const client = new Anthropic({ 
    apiKey,
    dangerouslyAllowBrowser: true 
  });

  const response = await client.messages.create({
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
  
  // Extract JSON if wrapped in anything
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    text = jsonMatch[0];
  }
  
  return JSON.parse(text);
}

/**
 * Merge multi-row headers into single header row
 */
export async function mergeMultiRowHeaders(headerRows, apiKey) {
  const client = new Anthropic({ 
    apiKey,
    dangerouslyAllowBrowser: true 
  });

  const response = await client.messages.create({
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
  
  // Extract JSON array if wrapped in anything
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    text = jsonMatch[0];
  }
  
  return JSON.parse(text);
}

const SYSTEM_PROMPT = `You are a SQL query generator for DuckDB. Your job is to translate natural language questions into precise, efficient SQL queries.

RULES:
1. Return ONLY the SQL query - no explanations, no markdown, no backticks
2. Use DuckDB SQL syntax (similar to PostgreSQL with extensions)
3. Always use table names exactly as provided in the schema
4. CRITICAL: Always wrap column names in double quotes, especially if they contain hyphens, spaces, or special characters. Example: "May-25", "Total Amount", "credit card"
5. For text matching, prefer ILIKE for case-insensitive searches
6. Use appropriate aggregations (SUM, AVG, COUNT, etc.) when the question implies summarization
7. Include ORDER BY when ranking or "top/bottom" is mentioned
8. Use LIMIT when the user asks for a specific number of results
9. For date operations, use DuckDB date functions (DATE_TRUNC, DATE_PART, etc.)
10. When columns look like months (Jan-25, Feb-25, etc.), they are likely numeric values that need UNPIVOT to analyze across time

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

export async function generateSQL(userQuestion, schemaContext, apiKey, previousError = null) {
  const client = new Anthropic({ 
    apiKey,
    dangerouslyAllowBrowser: true 
  });

  let userPrompt = `${schemaContext}

USER QUESTION: ${userQuestion}

Generate the SQL query:`;

  // If there was a previous error, include it for self-correction
  if (previousError) {
    userPrompt = `${schemaContext}

USER QUESTION: ${userQuestion}

PREVIOUS ATTEMPT FAILED with error: ${previousError.message}
The failing SQL was: ${previousError.sql}

Please fix the SQL query. Common issues:
- Column names with hyphens/spaces need double quotes: "May-25"
- Don't use empty quotes ""
- Ensure all quotes are properly closed

Generate the corrected SQL query:`;
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: userPrompt }
    ]
  });

  const sql = response.content[0].text.trim();
  
  // Clean up any accidental markdown
  return sql
    .replace(/^```sql\n?/i, '')
    .replace(/^```\n?/, '')
    .replace(/\n?```$/g, '')
    .trim();
}

export async function analyzeAndSuggest(schemaContext, apiKey) {
  const client = new Anthropic({ 
    apiKey,
    dangerouslyAllowBrowser: true 
  });

  const response = await client.messages.create({
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

export async function explainResults(sql, results, userQuestion, apiKey) {
  const client = new Anthropic({ 
    apiKey,
    dangerouslyAllowBrowser: true 
  });

  const response = await client.messages.create({
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
