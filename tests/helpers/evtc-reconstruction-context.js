import { prepareEvtcEvidence } from '#gw2/integrations/logs/evtc/rotation/evidence.js';

/** Freeze the fixture snapshot so changing raw evidence requires building a fresh context. */
function freezeFixture(value) {
  if (value == null || typeof value !== 'object') return value;

  for (const child of Object.values(value)) freezeFixture(child);

  return Object.freeze(value);
}

/** Pair each test log with fresh evidence, including when deriving a case with different events or metadata. */
export function evtcReconstructionContext(context, logOverrides = {}) {
  const log = freezeFixture(structuredClone({ ...context.log, ...logOverrides }));
  return { ...context, log, evidence: prepareEvtcEvidence(log) };
}
