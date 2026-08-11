import { professionCoreState } from "../../../../platform/engine/profession.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import {
  RANGER_SKILL_IDS as ID,
  RANGER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { applyRangerWeaponSwapTraits } from "../../core/traits.js";
import { galeshotState } from "./state.js";
import type { RangerCastContext, RangerSkill } from "../../types.js";

function emitGaleshotState(
  context: RangerCastContext,
  skill: RangerSkill,
  at = context.effectiveEnd,
) {
  const state = galeshotState.from(context);
  context.emit({
    type: "ranger.galeshot-state",
    at,
    source: "ranger",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    windForce: state.windForce,
    galeForceUntil: state.galeForceUntil,
    mistralUntil: state.mistralUntil,
    wutheringWindReady: state.wutheringWindReady,
    wutheringWindReadyAt: state.wutheringWindReadyAt,
  });
}

function countAsWeaponSwap(
  context: RangerCastContext,
  skill: RangerSkill,
): void {
  professionCoreState(context).autoattackChains = {};
  context.emit({
    type: "weapon_set",
    at: context.effectiveEnd,
    source: "ranger",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet,
    bundleSwap: true,
  });
  applyRangerWeaponSwapTraits(context, skill);
}

function emitCloudburstBoons(
  context: RangerCastContext,
  skill: RangerSkill,
): void {
  if (!hasTrait(context, TRAIT.CLOUDBURST)) return;
  const hawkeye = skill.id === ID.HAWKEYE;
  for (const [kind, duration, stacks] of [
    ["quickness", hawkeye ? 8 : 4, 1],
    ["might", 10, hawkeye ? 8 : 4],
  ] as const) {
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "Trait",
      sourceId: TRAIT.CLOUDBURST,
      actorType: "effect",
      skillId: TRAIT.CLOUDBURST,
      skillName: "Cloudburst",
      name: `Cloudburst - ${kind}`,
      kind,
      boon: kind,
      duration,
      stacks,
      recipients: "party",
      maximumRecipients: 5,
      triggeredBy: skill.name,
    });
  }
}

function restoreArrows(context: RangerCastContext, skill: RangerSkill): void {
  const state = galeshotState.from(context);
  state.arrows = Math.min(
    state.maximumArrows,
    state.arrows + Number(skill.arrowsRestored || 0),
  );
}

export const galeshotSkillHandlers = Object.freeze({
  "ranger.cyclone-bow-enter": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      galeshotState.from(context).cycloneBowActive = true;
      countAsWeaponSwap(context, skill);
      emitGaleshotState(context, skill, context.start);
    },
  },
  "ranger.cyclone-bow-exit": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const state = galeshotState.from(context);
      state.cycloneBowActive = false;
      state.windForce = 0;
      countAsWeaponSwap(context, skill);
      emitGaleshotState(context, skill, context.start);
    },
  },
  "ranger.cyclone-bow-skill": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const state = galeshotState.from(context);
      state.arrows = Math.max(0, state.arrows - Number(skill.arrowCost || 0));
      if (skill.id === ID.HAWKEYE) {
        state.windForce = 0;
        if (hasTrait(context, TRAIT.GALE_FORCE)) {
          state.galeForceUntil = context.effectiveEnd + 10;
          context.emit({
            type: "buff",
            at: context.effectiveEnd,
            source: "Trait",
            sourceId: TRAIT.GALE_FORCE,
            actorType: "effect",
            skillId: TRAIT.GALE_FORCE,
            skillName: "Gale Force",
            kind: "gale-force",
            duration: 10,
            stacks: 1,
            triggeredBy: skill.name,
          });
        }
        emitCloudburstBoons(context, skill);
      } else {
        state.windForce = Math.min(
          5,
          state.windForce + Number(skill.windForceGain || 0),
        );
        if (skill.id === ID.BLUSTER) {
          state.wutheringWindReady = hasTrait(context, TRAIT.WUTHERING_WIND);
          state.wutheringWindReadyAt = context.effectiveEnd;
          emitCloudburstBoons(context, skill);
        }
        if (
          hasTrait(context, TRAIT.CLOUDBURST) &&
          [ID.QUARRYS_PERIL, ID.SUPERSONIC_ARROW].includes(
            skill.id as typeof ID.QUARRYS_PERIL | typeof ID.SUPERSONIC_ARROW,
          )
        ) {
          context.state.cooldowns.delete(ID.BLUSTER);
        }
      }
      emitGaleshotState(
        context,
        skill,
        skill.id === ID.HAWKEYE
          ? context.start
          : context.start +
              Number(skill.windForceApplyMs ?? skill.quicknessCastTimeMs) /
                1000,
      );
    },
  },
  "ranger.galeshot-arrows": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      restoreArrows(context, skill);
      emitGaleshotState(context, skill, context.start);
    },
  },
  "ranger.mistral": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const state = galeshotState.from(context);
      restoreArrows(context, skill);
      state.mistralUntil = context.start + 6;
      emitGaleshotState(context, skill);
    },
  },
});
