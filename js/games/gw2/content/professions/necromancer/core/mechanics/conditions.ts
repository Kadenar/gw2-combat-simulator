import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
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
import { createGw2CombatQuery, selectedGw2TraitValues } from '#gw2/platform/combat/query/combat-query.js';
import { isDamagingCondition } from '#gw2/platform/combat/state/targets.js';
import { createRelicTimelineRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import { relicConditionDurationBonus } from '#gw2/platform/equipment/relics/query.js';
import { effectFirstAtMs } from '#gw2/platform/engine/effects/timelines.js';
import { projectCastRelativeEffectTimingMs } from '#gw2/platform/skills/timing.js';
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT
} from '#gw2/content/professions/necromancer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type {
  NecromancerCastContext,
  NecromancerCoreState,
  NecromancerEmissionContext,
  NecromancerQueryRuntime,
  NecromancerSchedulerContext,
  NecromancerSelfCondition,
  NecromancerSimulationEvent,
  NecromancerSkill
} from '#gw2/content/professions/necromancer/types.js';

const CORRUPTION_SELF_CONDITIONS = Object.freeze({
  [ID.CONSUME_CONDITIONS]: Object.freeze({
    base: Object.freeze([['Vulnerability', 5, 4]]),
    master: Object.freeze([['Vulnerability', 5, 4]])
  }),
  [ID.BLOOD_IS_POWER]: Object.freeze({
    base: Object.freeze([['Bleeding', 2, 10]]),
    master: Object.freeze([['Torment', 2, 10]])
  }),
  [ID.CORROSIVE_POISON_CLOUD]: Object.freeze({
    base: Object.freeze([['Weakness', 1, 6]]),
    master: Object.freeze([['Crippled', 1, 2]])
  }),
  [ID.PLAGUELANDS]: Object.freeze({
    base: Object.freeze([['Bleeding', 1, 10]]),
    master: Object.freeze([['Poisoned', 1, 4]])
  })
});

// Rebuild the combat query at the application timestamp so relic and trait duration effects use historical state.
function conditionDurationMultiplier(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  condition: string,
  at: number
): number {
  const event: NecromancerSimulationEvent = {
    type: 'self_condition',
    at,
    skillId: skill.id,
    skillName: skill.name,
    source: 'necromancer',
    sourceId: skill.id,
    actorType: 'player',
    condition,
    selfCondition: true
  };
  const traits = selectedGw2TraitValues(context.config, context.catalog);
  const historicalRelicContext = {
    relic: createRelicTimelineRuntime(context.config.relic, context.events)
  };
  const query = createGw2CombatQuery({
    profession: context.profession,
    config: context.config,
    events: context.events,
    traits,
    conditionDurationBonus: (runtime, time) =>
      relicConditionDurationBonus(runtime?.relic ? runtime : historicalRelicContext, time)
  });
  // Expertise does not extend Necromancer self-inflicted conditions. Other
  // duration bonuses still apply, matching the in-game corruption behavior.
  const stats = {
    ...query.statsAt(at, event, context.state as unknown as NecromancerQueryRuntime),
    expertise: 0
  };
  return query.conditionDurationMultiplier(
    condition,
    at,
    stats,
    event,
    context.state as unknown as NecromancerQueryRuntime
  );
}

/** Removes expired or not-yet-active self-condition applications and returns the remaining active set. */
export function purgeNecromancerSelfConditions(state: NecromancerCoreState, at: number): NecromancerSelfCondition[] {
  state.selfConditions = (state.selfConditions || []).filter(
    (application) => application.appliedAt <= at && application.expiresAt > at
  );
  return state.selfConditions;
}

/** Removes up to the requested number of distinct active self-condition types. */
export function removeNecromancerSelfCondition(
  state: NecromancerCoreState,
  at: number,
  maximumConditionTypes = 1
): number {
  const active = purgeNecromancerSelfConditions(state, at);
  const selected = new Set<string>();
  for (const application of active) {
    if (selected.size >= maximumConditionTypes) break;
    selected.add(application.condition);
  }

  state.selfConditions = active.filter((application) => !selected.has(application.condition));
  return selected.size;
}

