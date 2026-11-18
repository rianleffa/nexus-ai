// Only model generation is retried. No database mutations are replayed here.
const waitForRetry = (ms, signal) => new Promise((resolve, reject) => {
 signal.throwIfAborted();
 const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
 const timer = setTimeout(() => { signal.removeEventListener('abort',onAbort); resolve(); },ms);
 signal.addEventListener('abort',onAbort,{once:true});
});
export async function fetchWithRetry(url, options, {fetchImpl=fetch,wait=waitForRetry,attemptTimeoutMs=9000,onRetry=()=>{}}={}) {
 let timeoutRetries = 0;
 for (let attempt = 0; attempt < 3; attempt++) {
  options.signal.throwIfAborted();
  try {
   const signal = AbortSignal.any([options.signal, AbortSignal.timeout(attemptTimeoutMs)]);
   const response = await fetchImpl(url, { ...options, signal });
   if (![500, 502, 503, 504].includes(response.status) || attempt === 2) return response;
   await response.body?.cancel();
   onRetry({ attempt: attempt + 1, retry: attempt + 2, reason: `HTTP_${response.status}`, delayMs: 400 * (2 ** attempt) });
  } catch (error) {
   options.signal.throwIfAborted();
   if (error?.name === 'TimeoutError') {
    if (timeoutRetries >= 1) throw error;
    timeoutRetries += 1;
   } else if (!(error instanceof TypeError) || attempt === 2) {
    throw error;
   }
   onRetry({ attempt: attempt + 1, retry: attempt + 2, reason: error?.name === 'TimeoutError' ? 'ATTEMPT_TIMEOUT' : 'NETWORK_ERROR', delayMs: 400 * (2 ** attempt) });
  }
  await wait(400 * (2 ** attempt), options.signal);
 }
 throw new Error('Não foi possível concluir a chamada ao Gemini.');
}