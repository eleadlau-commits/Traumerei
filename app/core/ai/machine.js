// The machine tier (app/core/AI.md, Machine tier): how much AI this computer can carry, so a
// provider that needs more is passed over and the default system picks its size. Three tiers,
// lowest first: every-pc (no usable GPU: a small CPU embedder and keyword labels), mid (enough
// cores and memory for a 1 to 1.5 B labeller in the background), gpu (a real GPU: everything).
// Pure: what it reads of the browser comes in as `nav`, so the tests run it as it is.

import { MACHINES } from './tasks.js';

// nav: { hardwareConcurrency?, deviceMemory?, gpu? } (navigator). Resolves with a frozen
// { tier, cores, memory (GB, as the browser rounds it; null when it won't say), gpu (true when a
// non-fallback WebGPU adapter answered) }.
export async function detect(nav = globalThis.navigator || {}) {
  const cores = Number(nav.hardwareConcurrency) || 1;
  const memory = Number(nav.deviceMemory) || null;
  let gpu = false;
  try {
    const adapter = nav.gpu ? await Promise.race([nav.gpu.requestAdapter(), new Promise((r) => setTimeout(() => r(null), 1500))]) : null;
    gpu = !!adapter && !adapter.isFallbackAdapter && !adapter.info?.isFallbackAdapter;
  } catch { gpu = false; }
  const enough = cores >= 4 && (memory == null || memory >= 8);
  const tier = gpu && enough ? 'gpu' : enough ? 'mid' : 'every-pc';
  return Object.freeze({ tier, cores, memory, gpu });
}

// True when a provider that needs `need` (a tier, or nothing) can run on a machine of tier `have`.
export const fits = (need, have) => !need || !MACHINES.includes(need) || MACHINES.indexOf(need) <= MACHINES.indexOf(have);
