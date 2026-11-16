import test from 'node:test';
import assert from 'node:assert/strict';
import { validDate } from './validation.mjs';

test('accepts valid ISO dates including leap days', () => {
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-11-16'), true);
});

test('rejects malformed and impossible dates', () => {
  for (const value of ['2025-02-29', '2026-13-01', '2026-04-31', '16/11/2026', '', null, 20261116]) {
    assert.equal(validDate(value), false, `expected ${String(value)} to be rejected`);
  }
});
