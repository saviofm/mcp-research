import cds from '@sap/cds';
import { registerMcpEndpoints } from './mcp/server.js';
import { createLogger } from './utils/logger.js';

const log = createLogger('bootstrap');

// CDS bootstrap hook - executado após o express app ser criado
cds.on('bootstrap', (app) => {
  log.info('Registering MCP endpoints on CAP application');
  registerMcpEndpoints(app);
});

cds.on('served', () => {
  log.info('CAP services ready');
});

export default cds.server;
