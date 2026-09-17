import { augmentSkillHandler, replaceSkillHandler } from '#gw2/platform/engine/skills/handlers.js';
import { necromancerBlightSkillHandlers } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/blight.js';
import { darkBarrage } from '#gw2/professions/necromancer/specializations/harbinger/execution/dark-barrage.js';
import { darkBarrageHandlerMode } from '#gw2/professions/necromancer/specializations/harbinger/traits/index.js';

/** Materializes Harbinger skills whose runtime state replaces declarative packets. */
export const harbingerSkillHandlers = new Map([
  ['necromancer.elixir', replaceSkillHandler(necromancerBlightSkillHandlers['necromancer.elixir'])],
  ['necromancer.blight-skill', replaceSkillHandler(necromancerBlightSkillHandlers['necromancer.blight-skill'])],
  [
    'necromancer.dark-barrage',
    augmentSkillHandler(darkBarrage, {
      resolveMode: darkBarrageHandlerMode
    })
  ]
]);
