/**
 * Validadores de input para as MCP tools.
 */

const MAX_QUERY_LENGTH = 2000;
const MIN_QUERY_LENGTH = 1;
const MAX_SOURCES_LIMIT = 20;
const MIN_SOURCES_LIMIT = 1;

export function validateQuery(query) {
  if (query === undefined || query === null || String(query).trim().length < MIN_QUERY_LENGTH) {
    return 'Query is required and cannot be empty.';
  }
  if (String(query).length > MAX_QUERY_LENGTH) {
    return `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters.`;
  }
  return null;
}

export function validateMaxSources(maxSources) {
  if (maxSources === undefined || maxSources === null) return null;
  const n = Number(maxSources);
  if (!Number.isInteger(n)) {
    return 'maxSources must be an integer.';
  }
  if (n < MIN_SOURCES_LIMIT || n > MAX_SOURCES_LIMIT) {
    return `maxSources must be between ${MIN_SOURCES_LIMIT} and ${MAX_SOURCES_LIMIT}.`;
  }
  return null;
}
