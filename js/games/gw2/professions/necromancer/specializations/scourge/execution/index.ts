import { augmentSkillHandler, replaceSkillHandler } from '#gw2/platform/engine/skills/handlers.js';
import { necromancerShadeSkillHandlers } from '#gw2/professions/necromancer/specializations/scourge/mechanics/shades.js';

/** Replaces shroud with shades while appending trait procs to barrier skills. */
export const scourgeSkillHandlers = new Map([
  ['necromancer.shade', replaceSkillHandler(necromancerShadeSkillHandlers['necromancer.shade'])],
  [
    'necromancer.barrier',
    augmentSkillHandler(null, {
      afterEffects: necromancerShadeSkillHandlers['necromancer.barrier']
    })
  ]
]);
