import { requireCanonicalSkillEffects } from '#gw2/platform/effects/validation.js';
import { requireEffect, requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerInstrument } from '#gw2/professions/mesmer/types.js';

/** Applies the selected Troubadour instrument skill to its runtime definition. */
export function mesmerSelectedInstrument(context: unknown, id: SkillId): MesmerInstrument {
  const profile = requireSkillFromContext(context, id) as MesmerSkill;
  const instrument = profile.instrument!;
  const strike = instrument.hasStrike ? requireEffect(profile, 'strike', 'Strike') : undefined;
  // Runtime instrument statuses derive from the canonical list without rebuilding its effects.
  const conditions = requireCanonicalSkillEffects(profile).filter((effect) => effect.type === 'condition');
  return {
    slot: instrument.slot,
    instrument: instrument.instrument,
    damageAtMs: instrument.damageAtMs,
    persistsAfterInterrupt: instrument.persistsAfterInterrupt,
    ...strike,
    conditions
  };
}
