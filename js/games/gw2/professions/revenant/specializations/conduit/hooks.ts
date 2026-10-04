import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { gw2CooldownReadyAt } from '#gw2/platform/execution/cast-timing.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { activeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { completeRevenantCastTraits } from '#gw2/professions/revenant/core/traits/dispatch.js';
import { beguilingHazeCastDuration } from '#gw2/professions/revenant/data/beguiling-haze-timing.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import {
  REVENANT_CONDUIT_FORM_BY_LEGEND,
  REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND
} from '#gw2/professions/revenant/data/legends.js';
import { isRevenantUpkeep } from '#gw2/professions/revenant/data/upkeep-skills.js';
import { revenantEnergyCost } from '#gw2/professions/revenant/family-state.js';
import { gainAffinity } from '#gw2/professions/revenant/specializations/conduit/mechanics/affinity.js';
import {
  FORM_EXPIRY,
  scheduleFormExpiry
} from '#gw2/professions/revenant/specializations/conduit/mechanics/form-expiry.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import {
  BEGUILING_HAZE_SKILL_IDS,
  TWIN_MOON_SKILL_IDS
} from '#gw2/professions/revenant/specializations/conduit/skill-groups.js';
import {
  cleanseHexEater,
  completeBeguilingHaze
} from '#gw2/professions/revenant/specializations/conduit/skills/entity-skills.js';
import { conduitState, revenantConduitFormIsActive } from '#gw2/professions/revenant/specializations/conduit/state.js';
import {
  effectiveConduitAffinity,
  emitCosmicMistfire,
  enhancedLegendRecharge,
  extendEnhancedEmbodiment,
  grantConductiveArmaments,
  grantFoundPurpose,
  grantLingeringDetermination,
  kineticInsightRecharge
} from '#gw2/professions/revenant/specializations/conduit/traits/behavior.js';
import { numinousGift } from '#gw2/professions/revenant/specializations/conduit/traits/numinous-gift.js';
import { completionSharedWisdom } from '#gw2/professions/revenant/specializations/conduit/traits/shared-wisdom.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const UPKEEP_AFFINITY = 'revenant.conduit-upkeep-affinity';

const UPKEEP_DAGGERS = 'revenant.conduit-upkeep-daggers';

const MESMER_RELEASE = 'revenant.release-mesmer-conditions';

const RELEASE_POTENTIAL_IDS = new Set<SkillId>(Object.values(REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND));

// A cast started in Dervish form keeps its scythe through form expiry or a concurrent legend swap.
const dervishCasts = new WeakSet<RuntimeCast<RevenantSkill>>();

function conduit(runtime: RevenantRuntime) {
  return conduitState.from(runtime);
}

function lesserDaggers(runtime: RevenantRuntime, source: Skill, cause?: Gw2ResolverEvent): void {
  if (!revenantConduitFormIsActive(conduit(runtime), 'Assassin', runtime.time)) return;
  const skill = runtime.helpers.skillsById.get(ID.LESSER_ENCHANTED_DAGGERS);
  if (!skill) throw new Error('Missing Lesser Enchanted Daggers skill declaration.');
  const hit = requireEffect(skill, 'strike', 'Lesser Enchanted Daggers');
  if (!hit) return;
  // Form procs retain player modifiers without recursively triggering player on-hit attacks.
  runtime.effects.emit({
    kind: 'profile',
    profile: skill,
    effects: [hit],
    attribution: {
      source: 'revenant',
      sourceId: skill.id,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      triggeredBy: source.name
    },
    cause,
    transform: (event) => ({
      ...event,
      name: 'Lesser Enchanted Daggers',
      skillWeapon: 'Unequipped',
      icon: skill.icon || ''
    })
  });
}

function dervishAttack(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>, at: number, elite = false): void {
  const skillId = elite ? ID.FORM_OF_THE_DERVISH_ATTACK_ELITE : ID.FORM_OF_THE_DERVISH_ATTACK;
  const attack = runtime.helpers.skillsById.get(skillId);
  if (!attack) throw new Error('Missing Form of the Dervish attack skill ' + skillId + '.');
  const name = elite ? 'Form of the Dervish (Attack - Elite)' : 'Form of the Dervish (Attack)';
  const hit = requireEffect(attack, 'strike', name);
  if (!hit) return;
  // A removed scythe leaves no attack; surviving hits keep their authored sequence.
  runtime.effects.emit({
    kind: 'profile',
    profile: attack,
    effects: [hit],
    at,
    attribution: {
      source: 'revenant',
      sourceId: attack.id,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: attack.id,
      skillName: 'Form of the Dervish',
      activationId: cast.id,
      triggeredBy: cast.skill.name
    },
    transform: (event) => ({ ...event, name, skillWeapon: 'Unequipped', icon: attack.icon || '' })
  });
}

