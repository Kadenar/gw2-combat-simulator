import { flattenProfessionState } from "../../../platform/engine/profession.js";
import {
  SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
} from "../../../app/simulation/randomness.js";
import {
  THIEF_CORE_ASSUMPTION_CONTROLS,
} from "./assumptions.js";
import { THIEF_SKILL_IDS as ID } from "../data/ids.js";
import { spearChainStageForSkill } from "./conditions.js";
import { thiefWeaponSkillMatchesSet } from "./weapons.js";

function stateFrom(context = {}) {
  return flattenProfessionState(
    context.state?.profession || context.professionState,
  );
}

function professionIds(context) {
  const state = stateFrom(context);
  return [
    state.professionSkillId || ID.STEAL,
    state.storedStolenSkillId,
  ].filter(value => value != null).map(Number).filter(Number.isFinite);
}

function corePaletteSkillAvailability(context = {}, skill) {
  const state = stateFrom(context);
  const stealthed =
    Number(state.stealthUntil || 0) > Number(context.time || 0)
    && Number(state.revealedUntil || 0) <= Number(context.time || 0);
  const bonusStealthAttack =
    Number(state.stealthAttackCharges || 0) > 0
    && Number(state.stealthAttackExpiresAt || 0)
      > Number(context.time || 0);
  const spearChainStage = spearChainStageForSkill(skill.id);
  if (
    spearChainStage != null
    && Number(state.spearChainStage || 0) !== spearChainStage
  ) {
    return {
      available: false,
      message: `Advance the spear chain to stage ${spearChainStage + 1}`,
    };
  }
  if (skill.dualWieldFollowup && !state.availableFlips?.[skill.id]) {
    return {
      available: false,
      message: "Use its opening dual-wield skill first",
    };
  }
  if (skill.stealthAttack) {
    const available = stealthed || bonusStealthAttack;
    return {
      available,
      message: available ? "" : "Gain stealth first",
    };
  }
  if (
    (stealthed || bonusStealthAttack)
    && skill.type === "Weapon"
    && skill.slot === "Weapon_1"
  ) {
    return {
      available: false,
      message: "The active weapon's stealth attack replaces skill 1",
    };
  }
  return { available: true, message: "" };
}

function thiefCoreEventLogRow(_context, event) {
  if (event?.type !== "thief.state") return undefined;
  const state = event.state || {};
  return {
    type: event.type,
    description: [
      event.reason || "State",
      `Initiative ${Number(state.initiative || 0).toFixed(1)}`,
    ].join(" · "),
    className: "resource",
    order: 30,
    flags: [],
  };
}

export const thiefCoreUi = Object.freeze({
  assumptionControls: Object.freeze([
    ...THIEF_CORE_ASSUMPTION_CONTROLS,
    ...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
  ]),
  weaponSkillMatchesSet: thiefWeaponSkillMatchesSet,
  paletteGroups: context =>
    ["Core", "Daredevil"].includes(
      context.specialization || context.config?.specialization || "Core",
    )
      ? [{
          id: "thief-profession",
          label: "F",
          skillIds: professionIds(context),
          color: "#9a535c",
          resourceAnchor: true,
        }]
      : [],
  skillBarGroups: context =>
    ["Core", "Daredevil"].includes(
      context.specialization || context.config?.specialization || "Core",
    )
      ? [{
          id: "thief-stolen-skills",
          label: "Stolen Skills",
          skillIds: THIEF_CORE_ASSUMPTION_CONTROLS
            .find(control => control.key === "stolenSkillChoice")
            ?.options.map(option => Number(option.skillId))
            .filter(Number.isFinite) || [],
          color: "#9a535c",
        }]
      : [],
  resourceViews: context => {
    const state = stateFrom(context);
    const specialization =
      context.specialization || context.config?.specialization || "Core";
    return [{
      id: "initiative",
      singular: "initiative",
      plural: "initiative",
      maximum: Number(state.maximumInitiative || 12),
      value: Number(state.initiative ?? context.initialInitiative ?? 12),
      startMaximum: 15,
      startValue: Number(context.initialInitiative ?? 12),
      canStart: true,
      buildKey: "initialInitiative",
      step: 1,
      displayMode: "pips",
      pipStyle: "thief-initiative",
      pipRows: Number(
        state.initiativePipRows || (specialization === "Antiquary" ? 3 : 2),
      ),
      shortLabel: "Init",
      statusLabel: "Current",
    }, {
      id: "endurance",
      singular: "endurance",
      plural: "endurance",
      maximum: Number(
        state.maximumEndurance || (specialization === "Daredevil" ? 150 : 100),
      ),
      value: Number(state.endurance ?? 100),
      canStart: false,
      step: 1,
      displayMode: "bar",
      pipStyle: "endurance",
      shortLabel: "End",
      statusLabel: "Current",
    }];
  },
  paletteSkillAvailability: corePaletteSkillAvailability,
  eventLogRow: thiefCoreEventLogRow,
});
