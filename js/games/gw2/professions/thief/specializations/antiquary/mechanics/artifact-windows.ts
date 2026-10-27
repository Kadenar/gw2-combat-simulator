import type { BalanceProfile } from '#gw2/platform/skills/types.js';

/** Artifact identity windows share one lifetime across skills; the mechanic retains its patch identity. */
export const ANTIQUARY_ARTIFACT_WINDOWS: BalanceProfile = Object.freeze({
  id: 'thief.antiquary.artifact-windows',
  name: 'Antiquary Artifact Windows',
  profileKind: 'mechanic',
  duration: 10,
  effects: []
});
