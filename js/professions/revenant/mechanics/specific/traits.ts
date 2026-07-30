/**
 * Scheduler-side Revenant trait lifecycle and event observation.
 *
 * Initializes trait-owned state, modifies cast/recharge durations, applies
 * after-cast boons and resource effects, and reacts to newly scheduled damage,
 * condition, control, buff, and swap events. Soulcleave reactions remain in
 * resolver/event-reactions.js.
 */
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { hasRevenantTrait, revenantConduitFormIsActive } from "../../state.js";
import { applyCosmicWisdomAfterCast, emitRevenantBoon } from "./conduit.js";
import { revenantCombatActive } from "./legend.js";
import { REVENANT_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";
import {
  activeKallasFervorStacks,
  grantKallasFervor,
  isBandTogetherReady,
} from "./assassin-renegade.js";
import type {
  SchedulerRecord,
  SimulationEvent,
  SkillId,
} from "../../../../platform/engine/types.js";
import type {
  RevenantCastContext,
  RevenantPrecastContext,
  RevenantRechargeContext,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill,
  RevenantState,
} from "../../types.js";

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

const TWIN_MOON_SKILL_IDS = new Set<SkillId>([
  ID.TWIN_MOON_SWEEP,
  ID.TWIN_MOON_SWEEP_ID_77001,
]);
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
  const state = context.state.profession;
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

function pruneBattleScars(state: RevenantState, at: number): void {
  state.battleScars = (state.battleScars || []).filter(
    (stack) => stack.expiresAt > at,
  );
}

function grantBattleScars(
  context: RevenantSchedulerContext,
  { at, stacks, sourceId, sourceName, cause = null }: BattleScarGrant,
): void {
  const profile = MECHANICS.battleScars;
  const state = context.state.profession;
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
  const state = context.state.profession;
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
  const state = context.state.profession;
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
  return (
    MECHANICS.traitProcs.notoriety.professionSkillIds as readonly number[]
  ).includes(Number(skill.id));
}

function scaledBoonDuration(
  context: RevenantSchedulerContext,
  boon: string,
  duration: number,
): number {
  const skill = (
    context as unknown as SchedulerRecord
  ).skill as RevenantSkill;
  return (
    context.schedulerPolicy.effectDuration?.(
      context,
      skill,
      { type: "boon", boon, duration },
      duration,
    ) ?? duration
  );
}

function expectedRenegadeCriticals(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): number {
  const state = context.state.profession;
  const chance = Number(
    context.schedulerPolicy.critical?.(context, event)?.chance || 0,
  );
  state.renegadeCriticalProgress =
    Number(state.renegadeCriticalProgress || 0) + chance;
  const count = Math.floor(state.renegadeCriticalProgress + 1e-9);
  if (count > 0) state.renegadeCriticalProgress -= count;
  return count;
}

function applyRenegadeCriticalTraits(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): void {
  const ambush = hasRevenantTrait(context.config, TRAIT.AMBUSH_COMMANDER);
  const enmity = hasRevenantTrait(context.config, TRAIT.ENDLESS_ENMITY);
  if (!ambush && !enmity) return;
  const criticals = expectedRenegadeCriticals(context, event);
  const positionalTrigger = Boolean(
    context.config.target?.flanking ||
    context.config.target?.behind ||
    context.config.target?.defiant,
  );
  if (ambush && (positionalTrigger || criticals > 0)) {
    grantKallasFervor(context, event, {
      sourceId: TRAIT.AMBUSH_COMMANDER,
      sourceName: "Ambush Commander",
    });
  }
  const state = context.state.profession;
  if (
    !enmity ||
    criticals <= 0 ||
    event.at + context.epsilon <
      Number(state.traitProcReadyAt.endlessEnmity || 0)
  )
    return;
  const profile = MECHANICS.renegade.endlessEnmity;
  state.traitProcReadyAt.endlessEnmity = event.at + profile.interval;
  context.emitDerived(event, {
    type: "buff",
    at: event.at,
    source: "revenant",
    sourceId: TRAIT.ENDLESS_ENMITY,
    actorType: "player",
    skillId: TRAIT.ENDLESS_ENMITY,
    skillName: "Endless Enmity",
    name: "Endless Enmity — fury",
    kind: "fury",
    duration: scaledBoonDuration(context, "fury", profile.furyDuration),
    stacks: 1,
    recipients: "party",
  });
}

function applyVindication(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): void {
  if (
    event.skillId !== ID.CITADEL_BOMBARDMENT ||
    Number(event.hitIndex || 1) !== 1 ||
    !hasRevenantTrait(context.config, TRAIT.VINDICATION)
  )
    return;
  const duration = MECHANICS.renegade.vindication.dazeDuration;
  context.emitDerived(event, {
    type: "control",
    at: event.at,
    source: "revenant",
    sourceId: TRAIT.VINDICATION,
    actorType: "player",
    skillId: TRAIT.VINDICATION,
    skillName: "Vindication",
    name: "Vindication — Daze",
    controlKind: "daze",
    duration,
    breakbar: duration * 100,
  });
}

function applyKallasFervorLifeSiphon(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): void {
  if (
    !Number.isFinite(Number(event.flatStrikeBase)) &&
    !Number.isFinite(Number(event.flatStrikePowerCoeff))
  )
    return;
  if (!/siphon/i.test(`${event.name || ""} ${event.skillName || ""}`)) return;
  const stacks = activeKallasFervorStacks(context.state.profession, event.at);
  if (!stacks) return;
  const profile = MECHANICS.renegade.kallasFervor;
  const perStack = hasRevenantTrait(context.config, TRAIT.LASTING_LEGACY)
    ? profile.improvedLifeSiphonDamagePerStack
    : profile.lifeSiphonDamagePerStack;
  context.replaceEvent(event, {
    flatStrikeMultiplier:
      Number(event.flatStrikeMultiplier ?? 1) * (1 + stacks * perStack),
  });
}

/** Seeds trait-owned proc state that depends on the selected build. */
export function initializeRevenantTraits(
  context: RevenantSchedulerContext,
): void {
  if (
    hasRevenantTrait(context.config, TRAIT.AMBUSH_COMMANDER) ||
    hasRevenantTrait(context.config, TRAIT.ENDLESS_ENMITY)
  ) {
    context.schedulerPolicy.requireCriticalFacts?.();
  }
}

/** Applies active trait/state cast-speed changes to a base duration. */
export function modifyRevenantCastDuration(
  context: RevenantPrecastContext,
  duration: number,
): number {
  if (
    context.skill?.id === ID.DODGE &&
    context.config.specialization === "Vindicator"
  ) {
    return MECHANICS.endurance.vindicatorDodgeCastTime;
  }
  if (
    context.skill?.handlerId === "revenant.band-together" &&
    isBandTogetherReady(context.state.profession, context.start)
  )
    return 0;
  if (context.skill?.handlerId === "revenant.beguiling-haze") {
    const quickness = context.hasBuff?.("quickness", context.start);
    if (Number(context.state.profession.beguilingHazeCharges || 0) > 0) {
      return quickness ? 0.24 : 0.25;
    }
    return duration + (quickness ? 0.36 : 0.4);
  }
  return duration;
}

/** Applies trait-specific recharge multipliers after shared Alacrity policy. */
export function modifyRevenantRechargeDuration(
  context: RevenantRechargeContext,
  duration: number,
): number {
  const skill = context.skill;
  if (
    ([ID.ENERGY_MELD, ID.ENERGY_MELD_ID_72058] as readonly number[])
      .includes(Number(skill?.id)) &&
    hasRevenantTrait(context.config, TRAIT.REAVERS_CURSE)
  ) {
    return duration *
      MECHANICS.endurance.energyMeld.reaversCurseRechargeMultiplier;
  }
  if (
    skill
    &&
    ([ID.SWAP_LEGENDS, ID.SWAP_WEAPONS] as readonly number[])
      .includes(Number(skill?.id))
  ) {
    const base = Math.max(
      0,
      Number(skill.cooldown ?? skill.recharge ?? duration),
    );
    if (
      skill.id === ID.SWAP_LEGENDS &&
      revenantCombatActive(context, context.at) &&
      hasRevenantTrait(context.config, TRAIT.ENHANCED_EMBODIMENT)
    ) {
      return base * 0.6;
    }
    return base;
  }
  if (
    ([
      ID.BANISH_ENCHANTMENT,
      ID.BANISH_ENCHANTMENT_ID_78587,
    ] as readonly number[]).includes(Number(skill?.id)) &&
    revenantConduitFormIsActive(
      context.state.profession,
      "Mesmer",
      // Form-based skill overrides snapshot when the cast begins. A cast
      // started during Cosmic Wisdom keeps its modified recharge even when
      // the form expires before the animation finishes.
      context.start ?? context.at,
    )
  ) {
    const base = MECHANICS.conduit.formOfTheMesmer.banishEnchantmentCooldown;
    const rate = context.hasBuff?.("alacrity", context.at)
      ? Number(context.config.alacrityRechargeRate || 1.25)
      : 1;
    return base / rate;
  }
  if (
    skill?.handlerId === "revenant.band-together" &&
    isBandTogetherReady(
      context.state.profession,
      Number(context.start ?? context.at),
    ) &&
    hasRevenantTrait(context.config, TRAIT.ALL_FOR_ONE)
  ) {
    return duration * MECHANICS.renegade.allForOne.enhancedRechargeMultiplier;
  }
  if (
    skill?.handlerId === "revenant.release-potential" &&
    hasRevenantTrait(context.config, TRAIT.KINETIC_INSIGHT)
  )
    return duration * 0.8;
  return duration;
}

/** Commits trait effects that trigger once a cast's packet handling finishes. */
export function afterRevenantCast(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  applyCosmicWisdomAfterCast(context, skill);
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
    skill.legendId === LEGEND.ENTITY &&
    hasRevenantTrait(context.config, TRAIT.SHARED_WISDOM)
  ) {
    emitRevenantBoon(
      context,
      skill,
      "swiftness",
      MECHANICS.conduit.sharedWisdomSwiftness,
    );
  }
  if (
    !([ID.EMBRACE_THE_DARKNESS, ID.RESIST_THE_DARKNESS] as readonly number[])
      .includes(Number(skill.id))
  ) {
    const embrace = context.state.profession.activeUpkeeps.find(
      (upkeep) => upkeep.skillId === ID.EMBRACE_THE_DARKNESS,
    );
    if (embrace) embrace.empoweredNextPulse = true;
  }
}

