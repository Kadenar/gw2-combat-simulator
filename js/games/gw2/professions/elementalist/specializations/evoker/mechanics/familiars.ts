/**
 * Own familiar admission, replacement, resources, and settlement so callers only install the lifecycle.
 * A basic familiar spends the full charge bar for one empowered stack; at maximum stacks, the flip spends them all.
 */
import { ACTOR, RECIPIENT } from '#gw2/platform/constants.js';
import { requireSkillAction, type ActionContext, type SideEffectAction } from '#gw2/platform/effects/actions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { denyCast, retryCast, type AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast, SkillTaskData } from '#gw2/platform/execution/cast-contracts.js';
import { castRelativeEffectTimingScale, GW2_QUICKNESS_ACTION_RATE } from '#gw2/platform/execution/cast-timing.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { effectNumber, requireEffect, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { grantElectricEnchantments } from '#gw2/professions/elementalist/specializations/evoker/mechanics/electric-enchantment.js';
import {
  elementalProcessionEffects,
  IGNITE_TIERS,
  igniteTierEffect,
  projectIgniteEffects
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiar-projection.js';
import {
  emitResource,
  empoweredChargePolicy,
  familiarChargePolicy,
  weaponSkillChargeGain
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/resources.js';
import {
  evokerCastCompleted,
  evokerCastSettled,
  familiarSettled
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/trigger-points.js';
import { evokerState, type EvokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

interface FamiliarChargeGain {
  activationId: string;
  source: string;
  sourceId: SkillId;
  gain: number;
}

interface FamiliarExecution {
  lastEmpoweredFamiliarByBasic: Record<string, { skillId: SkillId; activationId: string; start: number } | null>;
  cancelledFamiliarActivations: Record<string, boolean>;
  activeFamiliarCast: { reservationId: string; endsAt: number; resetsCharges: boolean } | null;
  pendingWeaponCompletions: Array<{ activationId: string; at: number; gain: number }>;
  pendingWeaponChargeGains: FamiliarChargeGain[];
}

// Runtime and query contexts share one specialization state identity; separate runs never share reservations.
const executions = new WeakMap<EvokerState, FamiliarExecution>();

function familiarExecution(state: EvokerState): FamiliarExecution {
  let execution = executions.get(state);

  if (!execution) {
    execution = {
      lastEmpoweredFamiliarByBasic: {},
      cancelledFamiliarActivations: {},
      activeFamiliarCast: null,
      pendingWeaponCompletions: [],
      pendingWeaponChargeGains: []
    };
    executions.set(state, execution);
  }

  return execution;
}

// Replay all four empowered familiar effects with their native F5 strength so balance patches propagate here.
function releaseElementalProcession(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  sourceSkill: Skill
): void {
  for (const { familiar, effects } of elementalProcessionEffects(context.helpers.skillsById)) {
    for (const effect of effects) {
      // Procession preserves the familiar's unquickened timing and each surviving packet's representation.
      const runtimeCastMs = Math.max(0, (familiar.castTimeMs || 0) * GW2_QUICKNESS_ACTION_RATE);
      const scale = effect.timingScale === 'cast' ? castRelativeEffectTimingScale(familiar, runtimeCastMs) : 1;
      context.effects.emit({
        kind: 'profile',
        profile: familiar,
        effects: [effect],
        at: 0,
        fullEnd: 0,
        cast: { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget },
        attribution: {
          source: familiar.name,
          sourceId: familiar.id,
          actorType: ACTOR.PLAYER,
          triggeredBy: sourceSkill.name,
          skillId: familiar.id,
          skillName: familiar.name
        },
        transform: (event) => ({
          ...event,
          at: cast.effectiveEnd + event.at * scale,
          ...(event.type === 'damage' ? { skillWeapon: 'Profession mechanic' } : {})
        })
      });
    }
  }
}

/**
 * Shared pre-cast bookkeeping records pending charge providers so familiar
 * availability can retry after the weapon or refill commits.
 */
function onCastStart(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  const state = evokerState.from(context.profession);
  const execution = familiarExecution(state);

  // Track pending grants so early familiar inputs can wait for their resource provider.
  if (cast.command.concurrentOffsetMs == null) {
    const gain = weaponSkillChargeGain(context.helpers, context, skill, state);
    const postFamiliarGain = gain > 0 ? gain : skill.id === ID.REJUVENATE ? state.familiarCharges.maximum : 0;

    if (postFamiliarGain > 0)
      execution.pendingWeaponCompletions.push({ activationId: cast.id, at: cast.effectiveEnd, gain: postFamiliarGain });
  }
}

/** Skill-selected commit work runs after this cast's shared trait/bookkeeping hooks and before the next completion. */
function scheduleEvokerSkillCommit(
  context: ElementalistRuntime,
  trigger: ActionContext<ElementalistSkill>,
  action: SideEffectAction
): void {
  if (trigger.kind !== 'cast') throw new TypeError('Evoker skill completion requires a cast trigger.');

  context.scheduleForCast(action.type, context.time, trigger.cast, {}, undefined, -101);
}

const evokerSkillCommitTasks: NonNullable<RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>['tasks']> = {
  'elementalist.evoker.lightning-blitz'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const at = cast.effectiveEnd;
    // The selected skill owns the grant; shared enchantment state still owns expiry and consumption.
    const action = requireSkillAction(skill, 'electric-enchantment');
    const enchantment = requireEffect(skill, 'buff', 'Lightning Blitz Enchantment', action);

    if (enchantment)
      grantElectricEnchantments(context, {
        at,
        stacks: effectNumber(skill, enchantment, 'stacks'),
        duration: enchantment.duration,
        skill
      });
  },
  'elementalist.evoker.zap'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const at = cast.effectiveEnd;
    const action = requireSkillAction(skill, 'zap-window');
    const zap = requireEffect(skill, 'buff', 'Zap Window', action);

    if (zap) {
      context.effects.emit(
        elementalistBuffRequest(
          {
            at,
            source: skill.name,
            sourceId: skill.id,
            actorType: ACTOR.PLAYER,
            skillName: skill.name,
            // Use the declared identity so the policy and damage modifier observe this same window.
            kind: String(zap.kind),
            stacks: Number(zap.stacks),
            duration: zap.duration
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }
  },
  'elementalist.evoker.settle-basic-familiar'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    settleBasicFamiliar(context, cast);
  },
  'elementalist.evoker.settle-empowered-familiar'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const state = evokerState.from(context.profession);

    context.resourceController.replace('empoweredCharges', 0);
    emitResource(context, cast, skill, state);
  },
  'elementalist.evoker.rejuvenate'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const state = evokerState.from(context.profession);

    context.resourceController.grant('familiarCharges', state.familiarCharges.maximum);
    emitResource(context, cast, skill, state);
  },
  'elementalist.evoker.hares-agility'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const at = cast.effectiveEnd;
    // Read charges from the selected buff, independently of this meditation's endurance grant.
    const action = requireSkillAction(skill, 'electric-enchantment');
    const enchantment = requireEffect(skill, 'buff', 'Hare Enchantment', action);

    if (enchantment)
      grantElectricEnchantments(context, {
        at,
        stacks: effectNumber(skill, enchantment, 'stacks'),
        duration: enchantment.duration,
        skill
      });
  },
  'elementalist.evoker.toads-fortitude'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const at = cast.effectiveEnd;
    // Read the accepted skill's selected payload without changing the deferred meditation ordering.
    const action = requireSkillAction(skill, 'earth-resistance');
    const resistance = requireEffect(skill, 'boon', 'Toad Resistance', action);

    if (resistance)
      context.effects.emit(
        elementalistBuffRequest(
          {
            skill,
            at,
            source: skill.name,
            sourceId: skill.id,
            actorType: ACTOR.PLAYER,
            kind: resistance.boon,
            stacks: Number(resistance.stacks),
            duration: resistance.duration,
            audience: resistance.audience,
            skillName: skill.name
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
  },
  'elementalist.evoker.foxs-fury'(context, data) {
    const { cast } = data as SkillTaskData<ElementalistSkill>;
    const skill = cast.skill;
    const state = evokerState.from(context.profession);
    const at = cast.effectiveEnd;
    const action = requireSkillAction(skill, 'boons');
    const might = requireEffect(skill, 'boon', 'Fox Might', action);
    const fireMight = requireEffect(skill, 'boon', 'Fox Fire Bonus', action);
    const fury = requireEffect(skill, 'boon', 'Fox Fury', action);
    const fireBonus = state.element === 'Fire' ? fireMight : undefined;
    const combinedMight =
      might && fireBonus && might.boon === fireBonus.boon && might.duration === fireBonus.duration
        ? { ...might, stacks: Number(might.stacks) + Number(fireBonus.stacks) }
        : undefined;
    for (const effect of [...(combinedMight ? [combinedMight] : [might, fireBonus]), fury]) {
      if (!effect) continue;

      const boon = {
        kind: effect.boon,
        stacks: Number(effect.stacks),
        duration: effect.duration
      };
      context.effects.emit(
        elementalistBuffRequest(
          {
            skill: skill,
            at,
            source: skill.name,
            sourceId: skill.id,
            actorType: ACTOR.PLAYER,
            skillName: skill.name,
            audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
            ...boon
          },
          { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
        )
      );
    }
  }
};

/** Release each deferred grant after the familiar reset, then run the final familiar trait observer. */
function finishEvokerCast(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>): void {
  const state = evokerState.from(context.profession);
  const execution = familiarExecution(state);

  if (execution.activeFamiliarCast?.reservationId === cast.id) {
    flushPendingWeaponChargeGains(context, state);
    execution.activeFamiliarCast = null;
  }

  context.fireTrigger(familiarSettled, { cast });
}

/**
 * Shared completion observers settle pending weapon grants and familiar traits
 * before the skill-declared resource reset and final observer tasks run.
 */
function onCastCommit(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  const state = evokerState.from(context.profession);
  const execution = familiarExecution(state);
  // A settled grant cannot fund another retry or be awarded again after a familiar spends it.
  execution.pendingWeaponCompletions = execution.pendingWeaponCompletions.filter(
    (entry) => entry.activationId !== cast.id
  );
  grantWeaponSkillCharges(context, cast, skill, state);
  context.fireTrigger(evokerCastCompleted, { cast });
}

// Commit at the live flush time, clamped to capacity, so deferred grants follow the familiar's reset.
function applyWeaponSkillChargeGain(
  context: ElementalistRuntime,
  state: EvokerState,
  chargeGain: FamiliarChargeGain
): void {
  const before = state.familiarCharges.value;
  context.resourceController.grant('familiarCharges', chargeGain.gain);

  if (state.familiarCharges.value === before) return;

  context.effects.emit({
    kind: 'packet',
    event: {
      type: 'resource',
      activationId: chargeGain.activationId,
      at: context.time,
      source: chargeGain.source,
      sourceId: chargeGain.sourceId,
      actorType: ACTOR.PLAYER,
      skillName: chargeGain.source,
      kind: 'evoker-charges',
      value: state.familiarCharges.value,
      maximum: state.familiarCharges.maximum,
      empowered: state.empoweredCharges.value,
      change: state.familiarCharges.value - before
    }
  });
}

/**
 * Awards a completing weapon skill's charges, queueing the grant instead when a
 * charge-resetting basic familiar is still casting so the charges land after the
 * reset rather than being wiped by it.
 */
function grantWeaponSkillCharges(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill,
  state: EvokerState
): void {
  const execution = familiarExecution(state);
  const gain = weaponSkillChargeGain(context.helpers, context, skill, state);

  if (gain <= 0) return;

  const chargeGain = {
    activationId: cast.id,
    source: skill.name,
    sourceId: skill.id,
    gain
  };

  // Defer grants while a basic familiar is casting. Its charge reset would otherwise erase them.
  // reservationId check excludes the familiar itself from deferring its own grant
  if (
    execution.activeFamiliarCast &&
    execution.activeFamiliarCast.resetsCharges &&
    cast.id !== execution.activeFamiliarCast.reservationId &&
    cast.effectiveEnd <= execution.activeFamiliarCast.endsAt
  ) {
    execution.pendingWeaponChargeGains.push(chargeGain);
    return;
  }

  applyWeaponSkillChargeGain(context, state, chargeGain);
}

/** Replays every deferred grant once the familiar cast that blocked them has settled. */
function flushPendingWeaponChargeGains(context: ElementalistRuntime, state: EvokerState): void {
  const execution = familiarExecution(state);
  for (const chargeGain of execution.pendingWeaponChargeGains) {
    applyWeaponSkillChargeGain(context, state, chargeGain);
  }

  execution.pendingWeaponChargeGains = [];
}

/**
 * Waits for in-flight familiar casts and charge grants; missing resources without
 * a pending grant remain a final denial for this command.
 */
function availability(context: MechanicQueriesOf<ElementalistRuntime>, skill: ElementalistSkill): AvailabilityResult {
  const state = evokerState.from(context.profession);
  const execution = familiarExecution(state);

  // Nothing may start until the familiar cast in flight ends.
  if (execution.activeFamiliarCast && context.time < execution.activeFamiliarCast.endsAt) {
    return retryCast(
      execution.activeFamiliarCast.endsAt,
      'elementalist.evoker-familiar-cast',
      `${skill.name} waits for the active familiar cast to finish.`
    );
  }

  // Familiar admission follows the selected skill's family and element.
  if (skill.skillFamily !== 'Familiar') return { ready: true };

  const element = skill.attunement;

  if (state.element !== element) {
    return denyCast(
      'elementalist.evoker-element',
      `${skill.name} is unavailable - the ${element} familiar is not selected.`
    );
  }

  // basic familiar requires a full charge bar and no empowered stack (empowered means the flip form is active)
  if (skill.flipSkillId != null) {
    const requiredEmpowered = state.empoweredCharges.maximum;

    // Recorded familiar inputs can precede the simulator's weapon completion; wait for real pending grants.
    if (
      state.empoweredCharges.value < requiredEmpowered &&
      state.familiarCharges.value < state.familiarCharges.maximum
    ) {
      // Even the next microsecond is future work that can make this command retryable.
      const pending = execution.pendingWeaponCompletions
        .filter((grant) => grant.at > context.time)
        .sort((left, right) => left.at - right.at);
      let charges = state.familiarCharges.value;
      for (const grant of pending) {
        charges += grant.gain;

        if (charges >= state.familiarCharges.maximum) {
          return retryCast(
            grant.at,
            'elementalist.evoker-charges',
            `${skill.name} waits for the active cast to supply familiar charges.`
          );
        }
      }
    }

    return state.empoweredCharges.value < requiredEmpowered &&
      state.familiarCharges.value >= state.familiarCharges.maximum
      ? { ready: true }
      : denyCast(
          'elementalist.evoker-basic',
          `${skill.name} is unavailable - requires ${state.familiarCharges.maximum} charges and no empowered familiar.`
        );
  }

  // The selected empowered capacity determines when the flip becomes usable.
  const requiredEmpowered = state.empoweredCharges.maximum;
  return state.empoweredCharges.value >= requiredEmpowered
    ? { ready: true }
    : denyCast(
        'elementalist.evoker-empowered',
        `${skill.name} is unavailable - requires ${requiredEmpowered} empowered charges.`
      );
}

/** A skill-declared start owns its reservation and the basic/empowered replacement window. */
function beginFamiliarCast(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  const state = evokerState.from(context.profession);
  const execution = familiarExecution(state);

  // Familiar readiness blocks other actions until the reservation ends.
  if (skill.skillFamily === 'Familiar') {
    execution.activeFamiliarCast = {
      reservationId: cast.id,
      endsAt: cast.effectiveEnd,
      resetsCharges: skill.flipSkillId != null
    };
  }

  // if the empowered familiar was recently cast and the basic fires within the window, the empowered effects are retroactively cancelled
  const empoweredSkill = skill.flipSkillId;

  if (empoweredSkill != null) {
    const window = skillNumber(skill, 'duration');
    const basicKey = String(skill.id);
    const recent = execution.lastEmpoweredFamiliarByBasic[basicKey];

    if (recent?.skillId === empoweredSkill && cast.start - recent.start < window) {
      context.cancelOwner({ id: recent.activationId, generation: 0 });
      execution.cancelledFamiliarActivations[cast.id] = true;
      execution.lastEmpoweredFamiliarByBasic[basicKey] = null;
    }
  }

  const basic = skill.flipParentId;

  if (basic != null) {
    execution.lastEmpoweredFamiliarByBasic[String(basic)] = {
      skillId: skill.id,
      activationId: cast.id,
      start: cast.start
    };
  }
}

/**
 * Advance Ignite's Burning tier once per accepted cast and select that tier's packet. A replaced Ignite keeps the
 * current tier; `modifyFamiliarEffects` removes its packets.
 */
export function acceptIgniteEffects(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  const state = evokerState.from(context.profession);
  const execution = familiarExecution(state);

  if (execution.cancelledFamiliarActivations[cast.id]) return effects;

  if (cast.start - state.igniteLastUsedAt >= skillNumber(cast.skill, 'tierResetDuration')) state.igniteTier = 0;

  const burning = igniteTierEffect(context.helpers, state.igniteTier);
  state.igniteTier = Math.min(state.igniteTier + 1, IGNITE_TIERS.length - 1);
  state.igniteLastUsedAt = cast.start;
  return projectIgniteEffects(effects, burning);
}

/** Replacement cancellation remains shared across familiar packets, independent of their selected payload. */
function modifyFamiliarEffects(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  return familiarExecution(evokerState.from(context.profession)).cancelledFamiliarActivations[cast.id] ? [] : effects;
}

/** Convert basic charges and gate the empowered flip using the selected patch's familiar delay. */
function settleBasicFamiliar(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>): void {
  const skill = cast.skill;
  const state = evokerState.from(context.profession);
  const at = cast.effectiveEnd;
  context.resourceController.replace('familiarCharges', 0);
  // Complete the conversion before publishing its combined reading or flushing deferred rewards.
  context.resourceController.grant('empoweredCharges', 1);
  const flip = skill.flipSkillId;
  const empowered = flip != null ? context.helpers.skillsById.get(flip) : undefined;

  if (empowered) {
    const delay = skillNumber(skill, 'empoweredUnlockDelay');
    context.cooldownController.setReadyAt(
      empowered.id,
      Math.max(context.cooldownController.readyAt(empowered.id) || 0, at + delay)
    );
  }

  emitResource(context, cast, skill, state);
}

/** Install the complete familiar lifecycle; intrinsic tasks settle before the final trait observers. */
export const evokerFamiliarLifecycle = {
  resources: { familiarCharges: familiarChargePolicy, empoweredCharges: empoweredChargePolicy },
  availability,
  // Familiar packets keep cancellable cast ownership without recursively resubmitting during preparation.
  effectOwner(runtime, event) {
    if (
      runtime.skillFor(event.skillId ?? event.sourceId)?.skillFamily === 'Familiar' &&
      ['damage', 'condition', 'control'].includes(event.type)
    )
      return { id: String(event.activationId), generation: 0 };

    return undefined;
  },
  sideEffectHandlers: {
    ...Object.fromEntries(Object.keys(evokerSkillCommitTasks).map((type) => [type, scheduleEvokerSkillCommit])),
    'elementalist.evoker.begin-familiar'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Familiar activation requires a cast trigger.');

      beginFamiliarCast(runtime, context.cast, context.skill);
    },
    // Replay payloads with Procession ownership without performing a familiar cast's resource or trait settlement.
    'elementalist.evoker.release-elemental-procession'(runtime, context) {
      if (context.kind !== 'cast') throw new TypeError('Elemental Procession requires a cast trigger.');

      releaseElementalProcession(runtime, context.cast, context.skill);
    }
  },
  modifyEffects: modifyFamiliarEffects,
  onCastStart(runtime, cast) {
    onCastStart(runtime, cast, cast.skill);
  },
  onCastCancel(runtime, cast) {
    // Cancelled familiar casts release deferred weapon grants without resetting familiar charges.
    const state = evokerState.from(runtime.profession);
    const execution = familiarExecution(state);
    execution.pendingWeaponCompletions = execution.pendingWeaponCompletions.filter(
      (entry) => entry.activationId !== cast.id
    );

    if (execution.activeFamiliarCast?.reservationId === cast.id) {
      flushPendingWeaponChargeGains(runtime, state);
      execution.activeFamiliarCast = null;
    }
  },
  onCastCommit(runtime, cast) {
    onCastCommit(runtime, cast, cast.skill);
    // Run after skill-declared intrinsic tasks. Reset first, apply deferred grants, then run the final trait callbacks.
    runtime.scheduleForCast('elementalist.evoker.finish-commit', runtime.time, cast, {}, undefined, -101);
  },
  tasks: {
    ...evokerSkillCommitTasks,
    'elementalist.evoker.finish-commit'(runtime, data) {
      const { cast } = data as SkillTaskData<ElementalistSkill>;

      finishEvokerCast(runtime, cast);
      runtime.fireTrigger(evokerCastSettled, { cast });

      delete familiarExecution(evokerState.from(runtime.profession)).cancelledFamiliarActivations[cast.id];
    }
  }
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;
