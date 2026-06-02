/**
 * Testes das MCP tools - sem chamada real ao AI Core (mock do client)
 */
import { strict as assert } from 'node:assert';
import { describe, it, mock, beforeEach } from 'node:test';

// Mock do client genaihub antes de importar as tools
const mockCallGenAiHub = mock.fn();

// Simula resposta bem sucedida do GenAI Hub
const MOCK_SUCCESS = {
  answer: 'SAP CAP is the Cloud Application Programming Model.',
  citations: [
    { refId: '1', title: 'SAP CAP Documentation', url: 'https://cap.cloud.sap/docs' }
  ],
  sources: [
    { title: 'SAP CAP Documentation', url: 'https://cap.cloud.sap/docs', snippet: 'CAP overview' }
  ]
};

describe('tool-sonar-answer (unit, mocked GenAI Hub)', () => {
  it('validates empty query', async () => {
    const { toolPerplexitySonarAnswer } = await import('../srv/mcp/tool-sonar-answer.js');
    const result = await toolPerplexitySonarAnswer({ query: '' });
    assert.equal(result.status, 'error');
    assert.equal(result.error.code, 'INVALID_INPUT');
  });

  it('validates missing query', async () => {
    const { toolPerplexitySonarAnswer } = await import('../srv/mcp/tool-sonar-answer.js');
    const result = await toolPerplexitySonarAnswer({});
    assert.equal(result.status, 'error');
    assert.equal(result.error.code, 'INVALID_INPUT');
  });

  it('validates query too long', async () => {
    const { toolPerplexitySonarAnswer } = await import('../srv/mcp/tool-sonar-answer.js');
    const result = await toolPerplexitySonarAnswer({ query: 'x'.repeat(2001) });
    assert.equal(result.status, 'error');
    assert.ok(result.error.message.includes('2000'));
  });

  it('validates maxSources above limit', async () => {
    const { toolPerplexitySonarAnswer } = await import('../srv/mcp/tool-sonar-answer.js');
    const result = await toolPerplexitySonarAnswer({ query: 'test', maxSources: 99 });
    assert.equal(result.status, 'error');
    assert.equal(result.error.code, 'INVALID_INPUT');
  });
});

describe('tool-guardrails (unit)', () => {
  it('blocks sensitive PII query', async () => {
    const { toolResearchWithGuardrails } = await import('../srv/mcp/tool-guardrails.js');
    const result = await toolResearchWithGuardrails({ query: 'How to collect social security personal data' });
    assert.equal(result.status, 'error');
    assert.equal(result.error.code, 'GUARDRAIL_BLOCKED');
  });

  it('validates empty query', async () => {
    const { toolResearchWithGuardrails } = await import('../srv/mcp/tool-guardrails.js');
    const result = await toolResearchWithGuardrails({ query: '' });
    assert.equal(result.status, 'error');
    assert.equal(result.error.code, 'INVALID_INPUT');
  });
});

describe('error response structure', () => {
  it('error response has no stack trace in message field', async () => {
    const { buildError } = await import('../srv/mcp/tool-sonar-answer.js');
    const err = buildError('test_tool', 'query', 'Something failed', 'ERR', 100, 'corr-1');
    assert.equal(err.status, 'error');
    assert.ok(!JSON.stringify(err).includes('at Object.'), 'Stack trace must not appear in error response');
  });

  it('error response has required fields', async () => {
    const { buildError } = await import('../srv/mcp/tool-sonar-answer.js');
    const err = buildError('test_tool', 'query', 'Failed', 'ERR', 100, 'corr-1');
    assert.ok(Array.isArray(err.citations));
    assert.ok(Array.isArray(err.sources));
    assert.equal(err.confidence, 'low');
    assert.ok(Array.isArray(err.limitations));
    assert.ok(err.metadata);
    assert.ok(!err.metadata.token, 'token must not be in metadata');
    assert.ok(!err.metadata.clientSecret, 'clientSecret must not be in metadata');
  });
});

describe('tool registry', () => {
  it('contains all 4 expected tools', async () => {
    const { buildToolRegistry } = await import('../srv/mcp/tools.js');
    const registry = buildToolRegistry();
    const tools = registry.list();
    const names = tools.map(t => t.name);
    assert.ok(names.includes('perplexity_sonar_answer'));
    assert.ok(names.includes('sap_focused_sonar_search'));
    assert.ok(names.includes('research_with_guardrails'));
    assert.ok(names.includes('genaihub_model_healthcheck'));
  });

  it('get() returns handler for known tool', async () => {
    const { buildToolRegistry } = await import('../srv/mcp/tools.js');
    const registry = buildToolRegistry();
    const handler = registry.get('perplexity_sonar_answer');
    assert.equal(typeof handler, 'function');
  });

  it('get() returns undefined for unknown tool', async () => {
    const { buildToolRegistry } = await import('../srv/mcp/tools.js');
    const registry = buildToolRegistry();
    const handler = registry.get('nonexistent_tool');
    assert.equal(handler, undefined);
  });
});

describe('no PERPLEXITY_API_KEY', () => {
  it('environment has no PERPLEXITY_API_KEY', () => {
    assert.equal(process.env.PERPLEXITY_API_KEY, undefined,
      'PERPLEXITY_API_KEY must not be set - use SAP Generative AI Hub instead');
  });
});
