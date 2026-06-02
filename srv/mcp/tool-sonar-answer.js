/**
 * Tool: perplexity_sonar_answer
 * Pesquisa web genérica via Perplexity Sonar / SAP Generative AI Hub.
 */
import { callGenAiHub } from '../clients/genaihub.js';
import { validateQuery, validateMaxSources } from '../utils/validators.js';
import { persistLog } from '../utils/persistence.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('tool:sonar-answer');
const TOOL_NAME = 'perplexity_sonar_answer';

export async function toolPerplexitySonarAnswer(args) {
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

  const maxSources = args.maxSources || 5;
  const recency = args.recency || 'any';

  let domainHint = '';
  if (Array.isArray(args.domainFilter) && args.domainFilter.length > 0) {
    const safe = args.domainFilter.filter(d => typeof d === 'string' && d.length < 100);
    if (safe.length > 0) {
      domainHint = `\nPrefer sources from: ${safe.join(', ')}.`;
    }
  }

  const recencyHint = recency !== 'any'
    ? `\nFocus on information from the last ${recency === 'day' ? '24 hours' : recency}.`
    : '';

  const systemPrompt = buildSystemPrompt(args.systemInstruction) + domainHint + recencyHint;
  const userPrompt = args.query;

  try {
    const result = await callGenAiHub({ systemPrompt, userPrompt, correlationId });
    const latencyMs = Date.now() - startMs;

    await persistLog({
      toolName: TOOL_NAME,
      query: args.query,
      searchMode: `recency:${recency}`,
      sourceCount: result.sources.length,
      status: 'success',
      latencyMs,
      correlationId
    });

    return {
      status: 'success',
      tool: TOOL_NAME,
      query: args.query,
      answer: result.answer,
      citations: result.citations.slice(0, maxSources),
      sources: result.sources.slice(0, maxSources),
      confidence: deriveConfidence(result.sources.length),
      limitations: buildLimitations(args.query, result.sources.length),
      metadata: buildMetadata(latencyMs, correlationId)
    };
  } catch (err) {
    const latencyMs = Date.now() - startMs;
    log.error({ err: err.message, correlationId }, 'GenAI Hub call failed');

    await persistLog({
      toolName: TOOL_NAME,
      query: args.query,
      status: 'error',
      latencyMs,
      errorMessage: sanitizeError(err),
      correlationId
    });

    return buildError(TOOL_NAME, args.query, 'The research request could not be completed through SAP Generative AI Hub.', 'GENAIHUB_CALL_FAILED', latencyMs, correlationId);
  }
}

function buildSystemPrompt(custom) {
  if (custom && typeof custom === 'string' && custom.trim().length > 0) {
    return custom.trim().substring(0, 500);
  }
  return (
    'You are a research assistant that provides accurate, well-sourced answers. ' +
    'Always cite your sources. Do not fabricate URLs or source titles. ' +
    'For legal, medical, financial, or security topics, explicitly note that expert validation is required. ' +
    'Never return complete copyrighted content. Never return API keys, tokens, or credentials.'
  );
}

function deriveConfidence(sourceCount) {
  if (sourceCount >= 3) return 'high';
  if (sourceCount >= 1) return 'medium';
  return 'low';
}

function buildLimitations(query, sourceCount) {
  const lims = [];
  if (sourceCount === 0) {
    lims.push('No sources were returned by the model for this query.');
  }
  if (/\b(law|legal|regulation|compliance|medical|health|diagnos|financial|invest|security|vulnerabilit)\b/i.test(query)) {
    lims.push('This topic may require validation by a qualified professional.');
  }
  return lims;
}

function sanitizeError(err) {
  const msg = String(err.message || '').replace(/token|secret|key|password|credential/gi, '[REDACTED]');
  return msg.substring(0, 200);
}

export function buildMetadata(latencyMs, correlationId) {
  return {
    provider: 'SAP Generative AI Hub',
    underlyingModel: 'Perplexity Sonar',
    model: process.env.GENAIHUB_MODEL_NAME || 'sonar',
    resourceGroup: process.env.AICORE_RESOURCE_GROUP || 'default',
    latencyMs,
    correlationId
  };
}

export function buildError(toolName, query, message, code, latencyMs, correlationId) {
  return {
    status: 'error',
    tool: toolName,
    query: query ? String(query).substring(0, 200) : undefined,
    error: { code, message },
    citations: [],
    sources: [],
    confidence: 'low',
    limitations: ['No reliable answer could be generated because: ' + message],
    metadata: {
      provider: 'SAP Generative AI Hub',
      underlyingModel: 'Perplexity Sonar',
      model: process.env.GENAIHUB_MODEL_NAME || 'sonar',
      resourceGroup: process.env.AICORE_RESOURCE_GROUP || 'default',
      latencyMs,
      correlationId
    }
  };
}