/** Schedule affinity-sensitive Mesmer conditions independently of its ordinary strike and daze. */
function scheduleMesmerReleaseConditions(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  for (const effect of cast.skill.effects ?? []) {
    if (effect.type !== 'condition') continue;
    for (const { event } of materializeSkillEffectApplications({
      skill: cast.skill,
      effect,
      start: cast.start,
      fullEnd: cast.fullEnd,
      reactionGroup: effect.reactions === undefined ? undefined : runtime.effectReactions.register(cast.skill, effect),
      baseEvent: {
        source: 'revenant',
        sourceId: cast.skill.id,
        actorType: 'player',
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        activationId: cast.id
      }
    }))
      runtime.schedule(MESMER_RELEASE, event.at, {
        event,
        durationPerAffinity: effect.durationPerAffinity ?? 0,
        durationReductionPerAffinity: effect.durationReductionPerAffinity ?? 0
      });
  }
}

/** Mesmer release Torment scales with impact-time affinity; one simulated enemy applies self-Torment once. */
function mesmerRelease(runtime: RevenantRuntime, data: unknown): void {
  const { event, durationPerAffinity, durationReductionPerAffinity } = data as {
    event: SimulationEventBase;
    durationPerAffinity: number;
    durationReductionPerAffinity: number;
  };
  const affinity = effectiveConduitAffinity(runtime);
  if (event.target === 'self') {
    const duration = Number(event.duration) * Math.max(0, 1 - affinity * durationReductionPerAffinity);
    runtime.profession.core.selfConditions.push({
      condition: String(event.condition),
      stacks: Number(event.stacks),
      at: event.at,
      expiresAt: event.at + duration,
      sourceId: event.sourceId,
      skillName: String(event.skillName)
    });
    return;
  }

  runtime.effects.emit({
    kind: 'packet',
    event: { ...event, duration: Number(event.duration) * (1 + affinity * durationPerAffinity) }
  });
}

/** Mesmer form overrides these canonical Demon skills' Energy costs; other forms use native costs. */
const MESMER_FORM_COSTS = [
  [ID.EMPOWERING_MISERY, PROFILE.mesmerEmpoweringMisery],
  [ID.PAIN_ABSORPTION, PROFILE.mesmerPainAbsorption],
  [ID.BANISH_ENCHANTMENT, PROFILE.mesmerBanishEnchantment],
  [ID.CALL_TO_ANGUISH, PROFILE.mesmerCallToAnguish],
  [ID.UNYIELDING_IMPACT, PROFILE.mesmerUnyieldingImpact],
  [ID.EMBRACE_THE_DARKNESS, PROFILE.mesmerEmbraceTheDarkness]
] as const;

/** Expired or removed windows clear the form immediately and restore native costs. */
function syncConduitEnergyCostOverrides(runtime: RevenantRuntime): void {
  const state = conduit(runtime);
  if (state.cosmicWisdomUntil <= runtime.time) {
    state.cosmicWisdomUntil = 0;
    state.conduitForm = '';
  }

  state.energyCostOverrides = revenantConduitFormIsActive(state, 'Mesmer', runtime.time)
    ? Object.fromEntries(
        MESMER_FORM_COSTS.map(([skillId, profileId]) => [
          skillId,
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, profileId), 'energyCost')
        ])
      )
    : {};
}

/** Form expiry clears the form and restores native Energy costs, unless an extension moved the deadline. */
function formExpiry(runtime: RevenantRuntime, data: unknown): void {
  const state = conduit(runtime);
  if (state.cosmicWisdomUntil !== (data as { until: number }).until) return;
  state.cosmicWisdomUntil = 0;
  state.conduitForm = '';
  syncConduitEnergyCostOverrides(runtime);
}

/** Cosmic Wisdom resolves Mistfire, then opens the current legend's form and grants Numinous Gift. */
function cosmicWisdom(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const state = conduit(runtime);
  emitCosmicMistfire(runtime, cast);

  const window = requireEffect(cast.skill, 'buff', 'cosmic-wisdom');
  // Only a positive window activates a form; the independent Numinous Gift still resolves.
  state.cosmicWisdomUntil = canonicalTime(
    runtime.time + (window ? Math.max(0, effectNumber(cast.skill, window, 'duration')) : 0)
  );
  state.conduitForm = REVENANT_CONDUIT_FORM_BY_LEGEND[runtime.profession.core.activeLegendId] || '';
  syncConduitEnergyCostOverrides(runtime);
  scheduleFormExpiry(runtime);
  numinousGift(runtime, cast);
}

