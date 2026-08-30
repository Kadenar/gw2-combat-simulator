import { necromancerBlightSkillHandlers } from '../mechanics/blight.js';
import { darkBarrage } from './dark-barrage.js';
import { darkBarrageHandlerMode } from '../traits/index.js';
import { skillHandler, SKILL_HANDLER_MODES } from '../../../../../../platform/engine/skills/handlers.js';

export const harbingerSkillHandlers = new Map([
  [
    // The declarations own the patchable values, while the handler materializes
    // them because empowerment and allied recipients are runtime-dependent.
    'necromancer.elixir',
    skillHandler({
      mode: SKILL_HANDLER_MODES.AUGMENT,
      resolveMode: () => SKILL_HANDLER_MODES.REPLACE,
      beforeEffects: necromancerBlightSkillHandlers['necromancer.elixir']
    })
  ],
  [
    'necromancer.blight-skill',
    skillHandler({
      mode: SKILL_HANDLER_MODES.AUGMENT,
      resolveMode: () => SKILL_HANDLER_MODES.REPLACE,
      beforeEffects: necromancerBlightSkillHandlers['necromancer.blight-skill']
    })
  ],
  [
    // AUGMENT by default so the base skill still fires; resolveMode switches to REPLACE when Doom Approaches is equipped,
    // because the trait replaces the attack entirely with the 8-hit barrage (darkBarrage returns true, suppressing the base hit).
    'necromancer.dark-barrage',
    skillHandler({
      mode: SKILL_HANDLER_MODES.AUGMENT,
      resolveMode: darkBarrageHandlerMode,
      beforeEffects: darkBarrage
    })
  ]
]);
