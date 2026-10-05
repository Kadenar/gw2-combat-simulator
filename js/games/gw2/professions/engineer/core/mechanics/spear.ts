import { armSkillFlip, consumeSkillFlip, skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { activeStackCount, addTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import type { RuntimeCast, SkillTaskData } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import { denySkillCast as denyEngineerCast } from '#gw2/platform/execution/availability.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  buildEngineerCondition,
  buildEngineerStrike
} from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import type {
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerRuntime,
  EngineerSkill,
  EngineerRuntimeState
} from '#gw2/professions/engineer/types.js';
import { boundedInteger } from '#kernel/core/numeric.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/skills/balance-profiles.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/core/profiles.js';

/** Skill declarations select each spear mutation; handlers retain lifetime ownership and release-time snapshots. */
export const engineerSpearSideEffectHandlers: RuntimeProfession<
  EngineerRuntimeState,
  EngineerSkill
>['sideEffectHandlers'] = {
  'engineer.lightning-rod'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Lightning Rod requires a cast trigger.');
    const { cast } = context;
    const state = runtime.profession.core;
    const at = runtime.time;
    runtime.cancelOwner({ id: 'engineer.lightning-rod', generation: state.lightningRodGeneration });
    const owner = { id: 'engineer.lightning-rod', generation: ++state.lightningRodGeneration };
    state.lightningRodChargeExpiries = [];
    const readyAt = cast.start + 4.2;
    armSkillFlip(state.availableFlips, ID.ELECTRIC_ARTILLERY, readyAt, readyAt + 8);
    for (let index = 0; index < 8; index++)
      runtime.scheduleForCast('engineer.rod-pulse', at + 0.16 + index * 0.5, cast, { index }, owner);
    runtime.schedule('engineer.rod-expire', readyAt + 8, undefined, owner);
  },
  'engineer.conduit-surge'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Conduit Surge requires a cast trigger.');
    const { cast } = context;
    buildEngineerPackets(
      'engineer.conduit-surge',
      { at: runtime.time, activationId: cast.id, offTarget: cast.command.offTarget },
      cast.skill
    ).forEach((packet) => runtime.effects.emit({ kind: 'packet', event: packet }));
  },
  'engineer.electric-artillery'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Electric Artillery requires a cast trigger.');
    const { cast } = context;
    const state = runtime.profession.core;
    const at = runtime.time;
    buildEngineerPackets(
      'engineer.electric-artillery',
      {
        at: at + 0.6,
        activationId: cast.id,
        offTarget: cast.command.offTarget,
        charges: activeStackCount(state.lightningRodChargeExpiries, at),
        persistsAfterInterrupt: true
      },
      cast.skill
    ).forEach((packet) => runtime.effects.emit({ kind: 'packet', event: packet }));
    runtime.cancelOwner({ id: 'engineer.lightning-rod', generation: state.lightningRodGeneration });
    state.lightningRodChargeExpiries = [];
    consumeSkillFlip(state.availableFlips, ID.ELECTRIC_ARTILLERY);
  },
  'engineer.roiling-skies'(runtime, context) {
    if (context.kind !== 'cast') throw new TypeError('Roiling Skies requires a cast trigger.');
    const { cast } = context;
    const focused = runtime.combat.activeBuffStacks('engineer-focused', runtime.time, 1) > 0;
    buildEngineerPackets(
      'control',
      {
        at: runtime.time,
        activationId: cast.id,
        offTarget: cast.command.offTarget,
        controlKind: focused ? 'launch' : 'stun'
      },
      cast.skill
    ).forEach((packet) => runtime.effects.emit({ kind: 'packet', event: packet }));
  }
};