/** Records a duration-scaled self-condition and emits the canonical state event used by later transfers. */
export function applyNecromancerSelfCondition(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  condition: string,
  stacks: number,
  duration: number,
  at = context.effectiveEnd
): NecromancerSelfCondition | null {
  const effectiveDuration =
    Math.max(0, Number(duration || 0)) * conditionDurationMultiplier(context, skill, condition, at);
  if (!(effectiveDuration > 0) || !(Number(stacks) > 0)) return null;
  const application: NecromancerSelfCondition = {
    condition,
    stacks: Number(stacks),
    appliedAt: at,
    expiresAt: at + effectiveDuration,
    sourceSkillId: skill.id,
    sourceSkillName: skill.name
  };
  // Persist before emission so reactions observing the event see the newly active application.
  purgeNecromancerSelfConditions(professionCoreState(context), at);
  professionCoreState(context).selfConditions.push(application);
  context.emit({
    type: 'self_condition',
    at,
    source: 'necromancer',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    name: `${skill.name} — self ${condition}`,
    condition,
    stacks: Number(stacks),
    duration: effectiveDuration,
    expiresAt: application.expiresAt
  });
  return application;
}

// Preserve the remaining duration and source attribution when converting a self-condition into a target packet.
function emitTransferredApplication(
  context: NecromancerEmissionContext,
  skill: NecromancerSkill,
  application: NecromancerSelfCondition,
  at: number
): void {
  const duration = application.expiresAt - at;
  const common = {
    at,
    source: 'necromancer',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    name: `${skill.name} — Transferred ${application.condition}`,
    stacks: application.stacks,
    duration,
    fixedDuration: true,
    transferredCondition: true,
    transferredFromSkillId: application.sourceSkillId
  } as const;
  // Emit through the canonical condition path so damaging and non-damaging applications resolve uniformly.
  emitSkillCondition(context, {
    ...common,

    condition: application.condition,
    nonDamaging: !isDamagingCondition(application.condition)
  });
}

/** Transfers eligible active self-conditions to the target and removes the source applications. */
export function transferNecromancerSelfConditions(
  context: NecromancerEmissionContext,
  skill: NecromancerSkill,
  maximumConditionTypes: number,
  at = context.effectiveEnd ?? context.state.time,
  {
    latestApplications = false
  }: {
    readonly latestApplications?: boolean;
  } = {}
): number {
  const state = professionCoreState(context);
  const active = purgeNecromancerSelfConditions(state, at);
  // Plague Sending consumes the newest applications regardless of condition type.
  if (latestApplications) {
    const transferred = active.slice(-maximumConditionTypes);
    if (!transferred.length) return 0;
    const retained = new Set(transferred);
    state.selfConditions = active.filter((application) => !retained.has(application));
    for (const application of transferred) {
      emitTransferredApplication(context, skill, application, at);
    }

    return transferred.length;
  }

  // Ordinary transfers select the oldest distinct condition types and move every stack of each selected type.
  const selected = new Set<string>();
  for (const application of active) {
    if (selected.size >= maximumConditionTypes) break;
    selected.add(application.condition);
  }

  if (!selected.size) return 0;
  const transferred = active.filter((application) => selected.has(application.condition));
  state.selfConditions = active.filter((application) => !selected.has(application.condition));
  for (const application of transferred) {
    emitTransferredApplication(context, skill, application, at);
  }

  return transferred.length;
}

// Apply a corruption skill's base and trait-added self-conditions, then resolve any armed Plague Sending transfer.
function corruption(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  if (skill.id === ID.BLOOD_IS_POWER) {
    const strike = skill.effects?.find((effect) => effect.type === 'strike' && effectFirstAtMs(effect) != null);
    const atMs = strike?.type === 'strike' ? effectFirstAtMs(strike) : undefined;
    const runtimeCastMs = Math.max(0, context.fullEnd - context.start) * 1000;
    const strikeAtMs =
      strike?.timingScale === 'cast'
        ? projectCastRelativeEffectTimingMs(skill, runtimeCastMs, Number(atMs))
        : Number(atMs ?? runtimeCastMs);
    // Declarative packets are discarded after this handler runs, so suppress self-corruption when no strike committed.
    if (Math.round((context.effectiveEnd - context.start) * 1000) < Math.round(strikeAtMs)) return false;
  }

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
  // Base corruptions always land before Master of Corruption additions so transfer order stays deterministic.
  for (const application of mechanics.base) {
    applyNecromancerSelfCondition(
      context,
      skill,
      String(application[0]),
      Number(application[1]),
      Number(application[2])
    );
  }

  if (hasTrait(context, TRAIT.MASTER_OF_CORRUPTION)) {
    for (const application of mechanics.master) {
      applyNecromancerSelfCondition(
        context,
        skill,
        String(application[0]),
        Number(application[1]),
        Number(application[2])
      );
    }
  }

  // An armed shroud transfer consumes the newest corruption applications from this cast first.
  if (professionCoreState(context).plagueSendingArmed) {
    const transferred = transferNecromancerSelfConditions(context, skill, 2, context.effectiveEnd, {
      latestApplications: true
    });
    if (transferred) {
      professionCoreState(context).plagueSendingArmed = false;
      professionCoreState(context).plagueSendingEntrySkillId = null;
    }
  }

  if (skill.id === ID.BLOOD_IS_POWER) {
    emitSkillBuff(context, skill, {
      at: context.effectiveEnd,
      kind: 'might',
      duration: 20,
      stacks: 5,
      recipients: 'party',
      maximumRecipients: 5
    });
  }

  return false;
}

