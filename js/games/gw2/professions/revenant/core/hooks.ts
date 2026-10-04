import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { armSkillFlip, skillFlipReady, weaponFlipBlock } from '#gw2/platform/execution/skill-flips.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { AvailabilityResult, CastCommand } from '#gw2/platform/execution/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/occurrence-driver.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { emitBattleScar } from '#gw2/professions/revenant/core/mechanics/battle-scars.js';
import {
  completeRevenantEnchantedDaggers,
  emitEnchantedDagger
} from '#gw2/professions/revenant/core/mechanics/enchanted-daggers.js';
import { modifyRevenantLifeSiphon } from '#gw2/professions/revenant/core/mechanics/life-siphon.js';
import {
  activateRevenantUpkeep,
  clearRevenantLegendFlips,
  empowerRevenantEmbrace,
  reactRevenantImpossibleOdds,
  refreshRevenantStarvation,
  releaseRevenantUpkeep,
  removeRevenantUpkeep,
  REVENANT_ENERGY_DEPLETED,
  REVENANT_UPKEEP_PULSE,
  revenantUpkeepDrain,
  revenantUpkeepPulse,
  startRevenantEmbrace,
  starveRevenantUpkeeps
} from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import {
  completeRevenantCrushingAbyssSwap,
  completeRevenantImperialGuard,
  detonateRevenantBlossomingAura,
  reactRevenantSpearRecharge,
  REVENANT_ABYSSAL_RAZE,
  REVENANT_BLOSSOMING_AURA,
  revenantAbyssalRazeImpact,
  revenantBlossomingAuraPulse,
  startRevenantAbyssalRaze,
  startRevenantBlossomingAura,
  startRevenantImperialGuard
} from '#gw2/professions/revenant/core/mechanics/weapons.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/core/profiles.js';
import { REVENANT_MAXIMUM_ENDURANCE } from '#gw2/professions/revenant/core/state.js';
import {
  chargedMistsEnergy,
  completeRevenantBrutality,
  enduringRecoveryBonus,
  REVENANT_ASSASSINS_PRESENCE,
  revenantAssassinsPresencePulse,
  startRevenantAssassinsPresence
} from '#gw2/professions/revenant/core/traits/behavior.js';
import {
  applyRevenantInvocationTraits,
  completeRevenantCastTraits,
  reactRevenantConditionTraits,
  reactRevenantPlayerStrike
} from '#gw2/professions/revenant/core/traits/dispatch.js';
import { REVENANT_SKILL_IDS as DAMAGE_SKILL, REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { isLegalRevenantLegendId } from '#gw2/professions/revenant/data/legends.js';
import {
  isRevenantUpkeep,
  isRevenantUpkeepRelease,
  revenantUpkeepConsumeId
} from '#gw2/professions/revenant/data/upkeep-skills.js';
import { VINDICATOR_JUMP_SKILL } from '#gw2/professions/revenant/data/vindicator-jump.js';
import { revenantEnergyCost } from '#gw2/professions/revenant/family-state.js';
import type { RevenantConfig, RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { EPSILON } from '#kernel/core/clock.js';

// Custom Core owners emit these skills' packets from live state; their authored effects are templates only.
const CUSTOM_EFFECT_SKILL_IDS = new Set<SkillId>([
  ID.BLOSSOMING_AURA,
  ID.DETONATE_BLOSSOMING_AURA,
  ID.ENCHANTED_DAGGERS,
  ID.ABYSSAL_RAZE
]);

const DODGE_IDS = new Set<SkillId>([SHARED_SKILL_IDS.DODGE, VINDICATOR_JUMP_SKILL.id]);

// Deferred upkeep costs are immutable acceptance facts, spent only if the activation commits.
const upkeepCosts = new WeakMap<RuntimeCast<RevenantSkill>, number>();

/** Releases are identified through the live catalog's upkeep parents. */
function upkeepRelease(runtime: MechanicQueriesOf<RevenantRuntime>, skill: Skill): boolean {
  return isRevenantUpkeepRelease(skill, (id) => runtime.helpers.skillsById.get(id));
}

function resourceProfile(runtime: RevenantRuntime) {
  return requireBalanceProfileFromContext(runtime, PROFILE.resources);
}

/** Capacity is distinct from the precombat recovery ceiling, which never discards larger grants. */
const revenantEnergy: ResourcePolicy<RevenantRuntime> = {
  kind: 'continuous',
  state: (runtime) => runtime.profession.core.energy,
  maximum: () => 100,
  initial: (runtime) => (runtime.config as RevenantConfig).initialEnergy ?? 50,
  recovery: (runtime) =>
    balanceProfileNumber(resourceProfile(runtime), 'energyRegenerationPerSecond') - revenantUpkeepDrain(runtime),
  recoveryMaximum: (runtime) => (runtime.profession.core.combatBeganAt == null ? 50 : 100),
  depletion: { refresh: refreshRevenantStarvation, stop: refreshRevenantStarvation }
};

/** Vigor and Enduring Recovery add together; Vindicator shares the ten-per-second cap. */
export function revenantEnduranceRate(runtime: RevenantRuntime, vigor: boolean): number {
  const profile = resourceProfile(runtime);
  const enduring = enduringRecoveryBonus(runtime);
  return Math.min(
    10,
    balanceProfileNumber(profile, 'enduranceRegenerationPerSecond') *
      ((vigor ? balanceProfileNumber(profile, 'vigorRegenerationMultiplier') : 1) + enduring)
  );
}

const revenantEndurance: EndurancePolicy<RevenantRuntime> = {
  state: (runtime) => runtime.profession.core,
  maximum: () => REVENANT_MAXIMUM_ENDURANCE,
  regenerationRate: (runtime, vigor) => revenantEnduranceRate(runtime, vigor)
};

/** Legend, flip, upkeep, endurance, and Energy gates read the one live state at the current instant. */
function revenantAvailability(
  runtime: MechanicQueriesOf<RevenantRuntime>,
  skill: Skill,
  _command: CastCommand
): AvailabilityResult {
  const core = runtime.profession.core;
  const flips = core.availableFlips;
  const now = runtime.time;
  if (skill.id === ID.UNYIELDING_IMPACT && !skillFlipReady(flips[ID.UNYIELDING_IMPACT], now))
    return denySkillCast(skill, 'revenant.unyielding-impact-inactive', 'cast Call to Anguish first.');
  if (skill.id === ID.CALL_TO_ANGUISH && skillFlipReady(flips[ID.UNYIELDING_IMPACT], now))
    return denySkillCast(skill, 'revenant.unyielding-impact-ready', 'use Unyielding Impact first.');
  if (skill.id === ID.TRUE_STRIKE && !skillFlipReady(flips[ID.TRUE_STRIKE], now))
    return denySkillCast(skill, 'revenant.imperial-guard-inactive', 'channel Imperial Guard first.');
  if (skill.id === ID.IMPERIAL_GUARD && skillFlipReady(flips[ID.TRUE_STRIKE], now))
    return denySkillCast(skill, 'revenant.true-strike-ready', 'use or let True Strike expire first.');
  // True Strike and Imperial Guard already answered above with their channel-specific reasons.
  const flipBlock = weaponFlipBlock(flips, runtime.helpers.skillsById, skill, now);
  if (flipBlock?.kind === 'closed')
    return denySkillCast(skill, 'revenant.weapon-flip-inactive', `use ${flipBlock.parent.name} first.`);
  if (flipBlock?.kind === 'open')
    return denySkillCast(skill, 'revenant.weapon-flip-active', 'use or wait out the active follow-up skill.');
  if (skill.id === ID.SWAP_LEGENDS) {
    const specialization = runtime.config.specialization || 'Core';
    return core.selectedLegendIds.length !== 2 ||
      core.selectedLegendIds.some((legendId) => !isLegalRevenantLegendId(legendId, specialization))
      ? denySkillCast(skill, 'revenant.legend-pair', 'select two legal legends.')
      : { ready: true };
  }

  if (skill.legendId && skill.legendId !== core.activeLegendId)
    return denySkillCast(skill, 'revenant.inactive-legend', 'invoke the matching legend first.');
  if (upkeepRelease(runtime, skill) && !skillFlipReady(flips[skill.id], now))
    return denySkillCast(skill, 'revenant.upkeep-inactive', 'activate the matching upkeep skill first.');
  if (isRevenantUpkeep(skill) && core.activeUpkeeps.some((upkeep) => upkeep.skillId === skill.id))
    return denySkillCast(skill, 'revenant.upkeep-active', 'use the matching release skill.');
  const cost = revenantEnergyCost(runtime, skill);
  const energy = runtime.resourceController.value('energy');
  const energyReadyAt =
    energy + EPSILON < cost && core.combatBeganAt == null ? null : runtime.resourceController.readyAt('energy', cost);
  // A fractional balance can cross a cost between action ticks; wait until the shared grid permits spending it.
  if (energy + EPSILON < cost || (energyReadyAt != null && energyReadyAt > now + EPSILON)) {
    const cooldownReadyAt = runtime.cooldownController.readyAt(skill.id) || 0;
    return denySkillCast(
      skill,
      'revenant.insufficient-energy',
      `requires ${cost} energy.`,
      cooldownReadyAt > now + EPSILON ? cooldownReadyAt : energyReadyAt
    );
  }

  return { ready: true };
}

/** Swapping legends resets Energy, keeps cross-legend upkeeps with a destination consume, and invokes traits. */
function swapLegend(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const core = runtime.profession.core;
  const previous = runtime.resourceController.value('energy');
  core.activeLegendId = core.selectedLegendIds.find((id) => id !== core.activeLegendId) || core.activeLegendId;
  core.activeLoadoutId = core.activeLegendId;
  const energy = chargedMistsEnergy(runtime, cast, previous);
  if (energy > previous) runtime.resourceController.grant('energy', energy - previous);
  else if (energy < previous) runtime.resourceController.spend('energy', previous - energy);
  clearRevenantLegendFlips(runtime);
  for (const active of [...core.activeUpkeeps]) {
    const upkeep: RevenantSkill | undefined = runtime.helpers.skillsById.get(active.skillId);
    // Only a declared cross-legend relationship retains an upkeep after a swap.
    const consumeId =
      upkeep?.upkeepConsumeByLegendId != null ? revenantUpkeepConsumeId(upkeep, core.activeLegendId) : undefined;
    if (consumeId != null) armSkillFlip(core.availableFlips, consumeId, runtime.time);
    else removeRevenantUpkeep(runtime, active.skillId);
  }

  runtime.resourceController.refresh('energy');
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'sigil_swap',
      at: runtime.time,
      source: 'revenant',
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      weaponSet: runtime.activeWeaponSet
    }
  });
  applyRevenantInvocationTraits(runtime);
}

