/**
 * Handler para ResearchAdminService.
 * Implementa a função getStats().
 */
import cds from '@sap/cds';
import { createLogger } from './utils/logger.js';

const log = createLogger('admin-handler');

export default class ResearchAdminHandler extends cds.ApplicationService {

  async init() {
    const { ResearchLogs } = this.entities;

    this.on('getStats', async () => {
      try {
        const db = await cds.connect.to('db');
        const rows = await db.run(
          SELECT.from(ResearchLogs).columns(
            'COUNT(*) as total',
            "SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successCount",
            "SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errorCount",
            'AVG(latencyMs) as avgLatency'
          )
        );
        const row = rows[0] || {};
        return {
          totalRequests: row.total || 0,
          successCount: row.successCount || 0,
          errorCount: row.errorCount || 0,
          avgLatencyMs: Math.round(row.avgLatency || 0)
        };
      } catch (err) {
        log.error({ err: err.message }, 'Failed to compute stats');
        throw new cds.error('Failed to retrieve statistics', { status: 500 });
      }
    });

    return super.init();
  }
}