/** Spear tasks retain their cast and generation owners through release and impact. */
export const engineerSpearTasks: RuntimeProfession<EngineerRuntimeState, EngineerSkill>['tasks'] = {
  'engineer.rod-pulse'(runtime, data) {
    const { cast, index } = data as { cast: RuntimeCast<EngineerSkill>; index: number };
    buildEngineerPackets(
      'engineer.lightning-rod-pulse',
      {
        at: runtime.time,
        activationId: cast.id,
        offTarget: cast.command.offTarget,
        hitIndex: index + 1,
        totalHits: 8
      },
      cast.skill
    ).forEach((packet) => runtime.effects.emit({ kind: 'packet', event: packet }));
  },
  'engineer.rod-expire'(runtime) {
    runtime.profession.core.lightningRodChargeExpiries = [];
    consumeSkillFlip(runtime.profession.core.availableFlips, ID.ELECTRIC_ARTILLERY);
  },
  'engineer.devastation'(runtime, data) {
    // Focused is sampled at the authored task deadline, after any intervening target-state changes.
    if (runtime.combat.activeBuffStacks('engineer-focused', runtime.time, 1) === 0) return;
    const { cast } = data as SkillTaskData<EngineerSkill>;
    const followup = runtime.helpers.skillsById.get(ID.FOCUSED_DEVASTATION)!;
    runtime.effects.emit({
      kind: 'profile',
      profile: followup,
      effects: followup.effects?.filter((effect) => effect.type === 'strike' || effect.type === 'condition'),
      attribution: {
        source: 'engineer',
        sourceId: followup.id,
        actorType: 'player',
        skillId: followup.id,
        skillName: followup.name,
        activationId: `${cast.id}:focused-devastation`
      },
      transform: (event) => ({
        ...event,
        offTarget: cast.command.offTarget,
        skillWeapon: 'Spear',
        weaponStrengthProfileId: 'nonweapon.unequipped',
        persistsAfterInterrupt: true
      })
    });
  }
};
// Focused is the shared spear target window established by Conduit Surge.
function focused(context: EngineerResolverContext, at: number): boolean {
  return context.combat.activeBuffStacks('engineer-focused', at, 1) > 0;
}

/** Each Lightning Rod pulse applies Vulnerability, with stronger strikes and stacks against Focused targets. */
export function handleLightningRodPulse(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  // Only a target-facing pulse in combat can earn an Artillery charge.
  if (
    !event.offTarget &&
    !context.combatStartPending &&
    (context.combatStartTime == null || event.at >= context.combatStartTime)
  ) {
    const state = context.profession.core;
    state.lightningRodChargeExpiries = addTimedStacks(state.lightningRodChargeExpiries, 1, event.at, 12, 12).expiries;
  }

  const isFocused = focused(context, event.at);
  const profile = requireBalanceProfileFromContext(
    context,
    isFocused ? PROFILE.focusedLightningRod : PROFILE.lightningRod
  );
  const idProfile = requireBalanceProfileFromContext(context, profile.id);
  const condition = requireEffect(idProfile, 'condition', 'Vulnerability');
  const strike = requireEffect(idProfile, 'strike', profile.name);
  if (strike)
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerStrike(event, {
        skillWeapon: 'Spear',
        name: 'Lightning Rod',
        coefficient: Number(strike.coefficient)
      })
    });
  if (condition)
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerCondition(event, {
        name: 'Lightning Rod',
        condition: String(condition.condition),
        stacks: Number(condition.stacks),
        duration: Number(condition.duration)
      }),
      settlement: 'reaction'
    });
}

/** Opens the Focused target window and resolves Conduit Surge's strike and burning packets. */
export function handleConduitSurge(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const profile = requireBalanceProfileFromContext(context, PROFILE.conduitSurge);
  const idProfile = requireBalanceProfileFromContext(context, profile.id);
  const burning = requireEffect(idProfile, 'condition', 'Burning');
  // Independent accepted target windows preserve a longer Focused grant without a duplicate deadline.
  if (
    !event.offTarget &&
    !context.combatStartPending &&
    (context.combatStartTime == null || event.at >= context.combatStartTime)
  )
    context.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      cause: event,
      event: {
        type: 'buff',
        kind: 'engineer-focused',
        at: event.at,
        duration: balanceProfileNumber(idProfile, 'durationMultiplier'),
        stacks: 1,
        source: 'engineer',
        sourceId: ID.CONDUIT_SURGE,
        actorType: 'player',
        name: 'Focused',
        skillName: event.skillName,
        audience: { recipients: 'self' }
      }
    });
  const strike = requireEffect(idProfile, 'strike', profile.name);
  if (strike)
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerStrike(event, {
        skillWeapon: 'Spear',
        name: 'Conduit Surge',
        coefficient: Number(strike.coefficient),
        // Attempt the leap only when the strike reaches impact.
        comboFinisher: {
          ownerId: 'engineer',
          finisherType: 'Leap',
          ambiguousFieldSelection: 'oldest'
        }
      })
    });
  if (burning)
    context.effects.emit({
      kind: 'packet',
      event: buildResolverCondition({
        at: event.at,
        name: 'Conduit Surge — Burning',
        skillName: 'Conduit Surge',
        condition: String(burning.condition),
        stacks: Number(burning.stacks),
        duration: Number(burning.duration),
        source: 'engineer',
        sourceId: event.skillId ?? event.sourceId,
        actorType: 'player',
        activationId: event.activationId,
        offTarget: event.offTarget
      })
    });
}