/**
 * Observes each scheduler event once and materializes causally derived trait,
 * Enchanted Dagger, Razorclaw, upkeep, and affinity effects.
 */
export function observeRevenantEvent(
  context: RevenantSchedulerContext,
  event: RevenantSimulationEvent,
): void {
  const state = context.state.profession;
  if (canTriggerImpossibleOdds(event)) {
    context.tasks.schedule({
      id: `${IMPOSSIBLE_ODDS_TASK}:${event.__order}`,
      type: IMPOSSIBLE_ODDS_TASK,
      at: event.at,
      payload: { event },
    });
  }
  if (
    context.config.specialization === "Conduit" &&
    event.type === "damage" &&
    event.affinityOnHit === true
  ) {
    const skill = event.skillId == null
      ? undefined
      : context.catalog.skillsById.get(event.skillId);
    const cost = Number(skill?.energyCost || 0);
    context.tasks.schedule({
      id: `revenant.affinity-hit:${event.__order}`,
      type: "revenant.affinity-hit",
      at: event.at,
      payload: {
        amount:
          cost >= MECHANICS.energy.highCostThreshold
            ? MECHANICS.energy.highCostAffinity
            : MECHANICS.energy.standardAffinity,
      },
    });
  }
  if (
    context.config.relic === "Peitha" &&
    event.type === "damage" &&
    ((event.skillName === "Deathstrike" && event.name === "Initial Damage") ||
      event.skillName === "Beguiling Haze" ||
      event.skillName === "Phantom's Onslaught")
  ) {
    const delay =
      event.skillName === "Deathstrike"
        ? 0.24
        : event.skillName === "Beguiling Haze"
          ? 0.32
          : 0.68;
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
    event.type === "buff" &&
    String(event.kind || "").toLowerCase() === "fury" &&
    hasRevenantTrait(context.config, TRAIT.BLOOD_FURY) &&
    event.at + context.epsilon >= Number(state.traitProcReadyAt.bloodFury || 0)
  ) {
    state.traitProcReadyAt.bloodFury =
      event.at + MECHANICS.renegade.bloodFury.interval;
    grantKallasFervor(context, event, {
      sourceId: TRAIT.BLOOD_FURY,
      sourceName: "Blood Fury",
    });
  }
  if (event.type === "damage") {
    applyVindication(context, event);
    applyKallasFervorLifeSiphon(context, event);
  }
  if (
    ["action", "sigil_swap"].includes(event.type) &&
    event.skillId === ID.SWAP_WEAPONS &&
    hasRevenantTrait(context.config, TRAIT.BRUTALITY) &&
    Number(event.endsAt ?? event.at) + context.epsilon >=
      Number(context.state.profession.traitProcReadyAt.brutality || 0)
  ) {
    const profile = MECHANICS.traitProcs.brutality;
    const at = Number(event.endsAt ?? event.at);
    context.state.profession.traitProcReadyAt.brutality = at + profile.interval;
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
    applyRenegadeCriticalTraits(context, event);
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
    const razorclaw = state.razorclawsRage;
    if (
      event.skillId !== ID.RAZORCLAWS_RAGE &&
      Number(razorclaw?.charges || 0) > 0 &&
      event.at < Number(razorclaw.expiresAt || 0) &&
      event.at + context.epsilon >= Number(razorclaw.readyAt || 0)
    ) {
      const profile = MECHANICS.bandTogether.razorclaw;
      razorclaw.charges -= 1;
      razorclaw.readyAt = event.at + profile.interval;
      context.emitDerived(event, {
        type: "condition",
        at: event.at,
        source: "revenant",
        sourceId: ID.RAZORCLAWS_RAGE,
        actorType: "player",
        skillId: ID.RAZORCLAWS_RAGE,
        skillName: "Razorclaw's Rage",
        name: "Razorclaw's Rage — Bleeding",
        condition: "Bleeding",
        stacks: 1,
        duration: profile.bleedDuration,
      });
    }
  }
  if (
    event.type !== "control" ||
    (event.skillId != null && TWIN_MOON_SKILL_IDS.has(event.skillId)) ||
    !hasRevenantTrait(context.config, TRAIT.MISTFIRE)
  )
    return;
  const profile = MECHANICS.traitProcs.mistfire;
  const readyAt = Number(state.traitProcReadyAt.mistfire || 0);
  if (event.at + context.epsilon < readyAt) return;
  state.traitProcReadyAt.mistfire = event.at + profile.interval;
  context.emitDerived(event, {
    type: "condition",
    at: event.at,
    source: "revenant",
    sourceId: TRAIT.MISTFIRE,
    actorType: "effect",
    skillId: TRAIT.MISTFIRE,
    skillName: "Mistfire",
    name: "Mistfire — Burning",
    condition: "Burning",
    stacks: profile.burningStacks,
    duration: profile.burningDuration,
  });
}
