import { professionCoreState } from "../../../platform/engine/profession.js";
/**
 * Scheduler-side Revenant trait lifecycle and event observation.
 *
 * Initializes trait-owned state, modifies cast/recharge durations, applies
 * after-cast boons and resource effects, and reacts to newly scheduled damage,
 * condition, control, buff, and swap events. Elite trait reactions live in
 * their specialization slices.
 */
import {
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import { hasRevenantTrait } from "./state.js";
import { emitRevenantBoon } from "./boons.js";
import { revenantCombatActive } from "./legend.js";
import { REVENANT_CORE_MECHANICS } from "./mechanics.js";
import type {
  SchedulerRecord,
  SimulationEvent,
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  RevenantCastContext,
  RevenantCoreState,
  RevenantPrecastContext,
  RevenantRechargeContext,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill,
} from "../types.js";

const MECHANICS = REVENANT_CORE_MECHANICS;

interface ImpossibleOddsTaskPayload extends SchedulerRecord {
  readonly event: SimulationEvent;
}

interface BattleScarGrant {
  readonly at: number;
  readonly stacks: number;
  readonly sourceId: SkillId;
  readonly sourceName: string;
  readonly cause?: SimulationEvent | null;
}

const IMPOSSIBLE_ODDS_TASK = "revenant.impossible-odds-strike";

function canTriggerImpossibleOdds(event: RevenantSimulationEvent): boolean {
  return (
    event.type === "damage" &&
    Number(event.coefficient || 0) > 0 &&
    event.skillId !== ID.IMPOSSIBLE_ODDS &&
    (event.actorType === "player" || event.source === "Sigil")
  );
}

/** Emits a delayed Impossible Odds strike when its upkeep and ICD are active. */
export function handleImpossibleOddsStrike(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<ImpossibleOddsTaskPayload>,
): void {
  if (!task.payload) return;
  const cause = task.payload.event;
  const state = professionCoreState(context);
  const impossible = context.catalog.skillsById.get(ID.IMPOSSIBLE_ODDS);
  if (
    !impossible ||
    !(state.activeUpkeeps || []).some(
      (upkeep) => upkeep.skillId === impossible.id,
    ) ||
    task.at + context.epsilon <
      Number(state.traitProcReadyAt.impossibleOdds || 0)
  )
    return;
  const profile = MECHANICS.impossibleOdds;
  state.traitProcReadyAt.impossibleOdds = task.at + profile.interval;
  context.emitDerived(cause, {
    type: "damage",
    at: task.at + profile.delay,
    name: "Impossible Odds",
    skillName: "Impossible Odds",
    coefficient: profile.coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: "revenant",
    sourceId: impossible.id,
    actorType: "effect",
    skillId: impossible.id,
    skillWeapon: "Unequipped",
    canTriggerCriticalSigils: true,
  });
}

function emitTraitCondition(
  context: RevenantSchedulerContext,
  cause: SimulationEvent,
  traitId: SkillId,
  name: string,
  condition: string,
  stacks: number,
  duration: number,
): void {
  context.emitDerived(cause, {
    type: "condition",
    at: cause.at,
    source: "revenant",
    sourceId: traitId,
    actorType: "player",
    skillId: traitId,
    skillName: name,
    name: `${name} — ${condition}`,
    condition,
    stacks,
    duration,
  });
}

function pruneBattleScars(state: RevenantCoreState, at: number): void {
  state.battleScars = (state.battleScars || []).filter(
    (stack) => stack.expiresAt > at,
  );
}

function grantBattleScars(
  context: RevenantSchedulerContext,
  { at, stacks, sourceId, sourceName, cause = null }: BattleScarGrant,
): void {
  const profile = MECHANICS.battleScars;
  const state = professionCoreState(context);
  pruneBattleScars(state, at);
  const count = Math.min(
    Math.max(0, Math.trunc(Number(stacks || 0))),
    Math.max(0, profile.limit - state.battleScars.length),
  );
  if (!count) return;
  for (let index = 0; index < count; index += 1) {
    state.battleScars.push({
      at,
      expiresAt: at + profile.duration,
    });
  }
  const event = {
    type: "buff",
    at,
    source: "revenant",
    sourceId,
    actorType: "player" as const,
    skillId: sourceId,
    skillName: sourceName,
    name: `${sourceName} — Battle Scars`,
    kind: "battle-scars",
    duration: profile.duration,
    stacks: count,
  };
  if (cause) context.emitDerived(cause, event);
  else context.emit(event);
}

function materializeThrillOfCombat(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): void {
  if (!hasRevenantTrait(context.config, TRAIT.THRILL_OF_COMBAT)) return;
  const state = professionCoreState(context);
  const profile = MECHANICS.battleScars;
  if (state.nextThrillOfCombatAt == null) {
    state.nextThrillOfCombatAt =
      Number(state.combatBeganAt ?? event.at) + profile.interval;
  }
  const next = Number(state.nextThrillOfCombatAt);
  if (!Number.isFinite(next) || next > event.at + context.epsilon) return;
  const elapsedGrants =
    Math.floor((event.at - next + context.epsilon) / profile.interval) + 1;
  const maximumActiveGrants = Math.ceil(profile.duration / profile.interval);
  const firstActiveIndex = Math.max(0, elapsedGrants - maximumActiveGrants);
  let activeGrants = 0;
  for (let index = firstActiveIndex; index < elapsedGrants; index += 1) {
    const grantedAt = next + index * profile.interval;
    pruneBattleScars(state, grantedAt);
    if (state.battleScars.length >= profile.limit) continue;
    state.battleScars.push({
      at: grantedAt,
      expiresAt: grantedAt + profile.duration,
    });
    activeGrants += 1;
  }
  state.nextThrillOfCombatAt = next + elapsedGrants * profile.interval;
  if (activeGrants) {
    context.emitDerived(event, {
      type: "buff",
      at: event.at,
      source: "revenant",
      sourceId: TRAIT.THRILL_OF_COMBAT,
      actorType: "player",
      skillId: TRAIT.THRILL_OF_COMBAT,
      skillName: "Thrill of Combat",
      name: "Thrill of Combat — Battle Scars",
      kind: "battle-scars",
      duration: profile.duration,
      stacks: activeGrants,
    });
  }
}

function consumeBattleScar(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): void {
  const profile = MECHANICS.battleScars;
  const state = professionCoreState(context);
  pruneBattleScars(state, event.at);
  if (!state.battleScars.length) return;
  state.battleScars.pop();
  context.emitDerived(event, {
    type: "damage",
    at: event.at,
    source: "revenant",
    sourceId: "revenant.battle-scars",
    actorType: "effect",
    skillId: "revenant.battle-scars",
    skillName: "Battle Scars",
    name: "Battle Scars — Life Siphon",
    coefficient: 0,
    flatStrikeBase: profile.flatStrikeBase,
    flatStrikePowerCoeff: profile.flatStrikePowerCoeff,
    noCrit: true,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: "Unequipped",
  });
}

function isLegendaryStanceSkill(skill: RevenantSkill): boolean {
  if (
    ["Heal", "Utility", "Elite"].includes(String(skill.slot || ""))
    && skill.legendId
  ) {
    return true;
  }
  return skill.type === "Profession";
}

/** Seeds trait-owned proc state that depends on the selected build. */
export function initializeRevenantTraits(
  _context: RevenantSchedulerContext,
): void {}

/** Applies active trait/state cast-speed changes to a base duration. */
export function modifyRevenantCastDuration(
  _context: RevenantPrecastContext,
  duration: number,
): number {
  return duration;
}

/** Applies trait-specific recharge multipliers after shared Alacrity policy. */
export function modifyRevenantRechargeDuration(
  context: RevenantRechargeContext,
  duration: number,
): number {
  const skill = context.skill;
  if (
    skill &&
    ([ID.SWAP_LEGENDS, ID.SWAP_WEAPONS] as readonly number[])
      .includes(Number(skill.id))
  ) {
    return Math.max(
      0,
      Number(skill.cooldown ?? skill.recharge ?? duration),
    );
  }
  return duration;
}

/** Commits trait effects that trigger once a cast's packet handling finishes. */
export function afterRevenantCast(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  if (
    skill?.slot === "Heal" &&
    hasRevenantTrait(context.config, TRAIT.BATTLE_SCARRED)
  ) {
    grantBattleScars(context, {
      at: context.effectiveEnd,
      stacks: MECHANICS.battleScars.healSkillStacks,
      sourceId: TRAIT.BATTLE_SCARRED,
      sourceName: "Battle Scarred",
    });
  }
  if (
    isLegendaryStanceSkill(skill) &&
    revenantCombatActive(context, context.effectiveEnd) &&
    hasRevenantTrait(context.config, TRAIT.NOTORIETY)
  ) {
    const profile = MECHANICS.traitProcs.notoriety;
    emitRevenantBoon(
      context,
      skill,
      "might",
      profile.mightDuration,
      profile.mightStacks,
      {
        at: context.effectiveEnd,
        sourceId: TRAIT.NOTORIETY,
        name: "Notoriety — might",
      },
    );
  }
  if (
    !([ID.EMBRACE_THE_DARKNESS, ID.RESIST_THE_DARKNESS] as readonly number[])
      .includes(Number(skill.id))
  ) {
    const embrace = professionCoreState(context).activeUpkeeps.find(
      (upkeep) => upkeep.skillId === ID.EMBRACE_THE_DARKNESS,
    );
    if (embrace) embrace.empoweredNextPulse = true;
  }
}

/**
 * Observes each scheduler event once and materializes causally derived trait,
 * Core trait, Enchanted Dagger, and upkeep effects.
 */
export function observeRevenantEvent(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): void {
  const state = professionCoreState(context);
  if (canTriggerImpossibleOdds(event)) {
    context.tasks.schedule({
      id: `${IMPOSSIBLE_ODDS_TASK}:${event.__order}`,
      type: IMPOSSIBLE_ODDS_TASK,
      at: event.at,
      payload: { event },
    });
  }
  if (
    context.config.relic === "Peitha" &&
    event.type === "damage" &&
    ((event.skillName === "Deathstrike" && event.name === "Initial Damage") ||
      event.skillName === "Phantom's Onslaught")
  ) {
    const delay = event.skillName === "Deathstrike" ? 0.24 : 0.68;
    context.emitDerived(event, {
      type: "peitha",
      at: event.at + delay,
      source: "revenant",
      sourceId: event.skillId ?? event.sourceId,
      actorType: "player",
      skillId: event.skillId,
      skillName: event.skillName,
      name: "Relic of Peitha",
    });
  }
  if (
    ["action", "sigil_swap"].includes(event.type) &&
    event.skillId === ID.SWAP_WEAPONS &&
    hasRevenantTrait(context.config, TRAIT.BRUTALITY) &&
    Number(event.endsAt ?? event.at) + context.epsilon >=
      Number(professionCoreState(context).traitProcReadyAt.brutality || 0)
  ) {
    const profile = MECHANICS.traitProcs.brutality;
    const at = Number(event.endsAt ?? event.at);
    professionCoreState(context).traitProcReadyAt.brutality = at + profile.interval;
    context.emitDerived(event, {
      type: "buff",
      at,
      source: "revenant",
      sourceId: TRAIT.BRUTALITY,
      actorType: "player",
      skillId: TRAIT.BRUTALITY,
      skillName: "Brutality",
      name: "Brutality — quickness",
      kind: "quickness",
      duration: profile.quicknessDuration,
      stacks: 1,
    });
  }
  if (
    event.type === "control" &&
    hasRevenantTrait(context.config, TRAIT.DWARVEN_BATTLE_TRAINING)
  ) {
    const profile = MECHANICS.traitProcs.dwarvenBattleTraining;
    emitTraitCondition(
      context,
      event,
      TRAIT.DWARVEN_BATTLE_TRAINING,
      "Dwarven Battle Training",
      "Weakness",
      1,
      profile.weaknessDuration,
    );
  }
  if (event.type === "condition") {
    if (
      event.condition === "Chilled" &&
      hasRevenantTrait(context.config, TRAIT.ABYSSAL_CHILL)
    ) {
      const profile = MECHANICS.traitProcs.abyssalChill;
      emitTraitCondition(
        context,
        event,
        TRAIT.ABYSSAL_CHILL,
        "Abyssal Chill",
        "Torment",
        Math.max(1, Number(event.stacks || 1)),
        profile.tormentDuration,
      );
    }
    if (
      event.condition === "Vulnerability" &&
      hasRevenantTrait(context.config, TRAIT.DANCE_OF_DEATH)
    ) {
      grantBattleScars(context, {
        at: event.at,
        stacks: event.stacks,
        sourceId: TRAIT.DANCE_OF_DEATH,
        sourceName: "Dance of Death",
        cause: event,
      });
    }
  }
  if (
    event.type === "damage" &&
    event.actorType === "player" &&
    Number(event.coefficient || 0) > 0
  ) {
    materializeThrillOfCombat(context, event);
    consumeBattleScar(context, event);
    if (
      hasRevenantTrait(context.config, TRAIT.ASSASSINS_PRESENCE) &&
      event.at + context.epsilon >=
        Number(state.traitProcReadyAt.assassinsPresence || 0)
    ) {
      const profile = MECHANICS.traitProcs.assassinsPresence;
      state.traitProcReadyAt.assassinsPresence = event.at + profile.interval;
      context.emitDerived(event, {
        type: "buff",
        at: event.at,
        source: "revenant",
        sourceId: TRAIT.ASSASSINS_PRESENCE,
        actorType: "player",
        skillId: TRAIT.ASSASSINS_PRESENCE,
        skillName: "Assassin's Presence",
        name: "Assassin's Presence — fury",
        kind: "fury",
        duration: profile.furyDuration,
        stacks: 1,
      });
    }
    if (
      hasRevenantTrait(context.config, TRAIT.VICIOUS_REPRISAL) &&
      context.hasBuff("resolution", event.at) &&
      event.at + context.epsilon >=
        Number(state.traitProcReadyAt.viciousReprisal || 0)
    ) {
      const profile = MECHANICS.traitProcs.viciousReprisal;
      state.traitProcReadyAt.viciousReprisal = event.at + profile.interval;
      context.emitDerived(event, {
        type: "buff",
        at: event.at,
        source: "revenant",
        sourceId: TRAIT.VICIOUS_REPRISAL,
        actorType: "player",
        skillId: TRAIT.VICIOUS_REPRISAL,
        skillName: "Vicious Reprisal",
        name: "Vicious Reprisal — might",
        kind: "might",
        duration: profile.mightDuration,
        stacks: 1,
      });
    }
    if (
      !state.exposeDefensesUsed &&
      hasRevenantTrait(context.config, TRAIT.EXPOSE_DEFENSES) &&
      revenantCombatActive(context, event.at)
    ) {
      const profile = MECHANICS.traitProcs.exposeDefenses;
      state.exposeDefensesUsed = true;
      emitTraitCondition(
        context,
        event,
        TRAIT.EXPOSE_DEFENSES,
        "Expose Defenses",
        "Vulnerability",
        profile.vulnerabilityStacks,
        profile.vulnerabilityDuration,
      );
    }
    const daggers = state.enchantedDaggers;
    if (
      event.skillId !== ID.ENCHANTED_DAGGERS &&
      Number(daggers?.charges || 0) > 0 &&
      event.at < Number(daggers.expiresAt || 0) &&
      event.at + context.epsilon >= Number(daggers.readyAt || 0)
    ) {
      const profile = MECHANICS.enchantedDaggers;
      daggers.charges -= 1;
      daggers.readyAt = event.at + profile.interval;
      context.emitDerived(event, {
        type: "damage",
        at: event.at + profile.interval,
        source: "revenant",
        sourceId: ID.ENCHANTED_DAGGERS,
        actorType: "effect",
        skillId: ID.ENCHANTED_DAGGERS,
        skillName: "Enchanted Daggers",
        name: "Enchanted Daggers — Siphon Damage",
        coefficient: 0,
        flatStrikeBase: profile.siphon.flatStrikeBase,
        flatStrikePowerCoeff: profile.siphon.flatStrikePowerCoeff,
        noCrit: true,
        hits: 1,
        hitIndex: profile.charges - daggers.charges,
        totalHits: profile.charges,
        extendsResolutionHorizon: true,
      });
    }
  }
}
