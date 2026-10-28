import { activeStackCount, addTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { ACTOR, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT, WEAPON } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast as denyEngineerCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast, SkillTaskData } from '#gw2/platform/execution/cast-contracts.js';
import { armSkillFlip, consumeSkillFlip, skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { requireEffect, requireSkillFromContext, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import {
  buildEngineerCondition,
  buildEngineerStrike
} from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type {
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerRuntime,
  EngineerRuntimeState,
  EngineerSkill
} from '#gw2/professions/engineer/types.js';
import { boundedInteger } from '#kernel/core/numeric.js';

/** Skill declarations select each spear mutation; handlers retain lifetime ownership and release-time snapshots. */
const engineerSpearSideEffectHandlers: RuntimeProfession<EngineerRuntimeState, EngineerSkill>['sideEffectHandlers'] = {
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
        controlKind: focused ? CONTROL.LAUNCH : CONTROL.STUN
      },
      cast.skill
    ).forEach((packet) => runtime.effects.emit({ kind: 'packet', event: packet }));
  }
};

/** Spear tasks retain their cast and generation owners through release and impact. */
const engineerSpearTasks: RuntimeProfession<EngineerRuntimeState, EngineerSkill>['tasks'] = {
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
        actorType: ACTOR.PLAYER,
        skillId: followup.id,
        skillName: followup.name,
        activationId: `${cast.id}:focused-devastation`
      },
      transform: (event) => ({
        ...event,
        offTarget: cast.command.offTarget,
        skillWeapon: WEAPON.SPEAR,
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
  if (!event.offTarget && context.engagement.hostileEffectsAllowed(event.at)) {
    const state = context.profession.core;
    state.lightningRodChargeExpiries = addTimedStacks(
      state.lightningRodChargeExpiries,
      1,
      event.at,
      12,
      skillNumber(requireSkillFromContext(context, ID.ELECTRIC_ARTILLERY), 'maximumStacks')
    ).expiries;
  }

  const isFocused = focused(context, event.at);
  const skill = requireSkillFromContext(context, ID.LIGHTNING_ROD);
  const action = requireSkillAction(skill, 'payload');
  const condition = requireEffect(
    skill,
    'condition',
    isFocused ? `Focused ${CONDITION.VULNERABILITY}` : CONDITION.VULNERABILITY,
    action
  );
  const strike = requireEffect(
    skill,
    'strike',
    isFocused ? 'Focused Lightning Rod Pulse' : 'Lightning Rod Pulse',
    action
  );

  if (strike)
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerStrike(event, {
        skillWeapon: WEAPON.SPEAR,
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
function handleConduitSurge(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const skill = requireSkillFromContext(context, ID.CONDUIT_SURGE);
  const action = requireSkillAction(skill, 'payload');
  const burning = requireEffect(skill, 'condition', CONDITION.BURNING, action);

  // Independent accepted target windows preserve a longer Focused grant without a duplicate deadline.
  if (!event.offTarget && context.engagement.hostileEffectsAllowed(event.at))
    context.effects.emit({
      kind: 'packet',
      settlement: 'reaction',
      cause: event,
      event: {
        type: 'buff',
        kind: 'engineer-focused',
        at: event.at,
        duration: skillNumber(skill, 'duration'),
        stacks: 1,
        source: 'engineer',
        sourceId: ID.CONDUIT_SURGE,
        actorType: ACTOR.PLAYER,
        name: 'Focused',
        skillName: event.skillName,
        audience: { recipients: RECIPIENT.SELF }
      }
    });

  const strike = requireEffect(skill, 'strike', 'Conduit Surge', action);

  if (strike)
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerStrike(event, {
        skillWeapon: WEAPON.SPEAR,
        name: 'Conduit Surge',
        coefficient: Number(strike.coefficient),
        // Attempt the leap only when the strike reaches impact.
        comboFinisher: {
          ownerId: 'engineer',
          finisherType: COMBO_FINISHER.LEAP
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
        actorType: ACTOR.PLAYER,
        activationId: event.activationId,
        offTarget: event.offTarget
      })
    });
}

/** Resolves Electric Artillery using its stored charges and current Focused state. */
export function handleElectricArtillery(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  const isFocused = focused(context, event.at);
  const skill = requireSkillFromContext(context, ID.ELECTRIC_ARTILLERY);
  const action = requireSkillAction(skill, 'payload');
  const immobilize = requireEffect(
    skill,
    'condition',
    isFocused ? `Focused ${CONDITION.IMMOBILIZED}` : CONDITION.IMMOBILIZED,
    action
  );
  const vulnerability = requireEffect(
    skill,
    'condition',
    isFocused ? `Focused ${CONDITION.VULNERABILITY}` : CONDITION.VULNERABILITY,
    action
  );
  const burning = requireEffect(
    skill,
    'condition',
    isFocused ? `Focused ${CONDITION.BURNING}` : CONDITION.BURNING,
    action
  );
  // charges accumulate from Lightning Rod hits (max 12); Math.trunc discards partial charges
  const charges = boundedInteger(event.charges || 0, 0, 0, skillNumber(skill, 'maximumStacks'));
  const strike = requireEffect(
    skill,
    'strike',
    isFocused ? 'Focused Electric Artillery' : 'Electric Artillery',
    action
  );

  if (strike)
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerStrike(event, {
        skillWeapon: WEAPON.SPEAR,
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
      Math.floor(
        charges / skillNumber(skill, isFocused ? 'focusedChargesPerVulnerability' : 'chargesPerVulnerability')
      ) * Number(vulnerability.stacks);

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
        condition: CONDITION.BURNING,
        stacks: Number(burning.stacks),
        duration:
          Number(burning.duration) +
          charges * skillNumber(skill, isFocused ? 'focusedBurningDurationPerCharge' : 'burningDurationPerCharge'),
        source: 'engineer',
        sourceId: event.skillId ?? event.sourceId,
        actorType: ACTOR.PLAYER,
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

/** Core hooks register this feature without owning its impact policy. */
const engineerSpearEventHandlers: RuntimeProfession<EngineerRuntimeState, EngineerSkill>['eventHandlers'] = {
  'engineer.lightning-rod-pulse': handleLightningRodPulse,
  'engineer.conduit-surge': handleConduitSurge,
  'engineer.electric-artillery': handleElectricArtillery
};

/** Spear actions, scheduled stages, observed events, and empowered packets share one owner. */
export const engineerSpearLifecycle = {
  sideEffectHandlers: engineerSpearSideEffectHandlers,
  tasks: engineerSpearTasks,
  eventHandlers: engineerSpearEventHandlers
} satisfies RuntimeHooks<EngineerRuntimeState, EngineerSkill>;
