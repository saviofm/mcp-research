/**
 * Tool: research_with_guardrails
 * Pesquisa controlada com guardrails enterprise.
 */
import { callGenAiHub } from '../clients/genaihub.js';
import { validateQuery } from '../utils/validators.js';
import { persistLog } from '../utils/persistence.js';
import { buildMetadata, buildError } from './tool-sonar-answer.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('tool:guardrails');
const TOOL_NAME = 'research_with_guardrails';

const SENSITIVE_TOPICS_RE = /\b(personal\s+data|pii|ssn|social\s+security|passport|credit\s+card|bank\s+account|exploit|malware|ransomware|shell\s+code|sql\s+inject)\b/i;

const SYSTEM_PROMPT = (
  'You are a cautious enterprise research assistant. Rules:\n' +
  '1. Do not execute code, shell commands, or SQL.\n' +
  '2. Do not access local files or internal systems.\n' +
  '3. Do not collect, process, or return personal data (PII).\n' +
  '4. Do not reproduce copyrighted content in full.\n' +
  '5. Do not fabricate URLs, source titles, or citations.\n' +
  '6. For legal, medical, financial, or security topics: provide information but explicitly recommend expert validation.\n' +
  '7. For SAP topics: prioritize official SAP documentation.\n' +
  '8. Always return citations for factual claims.\n' +
  '9. If information is uncertain, say so clearly.\n' +
  '10. After your answer, suggest 2-3 follow-up questions the user might ask.'
);

export async function toolResearchWithGuardrails(args) {
  const startMs = Date.now();
  const correlationId = crypto.randomUUID();

  const queryError = validateQuery(args.query);
  if (queryError) {
    return buildError(TOOL_NAME, args.query, queryError, 'INVALID_INPUT', 0, correlationId);
  }

  if (SENSITIVE_TOPICS_RE.test(args.query)) {
    return buildError(
      TOOL_NAME,
      args.query,
      'This query contains restricted topics that cannot be processed by the enterprise research tool.',
      'GUARDRAIL_BLOCKED',
      Date.now() - startMs,
      correlationId
    );
  }

  const contextHint = args.context && typeof args.context === 'string' && args.context.trim()
    ? `\nAdditional context: ${args.context.trim().substring(0, 1000)}`
    : '';

  try {
    const result = await callGenAiHub({
      systemPrompt: SYSTEM_PROMPT + contextHint,
      userPrompt: args.query,
      correlationId
    });
    const latencyMs = Date.now() - startMs;

    const { answer, followUpQuestions } = parseAnswerAndFollowUps(result.answer);
    const limitations = buildGuardrailLimitations(args.query, result.sources.length);

    await persistLog({
      toolName: TOOL_NAME,
      query: args.query,
      searchMode: 'guardrails',
      sourceCount: result.sources.length,
      status: 'success',
      latencyMs,
      correlationId
    });

    return {
      status: 'success',
      tool: TOOL_NAME,
      query: args.query,
      answer,
      followUpQuestions,
      citations: result.citations,
      sources: result.sources,
      confidence: result.sources.length >= 2 ? 'high' : result.sources.length >= 1 ? 'medium' : 'low',
      limitations,
      metadata: buildMetadata(latencyMs, correlationId)
    };
  } catch (err) {
    const latencyMs = Date.now() - startMs;
    log.error({ err: err.message, correlationId }, 'Guardrails research failed');

    await persistLog({
      toolName: TOOL_NAME,
      query: args.query,
      status: 'error',
      latencyMs,
      errorMessage: String(err.message || '').substring(0, 200),
      correlationId
    });

    return buildError(TOOL_NAME, args.query, 'The research request could not be completed through SAP Generative AI Hub.', 'GENAIHUB_CALL_FAILED', latencyMs, correlationId);
  }
}

function parseAnswerAndFollowUps(rawAnswer) {
  if (!rawAnswer) return { answer: '', followUpQuestions: [] };

  const followUpMarkers = [
    /follow[\s-]?up questions?:?\s*\n([\s\S]+)$/i,
    /suggested questions?:?\s*\n([\s\S]+)$/i,
    /you might also ask:?\s*\n([\s\S]+)$/i
  ];

  for (const re of followUpMarkers) {
    const match = rawAnswer.match(re);
    if (match) {
      const answer = rawAnswer.substring(0, rawAnswer.search(re)).trim();
      const questions = match[1]
        .split('\n')
        .map(l => l.replace(/^[\d\.\-\*\s]+/, '').trim())
        .filter(l => l.length > 5)
        .slice(0, 3);
      return { answer, followUpQuestions: questions };
    }
  }

  return { answer: rawAnswer, followUpQuestions: [] };
}

function buildGuardrailLimitations(query, sourceCount) {
  const lims = [];
  if (sourceCount === 0) lims.push('No sources were returned. The answer may not be verifiable.');
  if (/\b(legal|law|regulation|compliance)\b/i.test(query)) {
    lims.push('Legal topics require validation by a qualified legal professional.');
  }
  if (/\b(medical|health|diagnos|treatment|drug)\b/i.test(query)) {
    lims.push('Medical topics require validation by a qualified healthcare professional.');
  }
  if (/\b(financial|invest|stock|trading|tax)\b/i.test(query)) {
    lims.push('Financial topics require validation by a qualified financial advisor.');
  }
  if (/\b(security|cve|vulnerability|attack|exploit)\b/i.test(query)) {
    lims.push('Security topics require validation by a certified security professional.');
  }
  return lims;
}
