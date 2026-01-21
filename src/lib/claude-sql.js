const API_URL = '/api/claude';

async function callClaudeAPI(action, params) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...params }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `API request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Detect CSV structure (header row, skip rows, issues)
 */
export async function detectCSVStructure(rawLines) {
  return callClaudeAPI('detectStructure', { rawLines });
}

/**
 * Merge multi-row headers into single header row
 */
export async function mergeMultiRowHeaders(headerRows) {
  return callClaudeAPI('mergeHeaders', { headerRows });
}

/**
 * Generate SQL from natural language question
 */
export async function generateSQL(userQuestion, schemaContext, previousError = null) {
  return callClaudeAPI('generateSQL', { question: userQuestion, schemaContext, previousError });
}

/**
 * Analyze schema and suggest useful questions
 */
export async function analyzeAndSuggest(schemaContext) {
  return callClaudeAPI('suggest', { schemaContext });
}

/**
 * Explain query results in plain language
 */
export async function explainResults(sql, results, userQuestion) {
  return callClaudeAPI('explain', { sql, results, question: userQuestion });
}
