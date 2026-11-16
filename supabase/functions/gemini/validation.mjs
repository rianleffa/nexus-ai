/** Strict ISO calendar date validation shared by the Edge Function and Node tests. */
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isInvalidApiKey(status, providerStatus, providerMessage) {
  return (status === 400 || status === 401) && (
    providerStatus === 'API_KEY_INVALID' || /api\s*key\s*(?:is\s*)?not\s*valid|invalid\s+api\s*key/i.test(String(providerMessage || ''))
  );
}
