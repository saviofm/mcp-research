/**
 * Testes do endpoint /health
 */
import { strict as assert } from 'node:assert';
import { describe, it, before, after } from 'node:test';

// Stub mínimo para testar o endpoint health sem iniciar o CAP completo
describe('GET /health', () => {
  let app, server, url;

  before(async () => {
    // Importa express diretamente e registra apenas /health
    const express = (await import('express')).default;
    const { registerMcpEndpoints } = await import('../srv/mcp/server.js');

    process.env.MCP_REQUIRE_AUTH = 'false';
    process.env.GENAIHUB_MODEL_NAME = 'sonar';
    process.env.AICORE_RESOURCE_GROUP = 'default';

    app = express();
    app.use(express.json());
    registerMcpEndpoints(app);
    server = app.listen(0);
    const port = server.address().port;
    url = `http://127.0.0.1:${port}`;
  });

  after(() => server?.close());

  it('returns 200 with status ok', async () => {
    const res = await fetch(`${url}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
  });

  it('includes model and resourceGroup without credentials', async () => {
    const res = await fetch(`${url}/health`);
    const body = await res.json();
    assert.ok(body.model, 'model should be present');
    assert.ok(body.resourceGroup, 'resourceGroup should be present');
    assert.ok(!body.token, 'token must not be present');
    assert.ok(!body.clientSecret, 'clientSecret must not be present');
    assert.ok(!body.serviceKey, 'serviceKey must not be present');
  });
});
