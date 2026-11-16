import test from 'node:test';
import assert from 'node:assert/strict';
import { isInvalidApiKey, validDate } from './validation.mjs';

test('accepts valid ISO dates including leap days', () => {
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-11-16'), true);
});

test('recognizes invalid API keys from Gemini error status or message', () => {
  assert.equal(isInvalidApiKey(400, 'API_KEY_INVALID', ''), true);
  assert.equal(isInvalidApiKey(400, 'INVALID_ARGUMENT', 'API key not valid. Please pass a valid API key.'), true);
  assert.equal(isInvalidApiKey(403, 'PERMISSION_DENIED', 'API key not valid.'), false);
  assert.equal(isInvalidApiKey(400, 'INVALID_ARGUMENT', 'Invalid date.'), false);
});

test('rejects malformed and impossible dates', () => {
  for (const value of ['2025-02-29', '2026-13-01', '2026-04-31', '16/11/2026', '', null, 20261116]) {
    assert.equal(validDate(value), false, `expected ${String(value)} to be rejected`);
  }
});
