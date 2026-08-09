import {
  augmentSkill,
  replaceSkill,
} from "../../../platform/gw2/native-profession.js";
import {
  handleVirtueActivation,
  handleVirtueRefresh,
  guardianVirtueSkillHandlers,
  reactToJusticeHit,
} from "./virtues.js";
import {
  reactToGuardianBuffTraits,
  reactToGuardianDamageTraits,
  handleRighteousInstinctsTick,
} from "./traits.js";
import { guardianWeaponSkillHandlers } from "./weapon-state.js";
import type { GuardianCastContext, GuardianSkill } from "../types.js";

function emitBlastFinisher(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  context.emit({
    type: "blast_combo",
    at: context.effectiveEnd,
    source: "guardian",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: `${skill.name} — Blast Finisher`,
  });
}

export const guardianCoreSkillHandlers = Object.freeze({
  "guardian.virtue": augmentSkill({
    beforeEffects: guardianVirtueSkillHandlers["guardian.virtue"],
  }),
  "guardian.renewed-focus": replaceSkill({
    beforeEffects: guardianVirtueSkillHandlers["guardian.renewed-focus"],
  }),
  "guardian.weapon-swap": replaceSkill({
    beforeEffects: guardianWeaponSkillHandlers["guardian.weapon-swap"],
  }),
  "guardian.blast-finisher": augmentSkill({
    beforeEffects: emitBlastFinisher,
  }),
});

export const guardianCoreEventHandlers = Object.freeze({
  "guardian.virtue-activated": handleVirtueActivation,
  "guardian.virtues-refreshed": handleVirtueRefresh,
  "guardian.righteous-instincts-tick": handleRighteousInstinctsTick,
});

export const guardianCoreEventReactions = Object.freeze({
  damage: Object.freeze([
    {
      id: "guardian.traits",
      order: 15,
      handler: reactToGuardianDamageTraits,
    },
    {
      id: "guardian.justice",
      order: 20,
      handler: reactToJusticeHit,
    },
  ]),
  buff: Object.freeze([
    {
      id: "guardian.traits",
      order: 10,
      handler: reactToGuardianBuffTraits,
    },
  ]),
});