/** Resolves Electric Artillery using its stored charges and current Focused state. */
export function handleElectricArtillery(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const isFocused = focused(context, event.at);
  const profile = requireBalanceProfileFromContext(
    context,
    isFocused ? PROFILE.focusedElectricArtillery : PROFILE.electricArtillery
  );
  const idProfile = requireBalanceProfileFromContext(context, profile.id);
  const immobilize = requireEffect(idProfile, 'condition', 'Immobilized');
  const vulnerability = requireEffect(idProfile, 'condition', 'Vulnerability');
  const burning = requireEffect(idProfile, 'condition', 'Burning');
  // charges accumulate from Lightning Rod hits (max 12); Math.trunc discards partial charges
  const charges = boundedInteger(event.charges || 0, 0, 0, balanceProfileNumber(idProfile, 'maximumStacks'));
  const strike = requireEffect(idProfile, 'strike', profile.name);
  if (strike)
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerStrike(event, {
        skillWeapon: 'Spear',
        name: 'Electric Artillery',
        coefficient: Number(strike.coefficient),
        explosion: true
      })
    });
  if (immobilize)
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerCondition(event, {
        name: 'Electric Artillery',
        condition: String(immobilize.condition),
        stacks: Number(immobilize.stacks),
        duration: Number(immobilize.duration)
      }),
      settlement: 'reaction'
    });
  // The tooltip specifies charges required per stack: one when Focused, otherwise two.
  if (vulnerability) {
    const vulnerabilityStacks =
      Math.floor(charges / balanceProfileNumber(idProfile, 'chargesPerVulnerability')) * Number(vulnerability.stacks);
    if (vulnerabilityStacks > 0) {
      context.effects.emit({
        kind: 'packet',
        event: buildEngineerCondition(event, {
          name: 'Electric Artillery',
          condition: String(vulnerability.condition),
          stacks: vulnerabilityStacks,
          duration: Number(vulnerability.duration),
          // Artillery's Vulnerability does not scale with condition duration.
          metadata: { fixedDuration: true }
        }),
        settlement: 'reaction'
      });
    }
  }

  if (burning) {
    context.effects.emit({
      kind: 'packet',
      event: buildResolverCondition({
        at: event.at,
        name: 'Electric Artillery — Burning',
        skillName: 'Electric Artillery',
        condition: 'Burning',
        stacks: Number(burning.stacks),
        duration: Number(burning.duration) + charges * balanceProfileNumber(idProfile, 'burningDurationPerCharge'),
        source: 'engineer',
        sourceId: event.skillId ?? event.sourceId,
        actorType: 'player',
        activationId: event.activationId,
        offTarget: event.offTarget
      })
    });
  }
}

/** Spear availability follows the same armed window that owns charging and release. */
export function engineerSpearAvailability(
  context: MechanicQueriesOf<EngineerRuntime>,
  skill: EngineerSkill
): AvailabilityResult {
  const state = professionCoreState(context);
  const artillery = state.availableFlips[ID.ELECTRIC_ARTILLERY];
  if (skill.id === ID.ELECTRIC_ARTILLERY && !skillFlipReady(artillery, context.time)) {
    // The stored window carries readiness even while its palette tile is hidden.
    const retryAt = artillery?.availableAt || 0;
    return denyEngineerCast(
      skill,
      'engineer.electric-artillery-inactive',
      'Lightning Rod has not finished charging.',
      retryAt > context.time ? retryAt : null
    );
  }

  if (skill.id === ID.LIGHTNING_ROD && artillery && (artillery.expiresAt ?? Infinity) > context.time) {
    // block re-cast while EA is available OR while the charge window is still open (both share the slot)
    return denyEngineerCast(
      skill,
      'engineer.lightning-rod-active',
      'Electric Artillery currently replaces this skill.',
      artillery.expiresAt
    );
  }

  return { ready: true };
}

const CUSTOM_SPEAR = new Set<number>([ID.LIGHTNING_ROD, ID.CONDUIT_SURGE, ID.ELECTRIC_ARTILLERY]);
/** Stateful spear packets replace authored effects to avoid emitting both paths. */
export const engineerSpearEffects: NonNullable<RuntimeHooks<EngineerRuntimeState, EngineerSkill>['modifyEffects']> = (
  _runtime,
  cast,
  effects
) => (CUSTOM_SPEAR.has(Number(cast.skill.id)) ? [] : effects);

/** Core hooks register this feature without owning its impact policy. */
export const engineerSpearEventHandlers: RuntimeProfession<EngineerRuntimeState, EngineerSkill>['eventHandlers'] = {
  'engineer.lightning-rod-pulse': handleLightningRodPulse,
  'engineer.conduit-surge': handleConduitSurge,
  'engineer.electric-artillery': handleElectricArtillery
};
