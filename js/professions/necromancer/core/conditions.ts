import { professionCoreState } from "../../../platform/engine/profession.js";
/**
 * Condition-manipulation skill handlers.
 *
 * Necromancer corruption skills self-inflict a condition (tracked in
 * `state.selfConditions` with duration scaled by the player's condition-duration
 * stats) which transfer skills later fling onto the target. Also holds the
 * direct condition burst for Devouring Darkness. Exports the
 * `necromancerConditionSkillHandlers` map plus the self-condition
 * apply/purge/transfer helpers reused by shroud/scheduler code.
 */
import {
  createGw2CombatQuery,
  selectedGw2TraitValues,
} from "../../../platform/gw2/query.js";
import {
  createRelicTimelineRuntime,
  relicConditionDurationBonus,
} from "../../../platform/gw2/relic-rules.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import {
  emitBuff,
  emitCondition,
  emitDamage,
  hasTrait,
  necromancerBoonDuration,
  necromancerPartyBoonRecipients,
} from "./shared.js";
import type {
  NecromancerCastContext,
  NecromancerCoreState,
  NecromancerEmissionContext,
  NecromancerQueryRuntime,
  NecromancerSelfCondition,
  NecromancerSimulationEvent,
  NecromancerSkill,
} from "../types.js";

const DAMAGING_CONDITIONS = new Set([
  "Bleeding",
  "Burning",
  "Confusion",
  "Poison",
  "Poisoned",
  "Torment",
]);

const CORRUPTION_SELF_CONDITIONS = Object.freeze({
  [ID.CONSUME_CONDITIONS]: Object.freeze({
    base: Object.freeze([["Vulnerability", 5, 4]]),
    master: Object.freeze([["Vulnerability", 5, 4]]),
  }),
  [ID.BLOOD_IS_POWER]: Object.freeze({
    base: Object.freeze([["Bleeding", 2, 10]]),
    master: Object.freeze([["Torment", 2, 10]]),
  }),
  [ID.CORROSIVE_POISON_CLOUD]: Object.freeze({
    base: Object.freeze([["Weakness", 1, 6]]),
    master: Object.freeze([["Crippled", 1, 2]]),
  }),
  [ID.PLAGUELANDS]: Object.freeze({
    base: Object.freeze([["Bleeding", 1, 10]]),
    master: Object.freeze([["Poisoned", 1, 4]]),
  }),
});

function conditionDurationMultiplier(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  condition: string,
  at: number,
): number {
  const event: NecromancerSimulationEvent = {
    type: "self_condition",
    at,
    skillId: skill.id,
    skillName: skill.name,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    condition,
    selfCondition: true,
  };
  const traits = selectedGw2TraitValues(context.config, context.catalog);
  const historicalRelicContext = {
    relic: createRelicTimelineRuntime(context.config.relic, context.events),
  };
  const query = createGw2CombatQuery({
    profession: context.profession,
    config: context.config,
    events: context.events,
    traits,
    conditionDurationBonus: (runtime, time) =>
      relicConditionDurationBonus(
        runtime?.relic ? runtime : historicalRelicContext,
        time,
      ),
  });
  // Expertise does not extend Necromancer self-inflicted conditions. Other
  // duration bonuses still apply, matching the in-game corruption behavior.
  const stats = {
    ...query.statsAt(
      at,
      event,
      context.state as unknown as NecromancerQueryRuntime,
    ),
    expertise: 0,
  };
  return query.conditionDurationMultiplier(
    condition,
    at,
    stats,
    event,
    context.state as unknown as NecromancerQueryRuntime,
  );
}

export function purgeNecromancerSelfConditions(
  state: NecromancerCoreState,
  at: number,
): NecromancerSelfCondition[] {
  state.selfConditions = (state.selfConditions || []).filter(
    (application) => application.appliedAt <= at && application.expiresAt > at,
  );
  return state.selfConditions;
}

export function removeNecromancerSelfCondition(
  state: NecromancerCoreState,
  at: number,
  maximumConditionTypes = 1,
): number {
  const active = purgeNecromancerSelfConditions(state, at);
  const selected = new Set<string>();
  for (const application of active) {
    if (selected.size >= maximumConditionTypes) break;
    selected.add(application.condition);
  }
  state.selfConditions = active.filter(
    (application) => !selected.has(application.condition),
  );
  return selected.size;
}

export function applyNecromancerSelfCondition(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  condition: string,
  stacks: number,
  duration: number,
  at = context.effectiveEnd,
): NecromancerSelfCondition | null {
  const effectiveDuration =
    Math.max(0, Number(duration || 0)) *
    conditionDurationMultiplier(context, skill, condition, at);
  if (!(effectiveDuration > 0) || !(Number(stacks) > 0)) return null;
  const application: NecromancerSelfCondition = {
    condition,
    stacks: Number(stacks),
    appliedAt: at,
    expiresAt: at + effectiveDuration,
    sourceSkillId: skill.id,
    sourceSkillName: skill.name,
  };
  purgeNecromancerSelfConditions(professionCoreState(context), at);
  professionCoreState(context).selfConditions.push(application);
  context.emit({
    type: "self_condition",
    at,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: `${skill.name} — self ${condition}`,
    condition,
    stacks: Number(stacks),
    duration: effectiveDuration,
    expiresAt: application.expiresAt,
  });
  return application;
}

