/**
 * Client para SAP AI Core / Generative AI Hub - Perplexity Sonar.
 *
 * O deployment d42cc6a9f1d2b9fb é um Foundation Model deployment (Perplexity Sonar),
 * que expõe o endpoint /v1/chat/completions (compatível com OpenAI).
 *
 * Usamos @sap-ai-sdk/core (executeRequest + getAiCoreDestination) para chamar
 * diretamente o deployment, resolvendo credenciais automaticamente via:
 *   1. VCAP_SERVICES (Cloud Foundry) - binding automático
 *   2. .cdsrc-private.json (modo hybrid) via cds bind
 *
 * Nunca use PERPLEXITY_API_KEY nem chame api.perplexity.ai diretamente.
 */
import { createLogger } from '../utils/logger.js';

const log = createLogger('genaihub-client');

const ALLOWED_MODELS = (process.env.GENAIHUB_ALLOWED_MODELS || 'sonar,sonar-pro')
  .split(',').map(m => m.trim()).filter(Boolean);

function getModelName() {
  const name = process.env.GENAIHUB_MODEL_NAME || 'sonar';
  if (!ALLOWED_MODELS.includes(name)) {
    log.warn({ name, allowed: ALLOWED_MODELS }, 'Model not in allowlist, falling back');
    return ALLOWED_MODELS[0] || 'sonar';
  }
  return name;
}

function getResourceGroup() {
  return process.env.AICORE_RESOURCE_GROUP || 'default';
}

function getDeploymentId() {
  return process.env.GENAIHUB_DEPLOYMENT_ID;
}

/**
 * Chama o Perplexity Sonar via SAP AI Core Foundation Model deployment.
 * Endpoint: /inference/deployments/<id>/v1/chat/completions
 *
 * @param {object} params
 * @param {string} params.systemPrompt
 * @param {string} params.userPrompt
 * @param {string} params.correlationId
 * @returns {{ answer: string, citations: Array, sources: Array }}
 */
export async function callGenAiHub({ systemPrompt, userPrompt, correlationId }) {
  const modelName = getModelName();
  const resourceGroup = getResourceGroup();
  const deploymentId = getDeploymentId();

  if (!deploymentId) {
    throw new Error('GENAIHUB_DEPLOYMENT_ID is required. Set it in default-env.json or environment variables.');
  }

  log.debug({ modelName, deploymentId, resourceGroup, correlationId }, 'Calling SAP AI Core foundation model');

  // Dynamic imports - ambos os SDKs são ESM puros
  const { executeRequest, getAiCoreDestination } = await import('@sap-ai-sdk/core');

  const destination = await getAiCoreDestination();

  const requestBody = {
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt }
    ]
  };

  let httpResponse;
  try {
    httpResponse = await executeRequest(
      {
        url: `/inference/deployments/${deploymentId}/chat/completions`,
        resourceGroup
      },
      requestBody,
      {},
      destination
    );
  } catch (err) {
    const status = err.response?.status || err.cause?.response?.status;
    const body   = err.response?.data   || err.cause?.response?.data;
    log.error({
      correlationId, modelName, deploymentId, resourceGroup,
      status,
      apiError: JSON.stringify(body)?.substring(0, 300)
    }, 'AI Core request failed');
    throw new Error('SAP Generative AI Hub call failed. Check AI Core connectivity and model deployment.');
  }

  const data = httpResponse.data;

  // Resposta OpenAI-compatible: data.choices[0].message.content
  const rawAnswer = data?.choices?.[0]?.message?.content || '';

  // Perplexity Sonar retorna citations como array de URLs no campo data.citations
  const rawCitations = Array.isArray(data?.citations) ? data.citations : [];

  const citations = rawCitations.map((url, i) => ({
    refId: String(i + 1),
    title: extractDomain(url),
    url
  })).filter(c => c.url);

  const sources = rawCitations.map((url, i) => ({
    title: extractDomain(url),
    url,
    snippet: ''
  })).filter(s => s.url);

  // Fallback: extrair URLs mencionadas no texto
  const extractedSources = sources.length === 0
    ? extractUrlsFromText(rawAnswer)
    : sources;

  log.debug({
    correlationId,
    citationCount: citations.length,
    extractedCount: extractedSources.length
  }, 'AI Core response processed');

  return {
    answer: rawAnswer,
    citations: sources.length > 0 ? citations : [],
    sources: extractedSources
  };
}

function extractDomain(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return String(url).substring(0, 50);
  }
}

function extractUrlsFromText(text) {
  if (!text) return [];
  const urlRe = /https?:\/\/[^\s\])"',>]{10,}/g;
  const matches = text.match(urlRe) || [];
  return [...new Set(matches)].slice(0, 10).map(url => ({
    title: extractDomain(url),
    url,
    snippet: ''
  }));
}
