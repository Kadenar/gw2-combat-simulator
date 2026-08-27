import { necromancerSpiritSkillHandlers } from './spirits.js';
import { necromancerWeaponSpellSkillHandlers } from './weapon-spells.js';
import { skillHandler, SKILL_HANDLER_MODES } from '../../../../../platform/engine/skills/handlers.js';
import type { SkillHandlerPhase } from '../../../../../platform/engine/types.js';
import type { NecromancerCastContext } from '../../types.js';

function declarativeReplacingHandler(beforeEffects: SkillHandlerPhase<NecromancerCastContext>) {
  return skillHandler<NecromancerCastContext>({
    mode: SKILL_HANDLER_MODES.AUGMENT,
    resolveMode: () => SKILL_HANDLER_MODES.REPLACE,
    beforeEffects
  });
}

export const ritualistSkillHandlers = new Map([
  ['necromancer.ritualist', declarativeReplacingHandler(necromancerSpiritSkillHandlers['necromancer.ritualist'])],
  ['necromancer.innervate', declarativeReplacingHandler(necromancerSpiritSkillHandlers['necromancer.innervate'])],
  [
    'necromancer.weapon-spell',
    declarativeReplacingHandler(necromancerWeaponSpellSkillHandlers['necromancer.weapon-spell'])
  ]
]);