function emitTransferredApplication(
  context: NecromancerEmissionContext,
  skill: NecromancerSkill,
  application: NecromancerSelfCondition,
  at: number,
): void {
  const duration = application.expiresAt - at;
  const common = {
    at,
    source: "necromancer",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: `${skill.name} — Transferred ${application.condition}`,
    stacks: application.stacks,
    duration,
    fixedDuration: true,
    transferredCondition: true,
    transferredFromSkillId: application.sourceSkillId,
  } as const;
  if (application.condition === "Vulnerability") {
    context.emit({
      ...common,
      type: "buff",
      kind: "target-vulnerability",
    });
    return;
  }
  context.emit({
    ...common,
    type: "condition",
    condition: application.condition,
    nonDamaging: !DAMAGING_CONDITIONS.has(application.condition),
  });
}

export function transferNecromancerSelfConditions(
  context: NecromancerEmissionContext,
  skill: NecromancerSkill,
  maximumConditionTypes: number,
  at = context.effectiveEnd ?? context.state.time,
  {
    latestApplications = false,
  }: {
    readonly latestApplications?: boolean;
  } = {},
): number {
  const state = professionCoreState(context);
  const active = purgeNecromancerSelfConditions(state, at);
  if (latestApplications) {
    const transferred = active.slice(-maximumConditionTypes);
    if (!transferred.length) return 0;
    const retained = new Set(transferred);
    state.selfConditions = active.filter(
      (application) => !retained.has(application),
    );
    for (const application of transferred) {
      emitTransferredApplication(context, skill, application, at);
    }
    return transferred.length;
  }
  const selected = new Set<string>();
  for (const application of active) {
    if (selected.size >= maximumConditionTypes) break;
    selected.add(application.condition);
  }
  if (!selected.size) return 0;
  const transferred = active.filter((application) =>
    selected.has(application.condition),
  );
  state.selfConditions = active.filter(
    (application) => !selected.has(application.condition),
  );
  for (const application of transferred) {
    emitTransferredApplication(context, skill, application, at);
  }
  return transferred.length;
}

function corruption(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  const mechanics = (
    CORRUPTION_SELF_CONDITIONS as Readonly<
      Record<
        string | number,
        {
          readonly base: readonly (readonly (string | number)[])[];
          readonly master: readonly (readonly (string | number)[])[];
        }
      >
    >
  )[skill.id];
  if (!mechanics) return false;
  for (const application of mechanics.base) {
    applyNecromancerSelfCondition(
      context,
      skill,
      String(application[0]),
      Number(application[1]),
      Number(application[2]),
    );
  }
  if (hasTrait(context, TRAIT.MASTER_OF_CORRUPTION)) {
    for (const application of mechanics.master) {
      applyNecromancerSelfCondition(
        context,
        skill,
        String(application[0]),
        Number(application[1]),
        Number(application[2]),
      );
    }
  }
  if (professionCoreState(context).plagueSendingArmed) {
    const transferred = transferNecromancerSelfConditions(
      context,
      skill,
      2,
      context.effectiveEnd,
      { latestApplications: true },
    );
    if (transferred) {
      professionCoreState(context).plagueSendingArmed = false;
      professionCoreState(context).plagueSendingEntrySkillId = null;
    }
  }
  if (skill.id === ID.BLOOD_IS_POWER) {
    emitBuff(
      context,
      skill,
      "might",
      necromancerBoonDuration(context, "Might", 20),
      5,
      { metadata: necromancerPartyBoonRecipients(context) },
    );
  }
  return false;
}

function transfer(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  const maximum = (
    {
      [ID.PLAGUE_SIGNET]: 5,
      [ID.DEATHLY_SWARM]: 2,
      [ID.PUTRID_MARK]: 3,
      [ID.SUFFER]: 2,
    } as Readonly<Record<string | number, number>>
  )[skill.id];
  if (!maximum) return false;
  transferNecromancerSelfConditions(context, skill, maximum);
  return false;
}

function lifeSiphonSelfBleed(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  event: NecromancerSimulationEvent,
): void {
  if (event?.type !== "damage" || Number(event.hitIndex || 1) !== 1) return;
  applyNecromancerSelfCondition(context, skill, "Bleeding", 1, 8, event.at);
}

function darkPactOnHit(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  event: NecromancerSimulationEvent,
): void {
  if (event?.type !== "damage" || Number(event.hitIndex || 1) !== 1) return;
  applyNecromancerSelfCondition(context, skill, "Bleeding", 2, 10, event.at);
  emitCondition(context, skill, "Immobilized", 1, 6, {
    at: event.at,
  });
}

function devouringDarkness(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
): boolean {
  const impactAt = context.start + (context.fullEnd - context.start) * 0.8;
  const count = Math.min(
    5,
    Object.values(context.config.target?.conditions || {}).filter(
      (value) => value === true || Number(value) > 0,
    ).length,
  );
  emitDamage(context, skill, 1.16, { at: impactAt });
  if (count > 0) {
    emitCondition(context, skill, "Torment", count, 4, { at: impactAt });
  }
  return true;
}

export const necromancerConditionSkillHandlers = Object.freeze({
  "necromancer.corruption": corruption,
  "necromancer.condition-transfer": transfer,
  "necromancer.life-siphon": lifeSiphonSelfBleed,
  "necromancer.dark-pact": darkPactOnHit,
  "necromancer.devouring-darkness": devouringDarkness,
});
