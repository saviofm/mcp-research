/**
 * Tool: genaihub_model_healthcheck
 * Valida conectividade com SAP AI Core / Generative AI Hub.
 * Não expõe credenciais, tokens ou detalhes sensíveis.
 */
import { callGenAiHub } from '../clients/genaihub.js';
import { buildMetadata } from './tool-sonar-answer.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('tool:healthcheck');
const TOOL_NAME = 'genaihub_model_healthcheck';

export async function toolGenAiHubHealthcheck() {
  const startMs = Date.now();
  const correlationId = crypto.randomUUID();

  const modelName = process.env.GENAIHUB_MODEL_NAME || 'sonar';
  const resourceGroup = process.env.AICORE_RESOURCE_GROUP || 'default';
  const deploymentId = process.env.GENAIHUB_DEPLOYMENT_ID || null;

  try {
    const result = await callGenAiHub({
      systemPrompt: 'You are a health check assistant. Reply only with: "Health check OK".',
      userPrompt: 'Health check',
      correlationId
    });

    const latencyMs = Date.now() - startMs;
    const reachable = typeof result.answer === 'string' && result.answer.length > 0;

    log.info({ modelName, resourceGroup, deploymentId, latencyMs, reachable }, 'GenAI Hub healthcheck completed');

    return {
      status: 'success',
      tool: TOOL_NAME,
      reachable,
      modelConfigured: modelName,
      deploymentId: deploymentId || '(resolved by model name)',
      resourceGroup,
      message: reachable
        ? 'SAP Generative AI Hub is reachable and the model responded successfully.'
        : 'SAP Generative AI Hub returned an empty response.',
      metadata: buildMetadata(latencyMs, correlationId)
    };
  } catch (err) {
    const latencyMs = Date.now() - startMs;
    log.error({ err: err.message, modelName, resourceGroup }, 'GenAI Hub healthcheck failed');

    return {
      status: 'error',
      tool: TOOL_NAME,
      reachable: false,
      modelConfigured: modelName,
      deploymentId: deploymentId || '(resolved by model name)',
      resourceGroup,
      message: 'SAP Generative AI Hub could not be reached or the model is not available.',
      error: { code: 'GENAIHUB_UNREACHABLE', message: 'Connection to SAP AI Core / Generative AI Hub failed.' },
      metadata: buildMetadata(latencyMs, correlationId)
    };
  }
}