/** Core hooks: Energy, upkeeps, legends, weapon follow-ups, and actual hit/application trait reactions. */
import { revenantBuffPolicies, revenantEffectStates } from '#gw2/professions/revenant/core/effect-state.js';

export const revenantCoreHooks: RuntimeHooks<RevenantRuntimeState, RevenantSkill> = {
  // Known damage payloads are invoked once without their activation requirements.
  damageEffects: [
    {
      id: 'battle-scars',
      name: 'Battle Scars',
      source: 'Profession',
      unit: 'charge',
      sourceIds: ['revenant.battle-scars'],
      emit: (runtime) => emitBattleScar(runtime, damageInputEvent(runtime))
    },
    {
      id: 'enchanted-daggers',
      name: 'Enchanted Daggers',
      source: 'Profession',
      unit: 'charge',
      sourceIds: [DAMAGE_SKILL.ENCHANTED_DAGGERS],
      emit: (runtime) => emitEnchantedDagger(runtime, damageInputEvent(runtime))
    }
  ],

  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, inputs) {
    const state = runtime.profession.core;
    if (skill?.legendId) {
      state.activeLegendId = skill.legendId;
      state.activeLoadoutId = skill.legendId;
    }

    const upkeep = runtime.helpers.skills.find(
      (entry) => entry.id === inputs.upkeepSkillId && entry.upkeepCost != null
    );
    if (upkeep)
      state.activeUpkeeps = [{ skillId: upkeep.id, upkeepCost: Number(upkeep.upkeepCost), empoweredNextPulse: false }];
  },

  buffPolicies: revenantBuffPolicies,
  observeEffects: revenantEffectStates,
  // Base-second reductions remain with the cooldown controller, including partial-ammo progress.
  sideEffectHandlers: {
    'revenant.imperial-guard'(runtime, context) {
      if (context.kind === 'cast') startRevenantImperialGuard(runtime, context.cast);
    },
    'revenant.enchanted-daggers'(runtime, context) {
      if (context.kind === 'cast') completeRevenantEnchantedDaggers(runtime, context.cast);
    },
    'revenant.blossoming-aura'(runtime, context) {
      if (context.kind === 'cast') startRevenantBlossomingAura(runtime, context.cast);
    },
    'revenant.detonate-aura'(runtime, context) {
      if (context.kind === 'cast') detonateRevenantBlossomingAura(runtime, context.cast);
    },
    'revenant.abyssal-raze'(runtime, context) {
      if (context.kind === 'cast') startRevenantAbyssalRaze(runtime, context.cast);
    },
    'revenant.embrace-opening'(runtime, context) {
      if (context.kind === 'cast') startRevenantEmbrace(runtime, context.cast);
    },
    'revenant.release-upkeep'(runtime, context) {
      if (context.kind === 'cast') releaseRevenantUpkeep(runtime, context.cast);
    },
    'revenant.swap-legends'(runtime, context) {
      if (context.kind === 'cast') swapLegend(runtime, context.cast);
    },
    // Reserve before activation, then pay before the upkeep changes live cost queries.
    'revenant.reserve-upkeep'(runtime, context) {
      if (context.kind === 'cast') upkeepCosts.set(context.cast, revenantEnergyCost(runtime, context.skill));
    },
    'revenant.activate-upkeep'(runtime, context) {
      if (context.kind !== 'cast') return;
      const cost = upkeepCosts.get(context.cast);
      upkeepCosts.delete(context.cast);
      if (cost != null) runtime.resourceController.spend('energy', cost);
      activateRevenantUpkeep(runtime, context.cast);
    },
    'revenant.spear-recharge'(runtime, context) {
      if (context.kind === 'effect') reactRevenantSpearRecharge(runtime, context.trigger.event);
    }
  },
  resources: { energy: revenantEnergy },
  endurance: revenantEndurance,
  initialize(runtime) {
    // Initial Crushing Abyss feeds the same expiring pool consumed by Raze and weapon swap.
    for (const buff of runtime.config.initialBuffs ?? []) {
      if (buff.kind !== 'crushing-abyss') continue;
      const skill = runtime.helpers.skillsById.get(ID.ABYSSAL_RAZE)!;
      runtime.profession.core.crushingAbyss = grantTimedStacks([], {
        at: runtime.time,
        expiresAt: runtime.time + buff.duration,
        count: buff.stacks,
        maximumStacks: Number(skill.maximumStacks),
        retain: 'latest-expiry'
      });
    }

    startRevenantAssassinsPresence(runtime, runtime.time);
  },
  onCombatStart(runtime) {
    // Accepted combat raises the recovery ceiling; an authored marker also re-anchors Assassin's Presence.
    runtime.profession.core.combatBeganAt = runtime.time;
    runtime.resourceController.refresh('energy');
    if (runtime.hasExplicitCombatStart) startRevenantAssassinsPresence(runtime, runtime.time);
  },
  availability: revenantAvailability,
  // Legend swaps stay free during setup until combat is established, like the runtime's weapon swaps.
  rechargeWork: (runtime, skill, work) => (skill.id === ID.SWAP_LEGENDS && !runtime.combatActive ? 0 : work),
  modifyEffects(runtime, cast, effects) {
    if (CUSTOM_EFFECT_SKILL_IDS.has(cast.skill.id) || isRevenantUpkeep(cast.skill)) return [];
    if (upkeepRelease(runtime, cast.skill)) return [];
    return effects;
  },
  onCastStart(runtime, cast) {
    const skill = cast.skill;
    if (DODGE_IDS.has(skill.id)) return;
    if (!isRevenantUpkeep(skill) && skill.id !== ID.SWAP_LEGENDS)
      runtime.resourceController.spend('energy', revenantEnergyCost(runtime, skill));
  },
  onCastCancel(runtime, cast) {
    // A cancelled follow-up consumes its armed window without paying upkeep or granting cast rewards.
    upkeepCosts.delete(cast);
    completeRevenantImperialGuard(runtime, cast);
  },
  onCastCommit(runtime, cast) {
    const skill = cast.skill;
    if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) {
      completeRevenantCrushingAbyssSwap(runtime, cast);
      completeRevenantBrutality(runtime, cast);
    }

    completeRevenantCastTraits(runtime, cast);
    // Empower only after the paid skill commits, so a pulse during its windup cannot consume the bonus.
    empowerRevenantEmbrace(runtime, cast);
  },
  onCooldownReset(runtime) {
    // Restores in-combat Energy after the shared runtime resets cooldowns.
    if (!runtime.combatStartedAt()) return;
    runtime.resourceController.grant('energy', runtime.profession.core.energy.maximum);
  },
  // Resolver triggers retain trait ownership and the accepted event's causal chain.

  reactions: {
    'damage.resolving'(runtime, event) {
      return modifyRevenantLifeSiphon(runtime, event);
    },
    'damage.resolved'(runtime, event) {
      reactRevenantImpossibleOdds(runtime, event);
      reactRevenantPlayerStrike(runtime, event);
    },
    'condition.applied': reactRevenantConditionTraits
  },
  tasks: {
    [REVENANT_ENERGY_DEPLETED]: starveRevenantUpkeeps,
    [REVENANT_UPKEEP_PULSE]: revenantUpkeepPulse,
    [REVENANT_BLOSSOMING_AURA]: revenantBlossomingAuraPulse,
    [REVENANT_ABYSSAL_RAZE]: revenantAbyssalRazeImpact,
    [REVENANT_ASSASSINS_PRESENCE]: revenantAssassinsPresencePulse
  }
};
