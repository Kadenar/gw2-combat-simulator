import { necromancerSpiritSkillHandlers } from '#gw2/content/professions/necromancer/specializations/ritualist/mechanics/spirits.js';
import { necromancerWeaponSpellSkillHandlers } from '#gw2/content/professions/necromancer/specializations/ritualist/skills/weapon-spells.js';
import { skillHandler, SKILL_HANDLER_MODES } from '#gw2/platform/engine/skills/handlers.js';
import type { SkillHandlerPhase } from '#gw2/platform/engine/types.js';
import type { NecromancerCastContext } from '#gw2/content/professions/necromancer/types.js';

// Run specialization effects before replacing the corresponding declarative skill effects.
function declarativeReplacingHandler(beforeEffects: SkillHandlerPhase<NecromancerCastContext>) {
  return skillHandler<NecromancerCastContext>({
    mode: SKILL_HANDLER_MODES.AUGMENT,
    resolveMode: () => SKILL_HANDLER_MODES.REPLACE,
    beforeEffects
  });
}

/** Registers Ritualist spirit and weapon-spell activations with the scheduler. */
export const ritualistSkillHandlers = new Map([
  ['necromancer.ritualist', declarativeReplacingHandler(necromancerSpiritSkillHandlers['necromancer.ritualist'])],
  ['necromancer.innervate', declarativeReplacingHandler(necromancerSpiritSkillHandlers['necromancer.innervate'])],
  [
    'necromancer.weapon-spell',
    declarativeReplacingHandler(necromancerWeaponSpellSkillHandlers['necromancer.weapon-spell'])
  ]
]);
