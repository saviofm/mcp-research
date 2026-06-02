using { joule.research as research } from '../db/schema';

/**
 * Serviço administrativo para acesso aos logs de pesquisa.
 * Requer scope ResearchAdmin.
 */
@requires: 'ResearchAdmin'
service ResearchAdminService @(path: '/admin') {

  @readonly
  entity ResearchLogs as projection on research.ResearchLogs
    excluding { createdBy, modifiedBy };

  function getStats() returns {
    totalRequests: Integer;
    successCount : Integer;
    errorCount   : Integer;
    avgLatencyMs : Integer;
  };
}
