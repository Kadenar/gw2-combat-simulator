import { resourceAtLeast } from '#gw2/platform/combat/resources/pool.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { CastCommand } from '#gw2/platform/execution/rotation.js';
import { armSkillFlip, skillFlipReady, weaponFlipBlock } from '#gw2/platform/execution/skill-flips.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/occurrence-driver.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import { revenantBuffPolicies, revenantEffectStates } from '#gw2/professions/revenant/core/effect-state.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { emitBattleScar } from '#gw2/professions/revenant/core/mechanics/battle-scars.js';
import {
  legendInvoked,
  revenantConditionApplied,
  revenantLifecycleAnchored,
  revenantWeaponSwapped
} from '#gw2/professions/revenant/core/mechanics/boundaries.js';
import { completeRevenantCast } from '#gw2/professions/revenant/core/mechanics/completion.js';
import { modifyRevenantLifeSiphon } from '#gw2/professions/revenant/core/mechanics/life-siphon.js';
import { reactRevenantPlayerStrike } from '#gw2/professions/revenant/core/mechanics/reactions.js';
import { revenantEndurance, revenantEnergy } from '#gw2/professions/revenant/core/mechanics/resources.js';
import {
  activateRevenantUpkeep,
  clearRevenantLegendFlips,
  empowerRevenantEmbrace,
  reactRevenantImpossibleOdds,
  releaseRevenantUpkeep,
  removeRevenantUpkeep,
  REVENANT_ENERGY_DEPLETED,
  REVENANT_UPKEEP_PULSE,
  revenantUpkeepPulse,
  startRevenantEmbrace,
  starveRevenantUpkeeps
} from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { enchantedDaggersLifecycle } from '#gw2/professions/revenant/core/skills/legends/assassin.js';
import {
  greatswordLifecycle,
  imperialGuardAvailability
} from '#gw2/professions/revenant/core/skills/weapons/greatsword.js';
import { scepterLifecycle } from '#gw2/professions/revenant/core/skills/weapons/scepter.js';
import { spearLifecycle } from '#gw2/professions/revenant/core/skills/weapons/spear.js';
import { chargedMistsEnergy } from '#gw2/professions/revenant/core/traits/invocation/behavior.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { isLegalRevenantLegendId } from '#gw2/professions/revenant/data/legends.js';
import {
  isRevenantUpkeep,
  isRevenantUpkeepRelease,
  revenantUpkeepConsumeId
} from '#gw2/professions/revenant/data/upkeep-skills.js';
import { VINDICATOR_JUMP_SKILL } from '#gw2/professions/revenant/data/vindicator-jump.js';
import { revenantEnergyCost } from '#gw2/professions/revenant/family-state.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';

const DODGE_IDS = new Set<SkillId>([SHARED_SKILL_IDS.DODGE, VINDICATOR_JUMP_SKILL.id]);

// Deferred upkeep costs are immutable acceptance facts, spent only if the activation commits.
const upkeepCosts = new WeakMap<RuntimeCast<RevenantSkill>, number>();

