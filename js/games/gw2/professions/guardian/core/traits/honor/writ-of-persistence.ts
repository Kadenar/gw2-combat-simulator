import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { extendPeriodicEffects } from '#gw2/platform/effects/periodic.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntime } from '#gw2/professions/guardian/types.js';

/** Writ adds one shared lifetime to skills authored as symbols; display text never grants it. */
function symbolExtension(runtime: MechanicQueriesOf<GuardianRuntime>, skill: Skill): number {
  return skill.tags?.includes('symbol') && hasTrait(runtime, TRAIT.WRIT_OF_PERSISTENCE)
    ? balanceNumberFromContext(runtime, TRAIT.WRIT_OF_PERSISTENCE, 'durationExtension')
    : 0;
}

/** A symbol's combo fields last longer by Writ's extension; cast and triggered symbols share this selection. */
export function writOfPersistenceFields(
  runtime: MechanicQueriesOf<GuardianRuntime>,
  skill: Skill,
  fields: Skill['comboFields']
): Skill['comboFields'] {
  const extension = symbolExtension(runtime, skill);
  return extension > 0 ? fields?.map((field) => ({ ...field, duration: Number(field.duration) + extension })) : fields;
}

/** A symbol's periodic effects keep pulsing on their own cadence through the extension; one-shot effects are unchanged. */
export function writOfPersistenceEffects(
  runtime: MechanicQueriesOf<GuardianRuntime>,
  skill: Skill,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  const extension = symbolExtension(runtime, skill);
  return extension > 0 ? extendPeriodicEffects(effects, Math.round(extension * 1000)) : effects;
}
