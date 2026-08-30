import { necromancerShadeSkillHandlers } from '#gw2/content/professions/necromancer/specializations/scourge/mechanics/shades.js';
import { augmentSkillHandler, replaceSkillHandler } from '#gw2/platform/engine/skills/handlers.js';

/** Registers Scourge shade replacement and barrier augmentation handlers with the scheduler. */
export const scourgeSkillHandlers = new Map([
  [
    // Shade handler is a full replacement: Scourge never enters shroud, so the
    // base necromancer shroud logic must not run at all
    'necromancer.shade',
    replaceSkillHandler(necromancerShadeSkillHandlers['necromancer.shade'])
  ],
  [
    // Barrier skills keep their base handler; Scourge only appends trait procs
    // (Abrasive Grit might, Desert Empowerment alacrity) as afterEffects
    'necromancer.barrier',
    augmentSkillHandler(null, {
      afterEffects: necromancerShadeSkillHandlers['necromancer.barrier']
    })
  ]
]);
