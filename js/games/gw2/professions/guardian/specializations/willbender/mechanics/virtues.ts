import { RECIPIENT, ACTOR, BOON } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import type { ActionContext } from '#gw2/platform/effects/actions.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { SIGIL_IDS } from '#gw2/platform/equipment/sigils/data.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import {
  justiceActivated,
  refreshGuardianVirtues,
  virtueActivated
} from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import { permeatingWrathThreshold } from '#gw2/professions/guardian/core/traits/virtues/behavior.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import {
  willbenderVirtueOpened,
  willbenderVirtueTriggered
} from '#gw2/professions/guardian/specializations/willbender/mechanics/trigger-points.js';
import { WILLBENDER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/willbender/profiles.js';
import { willbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';
import { willbenderVirtueWindowProfile } from '#gw2/professions/guardian/specializations/willbender/traits/behavior.js';
import type {
  GuardianRuntime,
  GuardianRuntimeState,
  GuardianSkill,
  GuardianVirtue
} from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const PULSE = 'guardian.willbender.pulse';

const readyVirtues = new WeakSet<RuntimeCast<GuardianSkill>>();

const VIRTUES = [
  [ID.RUSHING_JUSTICE, 'justice'],
  [ID.FLOWING_RESOLVE, 'resolve'],
  [ID.CRASHING_COURAGE, 'courage']
] as const;

const FLAME_IDS = {
  justice: ID.WILLBENDER_FLAMES_ID_62618,
  resolve: ID.WILLBENDER_FLAMES,
  courage: ID.WILLBENDER_FLAMES_COURAGE
};

const flameOwner = (generation: number) => ({ id: 'willbender-flames', generation });

/** Windows open at their authored boundary without predicting hits or resetting partial hit progress. */
function activate(runtime: GuardianRuntime, data: unknown): void {
  const { cast, virtue } = data as { cast: RuntimeCast<GuardianSkill>; virtue: GuardianVirtue };
  const profile = willbenderVirtueWindowProfile(runtime, virtue);
  const window = requireEffect(profile, 'buff', virtue);
  const state = willbenderState.from(runtime);
  const cause = guardianCastCause(runtime, cast);
  state[`${virtue}Until`] = window ? gw2EffectExpiresAt(runtime.time, effectNumber(profile, window, 'duration')) : 0;

  if (window)
    runtime.effects.emit({
      kind: 'packet',
      event: {
        ...cause,
        kind: `willbender-${virtue}`,
        duration: effectNumber(profile, window, 'duration'),
        stacks: 1,
        audience: { recipients: RECIPIENT.SELF }
      }
    });

  runtime.fireTrigger(willbenderVirtueOpened, { cause, virtue });
}

/** Same-virtue fields overlap; a different virtue retires all pending work from the prior flame group. */
function flames(runtime: GuardianRuntime, data: unknown): void {
  const { cast, virtue } = data as { cast: RuntimeCast<GuardianSkill>; virtue: GuardianVirtue };
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.flames);
  const strike = requireEffect(profile, 'strike', 'Strike');

  if (!strike) return;

  if (!strike.ticks?.length) throw new Error('Willbender Flames requires an explicit strike timeline.');

  const state = willbenderState.from(runtime);

  if (state.flameVirtue !== virtue) {
    runtime.cancelOwner(flameOwner(state.flameGeneration));
    state.flameGeneration++;
    state.flameVirtue = virtue;
  }

  for (const [index, tick] of strike.ticks.entries())
    runtime.schedule(
      PULSE,
      canonicalTime(runtime.time + tick.atMs / 1000),
      {
        ...guardianCastCause(runtime, cast),
        type: 'damage',
        sourceId: FLAME_IDS[virtue],
        skillId: FLAME_IDS[virtue],
        skillName: 'Willbender Flames',
        name: 'Willbender Flames',
        activationId: `${cast.id}:flames`,
        coefficient: tick.coefficient,
        skillWeapon: 'Unequipped',
        hitIndex: index + 1,
        totalHits: strike.ticks.length,
        willbenderFlames: true,
        offTarget: cast.command.offTarget
      },
      flameOwner(state.flameGeneration)
    );
}

/** Accepted player strikes and Air sigil procs advance each currently open virtue; no scheduler prediction is consulted. */
function reactToWillbenderHit(
  runtime: GuardianRuntime,
  event: Gw2ResolverEvent,
  details: NativeResolvedDamageDetails
): void {
  if (
    !((details.hitContext?.damage ?? 0) > 0) ||
    !(Number(event.coefficient) > 0) ||
    (event.actorType !== ACTOR.PLAYER && event.sourceId !== `sigil.${SIGIL_IDS.AIR}`)
  )
    return;

  const state = willbenderState.from(runtime);
  for (const virtue of ['justice', 'resolve', 'courage'] as const) {
    const until = state[`${virtue}Until`];

    if (!(until > 0) || runtime.time > until) continue;

    const threshold = permeatingWrathThreshold(runtime, virtue, PROFILE.virtueWindows);
    // Each open virtue owns its cycle; reset it before traits and virtue rewards react to completion.
    const progress = advanceCounter(state.virtueHitCounts[virtue], 1, threshold, 'reset');
    state.virtueHitCounts[virtue] = progress.value;

    if (!progress.reached) continue;

    runtime.fireTrigger(willbenderVirtueTriggered, { cause: event, virtue });

    if (virtue === 'justice') {
      const profile = requireBalanceProfileFromContext(runtime, CORE_PROFILE.justice);
      const burn = requireEffect(profile, 'condition', 'Burning (active)');

      if (burn) {
        runtime.effects.emit({
          kind: 'packet',
          cause: event,
          event: buildResolverCondition({
            at: runtime.time,
            priority: 5,
            source: 'guardian',
            sourceId: 'guardian.justice-passive',
            actorType: ACTOR.PLAYER,
            skillId: ID.WILLBENDER_JUSTICE,
            skillName: 'Justice',
            // Keep virtue damage separate from the attack that satisfies its hit counter.
            procType: 'profession',
            name: 'Justice — Active Burning',
            icon: runtime.helpers.skillsById.get(ID.RUSHING_JUSTICE)?.icon,
            condition: String(burn.condition),
            stacks: effectNumber(profile, burn, 'stacks'),
            duration: effectNumber(profile, burn, 'duration'),
            triggeredBy: event.skillName
          })
        });
      }
    }

    if (virtue === 'courage')
      for (const name of [boonKey(BOON.AEGIS), boonKey(BOON.STABILITY)]) {
        const profile = requireBalanceProfileFromContext(runtime, PROFILE.courageTrigger);
        const effect = requireEffect(profile, 'boon', name);

        if (effect) {
          runtime.effects.emit({
            kind: 'profile',
            profile: profile,
            effects: [effect],
            attribution: {
              source: 'guardian',
              sourceId: ID.CRASHING_COURAGE,
              actorType: ACTOR.PLAYER,
              skillId: ID.CRASHING_COURAGE,
              skillName: profile.name,
              activationId: event.activationId,
              triggeredBy: event.skillName
            },
            transform: (packet) => ({
              ...packet,
              duration: packet.duration,
              name: profile.name + ' — ' + name,
              causalOrder: event.causalOrder ?? event.eventOrder,
              audience: { recipients: RECIPIENT.SELF }
            })
          });
        }
      }
  }
}

const ACTIVATE = 'guardian.willbender.activate';

const FLAMES = 'guardian.willbender.flames';

/** Activation recipes preserve the window/flame boundaries and priority ahead of shared lifetime work. */
const willbenderVirtueActions: RuntimeProfession<GuardianRuntimeState, GuardianSkill>['sideEffectHandlers'] =
  Object.fromEntries(
    (
      [
        ['justice', (cast: RuntimeCast<GuardianSkill>) => Math.min(cast.effectiveEnd, cast.start + 0.04)],
        ['resolve', (cast: RuntimeCast<GuardianSkill>) => cast.effectiveEnd],
        ['courage', (cast: RuntimeCast<GuardianSkill>) => Math.min(cast.effectiveEnd, cast.start + 0.52)]
      ] as const
    ).map(([virtue, activationAt]) => [
      `guardian.start-${virtue}`,
      (runtime: GuardianRuntime, context: ActionContext<GuardianSkill>) => {
        if (context.kind !== 'cast') return;

        const cast = context.cast;
        const at = canonicalTime(activationAt(cast));
        const flameAt = canonicalTime(
          virtue === 'resolve' ? cast.start : virtue === 'justice' ? Math.max(at, cast.effectiveEnd - 0.04) : at
        );
        runtime.scheduleForCast(ACTIVATE, at, cast, { virtue });
        runtime.scheduleForCast(FLAMES, flameAt, cast, { virtue }, undefined, -10);
      }
    ])
  );

/** Capture virtue readiness at acceptance before the skill changes its window. */
function prepareWillbenderVirtue(runtime: GuardianRuntime, cast: RuntimeCast<GuardianSkill>): void {
  if (cast.cancelled) return;

  const virtue = VIRTUES.find(([id]) => id === cast.skill.id)?.[1];

  if (!virtue) return;

  refreshGuardianVirtues(runtime);

  if (runtime.profession.core.virtueReadyAt[virtue] <= runtime.time) readyVirtues.add(cast);
}

/** Committed virtues publish shared activation rewards only for their accepted readiness. */
function completeWillbenderVirtue(runtime: GuardianRuntime, cast: RuntimeCast<GuardianSkill>): void {
  const virtue = VIRTUES.find(([id]) => id === cast.skill.id)?.[1];

  if (virtue) {
    refreshGuardianVirtues(runtime);

    if (readyVirtues.has(cast)) {
      runtime.fireTrigger(virtueActivated, { cast, virtue });

      if (virtue === 'justice') runtime.fireTrigger(justiceActivated, { cast });
    }
  }
}

/** Keep scheduled work with the state and generation that own its lifetime. */
const willbenderVirtueTasks: NonNullable<RuntimeHooks<GuardianRuntimeState, GuardianSkill>['tasks']> = {
  [ACTIVATE]: activate,
  [FLAMES]: flames,
  [PULSE](runtime, data) {
    const event = data as Gw2ResolverEvent;
    runtime.effects.emit({
      kind: 'packet',
      event: buildResolverStrike({ ...event, at: runtime.time, coefficient: Number(event.coefficient) })
    });
  }
};

/** Virtue readiness, activation recipes, active windows, hit counters, and flame tasks share one owner. */
export const willbenderVirtueLifecycle = {
  sideEffectHandlers: willbenderVirtueActions,
  onCastStart: prepareWillbenderVirtue,
  onCastCommit: completeWillbenderVirtue,
  tasks: willbenderVirtueTasks,
  reactions: { 'damage.resolved': reactToWillbenderHit }
} satisfies RuntimeHooks<GuardianRuntimeState, GuardianSkill>;
