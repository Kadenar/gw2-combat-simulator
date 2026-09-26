import { EPSILON } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { armSkillFlip, skillFlipReady, weaponFlipBlock } from '#gw2/platform/engine/skills/skill-flips.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { denySkillCast } from '#gw2/platform/engine/skills/availability.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { isLegalRevenantLegendId } from '#gw2/professions/revenant/data/legends.js';
import { VINDICATOR_JUMP_SKILL } from '#gw2/professions/revenant/data/vindicator-jump.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/core/profiles.js';
import { modifyRevenantLifeSiphon } from '#gw2/professions/revenant/core/mechanics/life-siphon.js';
import { revenantEnergyCost } from '#gw2/professions/revenant/family-state.js';
import { REVENANT_MAXIMUM_ENDURANCE } from '#gw2/professions/revenant/core/state.js';
import { isRevenantUpkeep, isRevenantUpkeepRelease } from '#gw2/professions/revenant/data/upkeep-skills.js';
import {
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
  starveRevenantUpkeeps,
  startRevenantUpkeepCast,
  toggleRevenantUpkeep
} from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import {
  completeRevenantCrushingAbyssSwap,
  completeRevenantImperialGuard,
  completeRevenantWeaponFlips,
  detonateRevenantBlossomingAura,
  reactRevenantDropTheHammer,
  reactRevenantSpearRecharge,
  revenantAbyssalRazeImpact,
  revenantBlossomingAuraPulse,
  revenantHitboxEffects,
  REVENANT_ABYSSAL_RAZE,
  REVENANT_BLOSSOMING_AURA,
  startRevenantAbyssalRaze,
  startRevenantBlossomingAura,
  startRevenantWeaponCast
} from '#gw2/professions/revenant/core/mechanics/weapons.js';
import {
  applyRevenantInvocationTraits,
  completeRevenantAncientEcho,
  completeRevenantBrutality,
  completeRevenantCastTraits,
  completeRevenantEnchantedDaggers,
  reactRevenantConditionTraits,
  reactRevenantControlTraits,
  reactRevenantIncensedResponse,
  reactRevenantPlayerStrike,
  REVENANT_ASSASSINS_PRESENCE,
  revenantAssassinsPresencePulse,
  startRevenantAssassinsPresence
} from '#gw2/professions/revenant/core/traits/index.js';
import type { ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import type { AvailabilityResult, CastCommand } from '#gw2/platform/execution/types.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type {
  RevenantConfig,
  RevenantResolverContext,
  RevenantRuntimeState,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';

// Custom Core owners emit these skills' packets from live state; their authored effects are templates only.
const CUSTOM_EFFECT_SKILL_IDS = new Set<SkillId>([
  ID.BLOSSOMING_AURA,
  ID.DETONATE_BLOSSOMING_AURA,
  ID.ENCHANTED_DAGGERS,
  ID.ABYSSAL_RAZE,
  ID.ANCIENT_ECHO
]);
const DODGE_IDS = new Set<SkillId>([ID.DODGE, VINDICATOR_JUMP_SKILL.id]);
// Deferred upkeep costs are immutable acceptance facts, spent only if the activation commits.
const upkeepCosts = new WeakMap<RuntimeCast, number>();

/** Releases are identified through the live catalog's upkeep parents. */
function upkeepRelease(runtime: RevenantRuntime, skill: Skill): boolean {
  return isRevenantUpkeepRelease(skill, (id) => runtime.helpers.skillsById.get(id));
}

function resourceProfile(runtime: RevenantRuntime) {
  return requireBalanceProfileFromContext(runtime, PROFILE.resources);
}

/** Capacity is distinct from the precombat recovery ceiling, which never discards larger grants. */
export const revenantEnergy: ResourcePolicy<RevenantRuntime> = {
  kind: 'continuous',
  state: (runtime) => runtime.profession.core.energy,
  maximum: () => 100,
  initial: (runtime) => Number((runtime.config as RevenantConfig).initialEnergy ?? 50),
  recovery: (runtime) =>
    balanceProfileNumber(resourceProfile(runtime), 'energyRegenerationPerSecond') - revenantUpkeepDrain(runtime),
  recoveryMaximum: (runtime) => (runtime.profession.core.combatBeganAt == null ? 50 : 100),
  depletion: { refresh: refreshRevenantStarvation, stop: refreshRevenantStarvation }
};

/** Vigor and Enduring Recovery add together; Vindicator shares the ten-per-second cap. */
export function revenantEnduranceRate(runtime: RevenantRuntime, vigor: boolean): number {
  const profile = resourceProfile(runtime);
  const enduring = hasTrait(runtime, TRAIT.ENDURING_RECOVERY)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, PROFILE.enduringRecovery),
        'enduranceRegenerationMultiplier'
      ) - 1
    : 0;
  return Math.min(
    10,
    balanceProfileNumber(profile, 'enduranceRegenerationPerSecond') *
      ((vigor ? balanceProfileNumber(profile, 'vigorRegenerationMultiplier') : 1) + enduring)
  );
}

