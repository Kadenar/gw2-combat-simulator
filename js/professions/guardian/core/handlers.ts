import {
  augmentSkill,
  replaceSkill,
} from "../../../platform/gw2/native-profession.js";
import { guardianVirtueSkillHandlers } from "./virtues.js";
import { guardianWeaponSkillHandlers } from "./weapon-state.js";
import type { GuardianCastContext, GuardianSkill } from "../types.js";

function emitBlastFinisher(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  context.emit({
    type: "proc",
    at: context.effectiveEnd,
    source: "guardian",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: `${skill.name} — Blast Finisher`,
    finisherType: "Blast",
    finisherValue: 1,
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
