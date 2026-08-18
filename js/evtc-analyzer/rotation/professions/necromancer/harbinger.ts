import type { EvtcRotationBuffTransition } from '../../profiles.js';

export const HARBINGER_BUFF_TRANSITIONS: readonly EvtcRotationBuffTransition[] = [
  {
    buffSkillId: 59964,
    gain: { name: 'Harbinger Shroud', skillId: 62567 },
    loss: { name: 'Exit Harbinger Shroud', skillId: 62540 },
    suppressWeaponSwap: true
  }
];
