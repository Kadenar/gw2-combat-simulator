import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  emitBuff,
  gainNecromancerLifeForce,
  hasTrait,
} from "../../core/shared.js";
import { harbingerResolverEventReactions } from "./resolver.js";
import {
  advanceHarbingerBlight,
  necromancerBlightSkillHandlers,
} from "./blight.js";
import { darkBarrage } from "./dark-barrage.js";
import {
  replaceSkillHandler,
  skillHandler,
  SKILL_HANDLER_MODES,
} from "../../../../platform/engine/skill-handlers.js";
import type { NecromancerCastContext, NecromancerSkill } from "../../types.js";

export const harbingerSkillHandlers = new Map([
  [
    "necromancer.elixir",
    replaceSkillHandler(necromancerBlightSkillHandlers["necromancer.elixir"]),
  ],
  [
    "necromancer.blight-skill",
    replaceSkillHandler(
      necromancerBlightSkillHandlers["necromancer.blight-skill"],
    ),
  ],
  [
    "necromancer.dark-barrage",
    skillHandler({
      mode: SKILL_HANDLER_MODES.AUGMENT,
      resolveMode: (context) =>
        hasTrait(context, TRAIT.DOOM_APPROACHES)
          ? SKILL_HANDLER_MODES.REPLACE
          : SKILL_HANDLER_MODES.AUGMENT,
      beforeEffects: darkBarrage,
    }),
  ],
]);

export const harbingerEventReactions = harbingerResolverEventReactions;

function afterCast(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): void {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  advanceHarbingerBlight(context, at);
  if (skill.id === ID.HARBINGER_SHROUD && state.activeShroud === "harbinger") {
    state.nextBlightAt = Math.floor(at) + 1;
    if (hasTrait(context, TRAIT.CORRUPTED_TALENT)) {
      gainNecromancerLifeForce(context, 15, at);
    }
    if (hasTrait(context, TRAIT.DEATHLY_HASTE)) {
      emitBuff(context, skill, "quickness", 4);
      emitBuff(context, skill, "fury", 4);
    }
    if (hasTrait(context, TRAIT.IMPLACABLE_FOE)) {
      emitBuff(context, skill, "stability", 5, 3);
      emitBuff(context, skill, "implacable-foe", 2);
    }
  }
  if (skill.id !== ID.DARK_BARRAGE || !hasTrait(context, TRAIT.DEATHLY_HASTE)) {
    return;
  }
  for (const kind of ["quickness", "fury"]) {
    context.emit({
      type: "buff",
      at,
      source: "Trait",
      sourceId: TRAIT.DEATHLY_HASTE,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      kind,
      duration: 4,
      stacks: 1,
    });
  }
}

export const harbingerSchedulerHooks = Object.freeze({
  advance: {
    id: "harbinger.advance-blight",
    order: -10,
    handler: advanceHarbingerBlight,
  },
  afterCast: {
    id: "harbinger.after-cast",
    order: -10,
    handler: afterCast,
  },
});