/** Legend swaps reset affinity, extend and re-select the form, and share Found Purpose. */
function swapLegend(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const state = conduit(runtime);
  const core = runtime.profession.core;
  const combat = runtime.combatStartedAt();
  // The form state before the reset decides Enhanced Embodiment and the form update.
  const formActive = state.cosmicWisdomUntil > runtime.time;
  state.affinity = 0;
  grantLingeringDetermination(runtime, combat);
  extendEnhancedEmbodiment(runtime, formActive);

  if (formActive) {
    state.conduitForm = REVENANT_CONDUIT_FORM_BY_LEGEND[core.activeLegendId] || '';
    syncConduitEnergyCostOverrides(runtime);
  }

  // Found Purpose shares invocation boons only once combat has started.
  grantFoundPurpose(runtime, cast, combat);
}

/** Each committed Energy-costing legend or armed weapon cast builds affinity at acceptance. */
function costAffinity(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const skill = cast.skill;
  const cost = revenantEnergyCost(runtime, skill);
  if (!(cost > 0)) return;
  // Legend skills whose affinity is deferred to hit time are excluded to avoid double-granting.
  if (skill.legendId && !skill.affinityOnHit) gainAffinity(runtime, cost >= 25 ? 2 : 1);
  else grantConductiveArmaments(runtime, skill);
}

/** Upkeep cadences grant affinity and Impossible Odds' Assassin daggers while their activation remains. */
function upkeepAffinity(runtime: RevenantRuntime, data: unknown): void {
  const { skillId, startsAt } = data as { skillId: SkillId; startsAt: number };
  if (!activeRevenantUpkeep(runtime, skillId, startsAt) || !runtime.helpers.skillsById.has(skillId)) return;
  gainAffinity(runtime, 1);
  runtime.schedule(UPKEEP_AFFINITY, canonicalTime(runtime.time + 3), data, undefined, -200);
}

function upkeepDaggers(runtime: RevenantRuntime, data: unknown): void {
  const { skillId, startsAt } = data as { skillId: SkillId; startsAt: number };
  const skill = runtime.helpers.skillsById.get(skillId);
  if (!activeRevenantUpkeep(runtime, skillId, startsAt) || !skill) return;
  lesserDaggers(runtime, skill);
  runtime.schedule(UPKEEP_DAGGERS, canonicalTime(runtime.time + 1), data, undefined, -190);
}