export const revenantEndurance: EndurancePolicy<RevenantRuntime> = {
  state: (runtime) => runtime.profession.core,
  maximum: () => REVENANT_MAXIMUM_ENDURANCE,
  regenerationRate: (runtime, vigor) => revenantEnduranceRate(runtime, vigor)
};

/** Legend, flip, upkeep, endurance, and Energy gates read the one live state at the current instant. */
function revenantAvailability(runtime: RevenantRuntime, skill: Skill, _command: CastCommand): AvailabilityResult {
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
    const specialization = String(runtime.config.specialization || 'Core');
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
  const cost = revenantEnergyCost(runtime, skill as RevenantSkill);
  const energy = runtime.resourceController.value('energy');
  const energyReadyAt =
    energy + EPSILON < cost && core.combatBeganAt == null ? null : runtime.resourceController.readyAt('energy', cost);
  // A fractional balance can cross a cost between action ticks; wait until the shared grid permits spending it.
  if (energy + EPSILON < cost || (energyReadyAt != null && energyReadyAt > now + EPSILON)) {
    const cooldownReadyAt = Number(runtime.cooldowns.get(skill.id) || 0);
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
function swapLegend(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const core = runtime.profession.core;
  const previous = runtime.resourceController.value('energy');
  core.activeLegendId = core.selectedLegendIds.find((id) => id !== core.activeLegendId) || core.activeLegendId;
  core.activeLoadoutId = core.activeLegendId;
  const chargedMists = hasTrait(runtime, TRAIT.CHARGED_MISTS)
    ? requireBalanceProfileFromContext(runtime, PROFILE.chargedMists)
    : undefined;
  const energy = Math.min(
    100,
    chargedMists && Math.floor(previous) <= balanceProfileNumber(chargedMists, 'threshold')
      ? balanceProfileNumber(chargedMists, 'resourceGain')
      : Number(cast.skill.resourceGain || 0)
  );
  if (energy > previous) runtime.resourceController.grant('energy', energy - previous);
  else if (energy < previous) runtime.resourceController.spend('energy', previous - energy);
  clearRevenantLegendFlips(runtime);
  for (const active of [...core.activeUpkeeps]) {
    const upkeep = runtime.helpers.skillsById.get(active.skillId) as RevenantSkill | undefined;
    const consumeId = upkeep?.upkeepConsumeByLegendId?.[core.activeLegendId];
    if (consumeId != null) armSkillFlip(core.availableFlips, consumeId, runtime.time);
    else removeRevenantUpkeep(runtime, active.skillId);
  }

  runtime.resourceController.refresh('energy');
  runtime.emit({
    type: 'sigil_swap',
    at: runtime.time,
    source: 'revenant',
    sourceId: cast.skill.id,
    actorType: 'player',
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id,
    weaponSet: runtime.activeWeaponSet
  });
  applyRevenantInvocationTraits(runtime);
}

/** Core hooks: Energy, upkeeps, legends, weapon follow-ups, and actual hit/application trait reactions. */
export const revenantCoreHooks: Partial<RuntimeProfession<RevenantRuntimeState>> = {
  resources: { energy: revenantEnergy },
  endurance: revenantEndurance,
  initialize(runtime) {
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
    return revenantHitboxEffects(runtime, effects);
  },
  onCastStart(runtime, cast) {
    const skill = cast.skill as RevenantSkill;
    if (DODGE_IDS.has(skill.id)) return;
    if (isRevenantUpkeep(skill)) upkeepCosts.set(cast, revenantEnergyCost(runtime, skill));
    else if (skill.id !== ID.SWAP_LEGENDS)
      runtime.resourceController.spend('energy', revenantEnergyCost(runtime, skill));
    startRevenantWeaponCast(runtime, cast);
    if (cast.cancelled) return;
    startRevenantUpkeepCast(runtime, cast);
    if (skill.id === ID.BLOSSOMING_AURA) startRevenantBlossomingAura(runtime, cast);
    else if (skill.id === ID.DETONATE_BLOSSOMING_AURA) detonateRevenantBlossomingAura(runtime, cast);
    else if (skill.id === ID.ABYSSAL_RAZE) startRevenantAbyssalRaze(runtime, cast);
  },
  onCastComplete(runtime, cast) {
    const skill = cast.skill as RevenantSkill;
    const committed = !cast.cancelled;
    const upkeepCost = upkeepCosts.get(cast);
    upkeepCosts.delete(cast);
    if (committed && upkeepCost != null) runtime.resourceController.spend('energy', upkeepCost);
    completeRevenantImperialGuard(runtime, cast);
    if (skill.id === ID.SWAP_WEAPONS && !castWasInterrupted(cast)) {
      completeRevenantCrushingAbyssSwap(runtime, cast);
      completeRevenantBrutality(runtime, cast);
    }

    if (committed) {
      if (isRevenantUpkeep(skill)) toggleRevenantUpkeep(runtime, cast);
      else if (upkeepRelease(runtime, skill)) releaseRevenantUpkeep(runtime, cast);
      else if (skill.id === ID.SWAP_LEGENDS) swapLegend(runtime, cast);
      else if (skill.id === ID.ENCHANTED_DAGGERS) completeRevenantEnchantedDaggers(runtime, cast);
      else if (skill.id === ID.ANCIENT_ECHO) completeRevenantAncientEcho(runtime, cast);
      completeRevenantWeaponFlips(runtime, cast);
    }

    completeRevenantCastTraits(runtime, cast, committed);
    // Empower only after the paid skill commits, so a pulse during its windup cannot consume the bonus.
    if (committed) empowerRevenantEmbrace(runtime, cast);
  },
  onCooldownReset(runtime) {
    // Restores in-combat Energy after the shared runtime resets cooldowns.
    if (!runtime.combatStartedAt()) return;
    runtime.resourceController.grant('energy', runtime.profession.core.energy.maximum);
  },
  reactions: {
    'damage.resolving'(runtime, event) {
      return modifyRevenantLifeSiphon(runtime as unknown as RevenantResolverContext, event);
    },
    'damage.resolved'(runtime, event) {
      reactRevenantDropTheHammer(runtime, event);
      reactRevenantSpearRecharge(runtime, event);
      reactRevenantImpossibleOdds(runtime, event);
      reactRevenantPlayerStrike(runtime, event);
    },
    'condition.applied': reactRevenantConditionTraits,
    'control.resolved': reactRevenantControlTraits,
    'buff.applied': reactRevenantIncensedResponse
  },
  tasks: {
    [REVENANT_ENERGY_DEPLETED]: starveRevenantUpkeeps,
    [REVENANT_UPKEEP_PULSE]: revenantUpkeepPulse,
    [REVENANT_BLOSSOMING_AURA]: revenantBlossomingAuraPulse,
    [REVENANT_ABYSSAL_RAZE]: revenantAbyssalRazeImpact,
    [REVENANT_ASSASSINS_PRESENCE]: revenantAssassinsPresencePulse
  }
};