// Route each transfer skill to its distinct-condition limit.
function transfer(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const maximum = (
    {
      [ID.PLAGUE_SIGNET]: 5,
      [ID.DEATHLY_SWARM]: 2,
      [ID.PUTRID_MARK]: 3,
      [ID.SUFFER]: 2
    } as Readonly<Record<string | number, number>>
  )[skill.id];
  if (!maximum) return false;
  transferNecromancerSelfConditions(context, skill, maximum);
  return false;
}

// Apply Life Siphon's self-bleed once on the first resolved strike packet.
function lifeSiphonSelfBleed(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  event: NecromancerSimulationEvent
): void {
  if (event?.type !== 'damage' || Number(event.hitIndex || 1) !== 1) return;
  applyNecromancerSelfCondition(context, skill, 'Bleeding', 1, 8, event.at);
}

// Apply Dark Pact's self-bleed and immobilize only after its first strike confirms a hit.
function darkPactOnHit(
  context: NecromancerCastContext,
  skill: NecromancerSkill,
  event: NecromancerSimulationEvent
): void {
  if (event?.type !== 'damage' || Number(event.hitIndex || 1) !== 1) return;
  applyNecromancerSelfCondition(context, skill, 'Bleeding', 2, 10, event.at);
  emitSkillCondition(context, skill, {
    at: event.at,
    condition: 'Immobilized',
    stacks: 1,
    duration: 6
  });
}

// Scale Devouring Darkness torment by the configured number of target conditions, capped at five.
function devouringDarkness(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const impactAt = context.start + (context.fullEnd - context.start) * 0.8;
  const count = Math.min(
    5,
    Object.values(context.config.target?.conditions || {}).filter((value) => value === true || Number(value) > 0).length
  );
  emitSkillDamage(context, skill, { at: impactAt, coefficient: 1.16 });
  if (count > 0) {
    emitSkillCondition(context, skill, { at: impactAt, condition: 'Torment', stacks: count, duration: 4 });
  }

  return true;
}

/** Transfers Plague Sending conditions on the first eligible player strike after the trait is armed. */
export function observeNecromancerPlagueSendingEvent(
  context: NecromancerSchedulerContext,
  event: NecromancerSimulationEvent
): void {
  const state = professionCoreState(context);
  if (
    !state.plagueSendingArmed ||
    event.type !== 'damage' ||
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0)
  )
    return;
  const skill = event.skillId == null ? undefined : context.catalog.skillsById.get(event.skillId);
  if (!skill || Number(state.plagueSendingEntrySkillId) === Number(event.skillId)) return;
  const transferred = transferNecromancerSelfConditions(context, skill, 2, event.at, { latestApplications: true });
  if (!transferred) return;
  state.plagueSendingArmed = false;
  state.plagueSendingEntrySkillId = null;
}

/** Maps condition-manipulation handler keys to their cast and on-hit implementations. */
export const necromancerConditionSkillHandlers = Object.freeze({
  'necromancer.corruption': corruption,
  'necromancer.condition-transfer': transfer,
  'necromancer.life-siphon': lifeSiphonSelfBleed,
  'necromancer.dark-pact': darkPactOnHit,
  'necromancer.devouring-darkness': devouringDarkness
});
