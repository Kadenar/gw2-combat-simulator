import { necromancerShadeSkillHandlers } from './shades.js';
import { augmentSkillHandler, replaceSkillHandler } from '../../../../../platform/engine/skills/handlers.js';

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