export const conduitHooks: RuntimeHooks<RevenantRuntimeState, RevenantSkill> = {
  // Passive affinity accrual does not extend damage observation; damaging dagger upkeep remains bounded normally.
  backgroundTasks: [UPKEEP_AFFINITY],
  // Control-triggered Burning shares Mistfire's profile, excluding its own Twin Moon chain.

  availability(runtime, skill) {
    const state = conduitState.from(runtime);
    if (BEGUILING_HAZE_SKILL_IDS.has(skill.id)) {
      // Project the shared recharge without mutating state during an availability query.
      const readyAt = state.beguilingHazeRecharge
        ? gw2CooldownReadyAt(runtime.cooldownController.project(skill, state.beguilingHazeRecharge))
        : state.beguilingHazeReadyAt;
      if ((state.beguilingHazeCharges || 0) <= 0 && runtime.time < (readyAt || 0))
        return denySkillCast(skill, 'revenant.beguiling-haze-cooldown', 'Beguiling Haze is recharging.', readyAt);
    }

    // All five variants share one bar slot; block the variant the active legend does not supply.
    if (
      RELEASE_POTENTIAL_IDS.has(skill.id) &&
      REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND[runtime.profession.core.activeLegendId] !== skill.id
    )
      return denySkillCast(
        skill,
        'revenant.release-variant',
        'the active legend supplies a different Release Potential variant.'
      );
    return { ready: true };
  },
  castDurationMs(runtime, skill, durationMs) {
    if (!BEGUILING_HAZE_SKILL_IDS.has(skill.id)) return durationMs;
    const specialization = runtime.profession.specialization;
    if (specialization.kind !== 'Conduit') throw new TypeError('Beguiling Haze requires Conduit state.');
    return (
      beguilingHazeCastDuration(
        durationMs / 1000,
        (specialization.state.beguilingHazeCharges || 0) > 0,
        requireBalanceProfileFromContext(runtime, PROFILE.beguilingHazeFollowUp),
        requireBalanceProfileFromContext(runtime, PROFILE.beguilingHazeMainCastExtension)
      ) * 1000
    );
  },
  rechargeWork(runtime, skill, work) {
    if (skill.id === ID.SWAP_LEGENDS) return enhancedLegendRecharge(runtime, skill, work);

    const mesmerProfile =
      skill.id === ID.PAIN_ABSORPTION
        ? PROFILE.mesmerPainAbsorption
        : skill.id === ID.BANISH_ENCHANTMENT
          ? PROFILE.mesmerBanishEnchantment
          : null;
    // Mesmer form gives these Demon utilities a recharge; Alacrity still applies to the new base.
    if (mesmerProfile && revenantConduitFormIsActive(conduitState.from(runtime), 'Mesmer', runtime.time))
      return Math.max(0, balanceProfileNumber(requireBalanceProfileFromContext(runtime, mesmerProfile), 'cooldown'));
    return kineticInsightRecharge(runtime, skill, work);
  },
  onCastStart(runtime, cast) {
    const skill = cast.skill;
    costAffinity(runtime, cast);
    if (skill.legendId === LEGEND.ENTITY && revenantConduitFormIsActive(conduit(runtime), 'Dervish', cast.start))
      dervishCasts.add(cast);
  },
  onCastCommit(runtime, cast) {
    const skill = cast.skill;
    // Cosmic Wisdom form procs follow successful casts through the common completion path.
    if (skill.legendId === LEGEND.ASSASSIN) lesserDaggers(runtime, skill);
    if (dervishCasts.has(cast)) {
      dervishAttack(runtime, cast, runtime.time);
      if (TWIN_MOON_SKILL_IDS.has(skill.id)) dervishAttack(runtime, cast, runtime.time, true);
    }

    dervishCasts.delete(cast);
    // Shared Wisdom Swiftness belongs only to Entity legend skills.
    if (skill.legendId === LEGEND.ENTITY) completionSharedWisdom(runtime, cast, 'entity-skill');

    if (skill.id === ID.SWAP_LEGENDS) swapLegend(runtime, cast);
    if (isRevenantUpkeep(skill) && activeRevenantUpkeep(runtime, skill.id, runtime.time)) {
      const data = { skillId: skill.id, startsAt: runtime.time };
      runtime.schedule(UPKEEP_AFFINITY, canonicalTime(runtime.time + 3), data, undefined, -200);
      if (skill.id === ID.IMPOSSIBLE_ODDS)
        runtime.schedule(UPKEEP_DAGGERS, canonicalTime(runtime.time + 1), data, undefined, -190);
    }
  },
  sideEffectHandlers: {
    'revenant.complete-haze'(runtime, context) {
      if (context.kind !== 'cast') return;
      // Shared Wisdom is already published; Core traits precede the shared-ammo transition.
      completeRevenantCastTraits(runtime, context.cast);
      completeBeguilingHaze(runtime, context.cast);
    },
    'revenant.hex-eater-cleanse'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Hex-Eater cleanse requires a cast.');
      cleanseHexEater(runtime, context.cast);
    },
    'revenant.mesmer-release'(runtime, context) {
      if (context.kind === 'cast') scheduleMesmerReleaseConditions(runtime, context.cast);
    },
    'revenant.cosmic-wisdom'(runtime, context) {
      if (context.kind !== 'cast') return;
      // Core cast traits must see the pre-form attributes before Cosmic Wisdom opens its form.
      completeRevenantCastTraits(runtime, context.cast);
      cosmicWisdom(runtime, context.cast);
    },
    'revenant.entity-hit-affinity'(runtime, context) {
      if (context.kind === 'effect') gainAffinity(runtime, (context.skill.energyCost || 0) >= 25 ? 2 : 1);
    }
  },
  onCooldownReset(runtime) {
    // A full cooldown reset makes Beguiling Haze immediately available.
    conduit(runtime).beguilingHazeReadyAt = runtime.time;
    conduit(runtime).beguilingHazeRecharge = null;
  },
  tasks: {
    [FORM_EXPIRY]: formExpiry,
    [UPKEEP_AFFINITY]: upkeepAffinity,
    [UPKEEP_DAGGERS]: upkeepDaggers,
    [MESMER_RELEASE]: mesmerRelease
  }
};