/** Releases are identified through the live catalog's upkeep parents. */
function upkeepRelease(runtime: MechanicQueriesOf<RevenantRuntime>, skill: Skill): boolean {
  return isRevenantUpkeepRelease(skill, (id) => runtime.helpers.skillsById.get(id));
}

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
  // Weapon-specific reasons take precedence over generic flip gates.
  const imperialGuardBlock = imperialGuardAvailability(runtime, skill);
  if (imperialGuardBlock) return imperialGuardBlock;
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
    !resourceAtLeast(energy, cost) && core.combatBeganAt == null
      ? null
      : runtime.resourceController.readyAt('energy', cost);
  // A fractional balance can cross a cost between action ticks; wait until the shared grid permits spending it.
  if (!resourceAtLeast(energy, cost) || (energyReadyAt != null && energyReadyAt > now)) {
    const cooldownReadyAt = runtime.cooldownController.readyAt(skill.id) || 0;
    return denySkillCast(
      skill,
      'revenant.insufficient-energy',
      `requires ${cost} energy.`,
      cooldownReadyAt > now ? cooldownReadyAt : energyReadyAt
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
  // Legend invocation replaces the balance after Charged Mists reads pre-swap energy, preserving recovery timing.
  runtime.resourceController.replace('energy', energy);
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
  if (runtime.combatStartedAt()) runtime.fireTrigger(legendInvoked, { at: runtime.time });
}

/** Core hooks: Energy, upkeeps, legends, weapon follow-ups, and actual hit/application trait reactions. */

const coreLifecycle: RuntimeHooks<RevenantRuntimeState, RevenantSkill> = {
  // Known damage payloads are invoked once without their activation requirements.
  damageEffects: [
    {
      id: 'battle-scars',
      name: 'Battle Scars',
      source: 'Profession',
      unit: 'charge',
      sourceIds: ['revenant.battle-scars'],
      emit: (runtime) => emitBattleScar(runtime, damageInputEvent(runtime))
    }
  ],

  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, inputs) {
    const state = runtime.profession.core;
    if (skill?.legendId) {
      state.activeLegendId = skill.legendId;
      state.activeLoadoutId = skill.legendId;
    }

    // Both the stat strip and occurrences consume the control's canonical serialized skill identity.
    const upkeepId = JSON.parse(String(inputs.upkeep ?? 'null'));
    const upkeep = runtime.helpers.skills.find((entry) => entry.id === upkeepId && entry.upkeepCost != null);
    if (upkeep)
      // Prepared upkeep needs the same activation identity as combat so depletion can retire its owner.
      state.activeUpkeeps = [
        { skillId: upkeep.id, upkeepCost: Number(upkeep.upkeepCost), startsAt: runtime.time, empoweredNextPulse: false }
      ];
  },

  buffPolicies: revenantBuffPolicies,
  observeEffects: revenantEffectStates,
  // Shared actions own legends and upkeep; skill lifecycles register their own actions below.
  sideEffectHandlers: {
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
    }
  },
  resources: { energy: revenantEnergy },
  endurance: revenantEndurance,
  initialize(runtime) {
    runtime.fireTrigger(revenantLifecycleAnchored, { at: runtime.time });
  },
  onCombatStart(runtime) {
    // Accepted combat raises the recovery ceiling; an authored marker also re-anchors Assassin's Presence.
    runtime.profession.core.combatBeganAt = runtime.time;
    runtime.resourceController.refresh('energy');
    if (runtime.hasExplicitCombatStart) runtime.fireTrigger(revenantLifecycleAnchored, { at: runtime.time });
  },
  availability: revenantAvailability,
  // Legend swaps stay free during setup until combat is established, like the runtime's weapon swaps.
  rechargeWork: (runtime, skill, work) => (skill.id === ID.SWAP_LEGENDS && !runtime.combatActive ? 0 : work),
  modifyEffects(runtime, cast, effects) {
    // Upkeep owners emit their own activation and recurring payloads.
    if (isRevenantUpkeep(cast.skill)) return [];
    if (upkeepRelease(runtime, cast.skill)) return [];
    return effects;
  },
  onCastStart(runtime, cast) {
    const skill = cast.skill;
    if (DODGE_IDS.has(skill.id)) return;
    if (!isRevenantUpkeep(skill) && skill.id !== ID.SWAP_LEGENDS)
      runtime.resourceController.spend('energy', revenantEnergyCost(runtime, skill));
  },
  onCastCancel(_runtime, cast) {
    // Cancellation discards the reserved upkeep cost without spending Energy.
    upkeepCosts.delete(cast);
  },
  onCastCommit(runtime, cast) {
    const skill = cast.skill;
    if (skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS) {
      runtime.fireTrigger(revenantWeaponSwapped, { cast });
    }

    completeRevenantCast(runtime, cast);
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
    'condition.applied': (runtime, cause) => runtime.fireTrigger(revenantConditionApplied, { cause })
  },
  tasks: {
    [REVENANT_ENERGY_DEPLETED]: starveRevenantUpkeeps,
    [REVENANT_UPKEEP_PULSE]: revenantUpkeepPulse
  }
};

/** Resolve Crushing Abyss before swap traits and clear upkeep reservations before retiring a cancelled follow-up. */
export const revenantCoreHooks = composeRuntimeHooks<RevenantRuntimeState, RevenantSkill>([
  scepterLifecycle,
  spearLifecycle,
  coreLifecycle,
  greatswordLifecycle,
  enchantedDaggersLifecycle
]);
