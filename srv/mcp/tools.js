/**
 * Registro de todas as MCP tools disponíveis.
 * Retorna um registro com list() e get(name).
 */
import { toolPerplexitySonarAnswer } from './tool-sonar-answer.js';
import { toolSapFocusedSearch } from './tool-sap-search.js';
import { toolResearchWithGuardrails } from './tool-guardrails.js';
import { toolGenAiHubHealthcheck } from './tool-healthcheck.js';

export function buildToolRegistry() {
  const registry = new Map([
    ['perplexity_sonar_answer',     toolPerplexitySonarAnswer],
    ['sap_focused_sonar_search',    toolSapFocusedSearch],
    ['research_with_guardrails',    toolResearchWithGuardrails],
    ['genaihub_model_healthcheck',  toolGenAiHubHealthcheck]
  ]);

  return {
    list: () => TOOL_DEFINITIONS,
    get:  (name) => registry.get(name)
  };
}

export const TOOL_DEFINITIONS = [
  {
    name: 'perplexity_sonar_answer',
    description: 'Generate a web-grounded answer using Perplexity Sonar through SAP Generative AI Hub / SAP AI Core. Use this when the agent needs a current, concise researched answer with citations and source transparency.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The research question or topic to investigate.',
          minLength: 1,
          maxLength: 2000
        },
        systemInstruction: {
          type: 'string',
          description: 'Optional system-level instruction to guide the response style.',
          maxLength: 500
        },
        recency: {
          type: 'string',
          enum: ['any', 'day', 'week', 'month'],
          description: 'Filter results by recency. Defaults to "any".'
        },
        domainFilter: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of domains to prioritize (e.g. ["sap.com"]).',
          maxItems: 10
        },
        maxSources: {
          type: 'integer',
          description: 'Maximum number of sources to return (1-20). Defaults to 5.',
          minimum: 1,
          maximum: 20
        }
      },
      required: ['query']
    }
  },
  {
    name: 'sap_focused_sonar_search',
    description: 'Use Perplexity Sonar through SAP Generative AI Hub / SAP AI Core to answer SAP-related questions, prioritizing SAP official documentation, SAP Help, SAP Community, SAP Learning, SAP Discovery Center and CAP documentation.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'SAP-related question or topic.',
          minLength: 1,
          maxLength: 2000
        },
        maxSources: {
          type: 'integer',
          description: 'Maximum number of sources to return (1-20). Defaults to 8.',
          minimum: 1,
          maximum: 20
        }
      },
      required: ['query']
    }
  },
  {
    name: 'research_with_guardrails',
    description: 'Perform a controlled research task using Perplexity Sonar through SAP Generative AI Hub / SAP AI Core. Return answer, citations, confidence, limitations and follow-up questions. Use this when the agent needs an enterprise-safe researched response.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The research question.',
          minLength: 1,
          maxLength: 2000
        },
        context: {
          type: 'string',
          description: 'Optional additional context to narrow the research scope.',
          maxLength: 1000
        }
      },
      required: ['query']
    }
  },
  {
    name: 'genaihub_model_healthcheck',
    description: 'Validate that the CAP MCP server can reach SAP AI Core / Generative AI Hub and that the configured Perplexity Sonar model is callable. Does not expose credentials or security details.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];
