/**
 * Persistência de logs de pesquisa no banco de dados CAP.
 * Usa SQLite em desenvolvimento e HANA em produção (transparente via CAP).
 * Falhas de persistência são logadas mas não propagadas para não impactar a tool.
 */
import cds from '@sap/cds';
import { createLogger } from './logger.js';

const log = createLogger('persistence');

export async function persistLog(entry) {
  try {
    const db = await cds.connect.to('db');
    const { ResearchLogs } = cds.entities('joule.research');

    await db.run(
      INSERT.into(ResearchLogs).entries({
        toolName:      entry.toolName,
        query:         String(entry.query || '').substring(0, 2000),
        searchMode:    entry.searchMode || null,
        sourceCount:   entry.sourceCount || 0,
        status:        entry.status,
        latencyMs:     entry.latencyMs || 0,
        errorMessage:  entry.errorMessage ? String(entry.errorMessage).substring(0, 500) : null,
        correlationId: entry.correlationId || null,
        resourceGroup: process.env.AICORE_RESOURCE_GROUP || 'default',
        modelName:     process.env.GENAIHUB_MODEL_NAME || 'sonar'
      })
    );
  } catch (err) {
    // Falha de log não deve impactar a resposta da tool
    log.warn({ err: err.message }, 'Could not persist research log');
  }
}
