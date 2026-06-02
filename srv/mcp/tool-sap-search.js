/**
 * Tool: sap_focused_sonar_search
 * Pesquisa focada em documentação SAP oficial via Perplexity Sonar.
 */
import { callGenAiHub } from '../clients/genaihub.js';
import { validateQuery, validateMaxSources } from '../utils/validators.js';
import { persistLog } from '../utils/persistence.js';
import { buildMetadata, buildError } from './tool-sonar-answer.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('tool:sap-search');
const TOOL_NAME = 'sap_focused_sonar_search';

const SAP_DOMAINS = [
  'sap.com',
  'help.sap.com',
  'community.sap.com',
  'developers.sap.com',
  'discovery-center.cloud.sap',
  'learning.sap.com',
  'cap.cloud.sap'
];

const SYSTEM_PROMPT = (
  'You are an SAP expert assistant. Answer only using official SAP documentation. ' +
  'Prioritize sources from: ' + SAP_DOMAINS.join(', ') + '. ' +
  'Cite the exact documentation page for every claim. ' +
  'Do not fabricate documentation links. ' +
  'If the answer is not found in official SAP docs, explicitly say so. ' +
  'For legal, financial, or security compliance topics, recommend consulting SAP support or certified partners.'
);

export async function toolSapFocusedSearch(args) {
  const startMs = Date.now();
  const correlationId = crypto.randomUUID();

  const queryError = validateQuery(args.query);
  if (queryError) {
    return buildError(TOOL_NAME, args.query, queryError, 'INVALID_INPUT', 0, correlationId);
  }

  const sourcesError = validateMaxSources(args.maxSources);
  if (sourcesError) {
    return buildError(TOOL_NAME, args.query, sourcesError, 'INVALID_INPUT', 0, correlationId);
  }

  const maxSources = args.maxSources || 8;
  const domainHint = `\nSearch exclusively or primarily within: ${SAP_DOMAINS.join(', ')}.`;

  try {
    const result = await callGenAiHub({
      systemPrompt: SYSTEM_PROMPT + domainHint,
      userPrompt: args.query,
      correlationId
    });
    const latencyMs = Date.now() - startMs;

    await persistLog({
      toolName: TOOL_NAME,
      query: args.query,
      searchMode: 'sap-focused',
      sourceCount: result.sources.length,
      status: 'success',
      latencyMs,
      correlationId
    });

    const sapSources = filterSapSources(result.sources, maxSources);
    const sapCitations = filterSapSources(result.citations, maxSources);

    const limitations = [];
    if (sapSources.length === 0) {
      limitations.push('No official SAP sources were found. Consider rephrasing or checking SAP Help Portal directly.');
    }
    if (result.sources.length > 0 && sapSources.length < result.sources.length) {
      limitations.push('Some non-SAP sources were filtered. Only official SAP sources are shown.');
    }

    return {
      status: 'success',
      tool: TOOL_NAME,
      query: args.query,
      answer: result.answer,
      citations: sapCitations,
      sources: sapSources,
      confidence: sapSources.length >= 2 ? 'high' : sapSources.length === 1 ? 'medium' : 'low',
      limitations,
      metadata: buildMetadata(latencyMs, correlationId)
    };
  } catch (err) {
    const latencyMs = Date.now() - startMs;
    log.error({ err: err.message, correlationId }, 'SAP search failed');

    await persistLog({
      toolName: TOOL_NAME,
      query: args.query,
      status: 'error',
      latencyMs,
      errorMessage: String(err.message || '').substring(0, 200),
      correlationId
    });

    return buildError(TOOL_NAME, args.query, 'The SAP-focused search could not be completed through SAP Generative AI Hub.', 'GENAIHUB_CALL_FAILED', latencyMs, correlationId);
  }
}

function filterSapSources(sources, max) {
  if (!Array.isArray(sources)) return [];
  return sources
    .filter(s => {
      if (!s || !s.url) return true;
      return SAP_DOMAINS.some(d => s.url.includes(d));
    })
    .slice(0, max);
}
