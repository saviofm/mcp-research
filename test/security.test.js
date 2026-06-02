/**
 * Testes de segurança do endpoint /mcp
 */
import { strict as assert } from 'node:assert';
import { describe, it, before, after } from 'node:test';

describe('MCP endpoint security', () => {
  let app, server, url;

  before(async () => {
    const express = (await import('express')).default;
    const { registerMcpEndpoints } = await import('../srv/mcp/server.js');

    process.env.MCP_REQUIRE_AUTH = 'true';
    process.env.GENAIHUB_MODEL_NAME = 'sonar';
    process.env.AICORE_RESOURCE_GROUP = 'default';

    app = express();
    app.use(express.json());
    registerMcpEndpoints(app);
    server = app.listen(0);
    const port = server.address().port;
    url = `http://127.0.0.1:${port}`;
  });

  after(() => {
    server?.close();
    process.env.MCP_REQUIRE_AUTH = 'false';
  });

  it('rejects request without token (401)', async () => {
    const res = await fetch(`${url}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    });
    assert.equal(res.status, 401);
  });

  it('response does not expose auth header in error body', async () => {
    const res = await fetch(`${url}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake-token-12345'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    });
    const text = await res.text();
    assert.ok(!text.includes('fake-token-12345'), 'Token must not appear in error response');
  });

  it('/health is accessible without token', async () => {
    const res = await fetch(`${url}/health`);
    assert.equal(res.status, 200);
  });
});

describe('MCP endpoint - auth disabled', () => {
  let app, server, url;

  before(async () => {
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

  it('accepts MCP tools/list without token when auth disabled', async () => {
    const res = await fetch(`${url}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    });
    // MCP Streamable HTTP retorna 200 com resultado ou 202 dependendo do transport
    assert.ok([200, 201, 202].includes(res.status), `Expected 200/201/202, got ${res.status}`);
  });
});
