import {
  augmentSkill,
  replaceSkill,
} from "../../../../platform/gw2/native-profession.js";
import { GUARDIAN_SKILL_IDS as ID } from "../../data/ids.js";
import { buildGuardianStrike, emitGuardianEvent } from "../../core/events.js";
import { guardianVirtueSkillHandlers } from "../../core/virtues.js";
import type { GuardianCastContext, GuardianSkill } from "../../types.js";
import { dragonhunterState } from "./state.js";
import {
  applySoaringDevastation,
  bigGameHunterTetherDuration,
} from "./traits.js";

function activePrimaryWeapon(context: GuardianCastContext): string {
  return String(
    context.state.activeWeaponSet === 2
      ? context.config.weaponSet2Primary || context.config.primaryWeapon || ""
      : context.config.primaryWeapon || "",
  );
}

function activateDragonhunterVirtue(
  context: GuardianCastContext,
  skill: GuardianSkill,
): boolean {
  guardianVirtueSkillHandlers["guardian.virtue"](context, skill);
  if (skill.id !== ID.WINGS_OF_RESOLVE) return false;
  applySoaringDevastation(context, skill, activePrimaryWeapon(context));
  return false;
}

function activateSpearOfJustice(
  context: GuardianCastContext,
  skill: GuardianSkill,
): boolean {
  guardianVirtueSkillHandlers["guardian.virtue"](context, skill);
  const at = context.effectiveEnd;
  const tetherDuration = bigGameHunterTetherDuration(context);
  const tetherUntil = at + tetherDuration;
  dragonhunterState.from(context).tetherUntil = tetherUntil;

  context.emit(
    buildGuardianStrike({
      at,
      sourceId: skill.id,
      skillId: skill.id,
      skillName: skill.name,
      name: skill.name,
      coefficient: 0.8,
      skillWeapon: activePrimaryWeapon(context),
    }),
  );
  emitGuardianEvent(context, skill, "guardian.dragonhunter-tethered", {
    at,
    tetherUntil,
  });
  for (let index = 0; index < tetherDuration; index += 1) {
    emitGuardianEvent(context, skill, "guardian.dragonhunter-justice-pulse", {
      at: at + index,
      applicationIndex: index + 1,
      totalApplications: tetherDuration,
    });
  }
  return true;
}

function activateHuntersVerdict(
  context: GuardianCastContext,
  skill: GuardianSkill,
): boolean {
  dragonhunterState.from(context).tetherUntil = context.effectiveEnd;
  emitGuardianEvent(context, skill, "guardian.dragonhunter-tether-broken");
  return false;
}

export const dragonhunterSkillHandlers = Object.freeze({
  "guardian.dragonhunter-justice": replaceSkill({
    beforeEffects: activateSpearOfJustice,
  }),
  "guardian.dragonhunter-virtue": augmentSkill({
    beforeEffects: activateDragonhunterVirtue,
  }),
  "guardian.hunters-verdict": augmentSkill({
    beforeEffects: activateHuntersVerdict,
  }),
});
