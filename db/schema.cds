using { cuid, managed } from '@sap/cds/common';

namespace joule.research;

/**
 * Log de pesquisas realizadas via MCP tools.
 * Protegido por ResearchAdmin - não armazena tokens ou dados sensíveis.
 */
entity ResearchLogs : cuid, managed {
  userId       : String(255);
  toolName     : String(100) not null;
  query        : String(2000) not null;
  searchMode   : String(50);
  sourceCount  : Integer default 0;
  status       : String(20) not null; // success | error
  latencyMs    : Integer;
  errorMessage : String(500);
  correlationId: String(100);
  resourceGroup: String(100) default 'default';
  modelName    : String(100);
}
