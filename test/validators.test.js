/**
 * Testes dos validadores de input
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { validateQuery, validateMaxSources } from '../srv/utils/validators.js';

describe('validateQuery', () => {
  it('rejects empty string', () => {
    assert.ok(validateQuery('') !== null);
  });

  it('rejects undefined', () => {
    assert.ok(validateQuery(undefined) !== null);
  });

  it('rejects null', () => {
    assert.ok(validateQuery(null) !== null);
  });

  it('rejects query over 2000 chars', () => {
    const longQuery = 'a'.repeat(2001);
    assert.ok(validateQuery(longQuery) !== null);
  });

  it('accepts valid query', () => {
    assert.equal(validateQuery('What is SAP CAP?'), null);
  });

  it('accepts query of exactly 2000 chars', () => {
    assert.equal(validateQuery('a'.repeat(2000)), null);
  });
});

describe('validateMaxSources', () => {
  it('accepts undefined (optional field)', () => {
    assert.equal(validateMaxSources(undefined), null);
  });

  it('accepts null (optional field)', () => {
    assert.equal(validateMaxSources(null), null);
  });

  it('rejects maxSources = 0', () => {
    assert.ok(validateMaxSources(0) !== null);
  });

  it('rejects maxSources = 21 (above limit)', () => {
    assert.ok(validateMaxSources(21) !== null);
  });

  it('accepts maxSources = 5', () => {
    assert.equal(validateMaxSources(5), null);
  });

  it('accepts maxSources = 20 (boundary)', () => {
    assert.equal(validateMaxSources(20), null);
  });

  it('accepts maxSources = 1 (boundary)', () => {
    assert.equal(validateMaxSources(1), null);
  });

  it('rejects non-integer', () => {
    assert.ok(validateMaxSources(3.5) !== null);
  });
});
