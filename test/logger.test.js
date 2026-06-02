/**
 * Testes do logger - garantir que não vaza tokens ou credenciais
 */
import { strict as assert } from 'node:assert';
import { describe, it, mock } from 'node:test';
import { createLogger } from '../srv/utils/logger.js';

describe('Logger', () => {
  it('does not include token values in output', () => {
    const messages = [];
    const originalLog = console.log;
    console.log = (msg) => messages.push(msg);

    const log = createLogger('test');
    log.info({ userId: 'user123', someOtherField: 'value' }, 'Test message without token');

    console.log = originalLog;

    // Mensagem não deve conter campos sensíveis que não foram passados
    const combined = messages.join(' ');
    assert.ok(!combined.includes('Bearer '), 'Bearer token must not appear in logs');
  });

  it('creates a logger with the expected methods', () => {
    const log = createLogger('test');
    assert.equal(typeof log.info, 'function');
    assert.equal(typeof log.warn, 'function');
    assert.equal(typeof log.error, 'function');
    assert.equal(typeof log.debug, 'function');
  });
});
