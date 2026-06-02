/**
 * Servidor MCP runtime - registra tools e expõe endpoints HTTP.
 *
 * Usa Streamable HTTP transport do MCP SDK 1.29+.
 * Cada requisição cria um transporte stateless (sem sessão persistente),
 * adequado para ambientes serverless / Cloud Foundry.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from '../utils/logger.js';
import { requireAuth } from '../security/auth.js';
import { buildToolRegistry } from './tools.js';

const log = createLogger('mcp-server');

/**
 * Cria uma instância nova do MCP Server com todas as tools registradas.
 * Chamado por requisição (stateless).
 */
function createMcpServer() {
  const mcpServer = new Server(
    { name: 'joule-mcp-research-server', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  const tools = buildToolRegistry();

  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.list()
  }));

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    log.info({ tool: name }, 'MCP tool call received');

    const handler = tools.get(name);
    if (!handler) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          status: 'error',
          error: { code: 'TOOL_NOT_FOUND', message: `Unknown tool: ${name}` }
        })}],
        isError: true
      };
    }

    try {
      const result = await handler(args || {}, extra);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        isError: result.status === 'error'
      };
    } catch (err) {
      log.error({ tool: name, err: err.message }, 'Tool execution failed');
      return {
        content: [{ type: 'text', text: JSON.stringify({
          status: 'error',
          tool: name,
          error: { code: 'INTERNAL_ERROR', message: 'The tool could not be executed.' },
          citations: [],
          sources: [],
          confidence: 'low',
          limitations: ['Internal server error.'],
          metadata: { provider: 'SAP Generative AI Hub' }
        })}],
        isError: true
      };
    }
  });

  return mcpServer;
}

/**
 * Registra os endpoints /mcp e /health no app Express do CAP.
 */
export function registerMcpEndpoints(app) {
  // Health check - público, não expõe credenciais
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'joule-mcp-research-server',
      timestamp: new Date().toISOString(),
      model: process.env.GENAIHUB_MODEL_NAME || 'sonar',
      resourceGroup: process.env.AICORE_RESOURCE_GROUP || 'default'
    });
  });

  // Endpoint MCP - protegido por XSUAA quando MCP_REQUIRE_AUTH=true
  app.post('/mcp', requireAuth, async (req, res) => {
    const correlationId = req.headers['x-correlation-id'] || req.headers['x-request-id'];
    if (correlationId) {
      log.info({ correlationId }, 'MCP request received');
    }

    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined  // stateless - sem sessão persistente
      });

      const mcpServer = createMcpServer();
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      log.error({ err: err.message }, 'MCP transport error');
      if (!res.headersSent) {
        res.status(500).json({
          error: 'MCP request could not be processed.'
        });
      }
    }
  });

  // OPTIONS para CORS preflight no /mcp
  app.options('/mcp', (_req, res) => {
    res.status(204).end();
  });

  log.info('MCP endpoints registered: POST /mcp, GET /health');
}
