import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import {
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import { SIGIL_IDS } from '#gw2/platform/equipment/sigils/data.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { refreshGuardianVirtues } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import {
  applyGuardianVirtueActivationTraits,
  permeatingWrathThreshold,
  triggerGuardianFuriousFocus
} from '#gw2/professions/guardian/core/traits/behavior.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

import { WILLBENDER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/willbender/profiles.js';
import {
  ACTIVATE,
  FLAMES,
  willbenderVirtueActions
} from '#gw2/professions/guardian/specializations/willbender/skills/index.js';
import { willbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';
import {
  applyWillbenderActivationTraits,
  gainLethalTempo,
  lethalTempoParameters,
  applyWillbenderTriggerTraits,
  triggerPhoenixProtocol,
  willbenderVirtueWindowProfile
} from '#gw2/professions/guardian/specializations/willbender/traits/behavior.js';
import type { GuardianRuntimeState, GuardianSkill, GuardianVirtue } from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;
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
function activate(runtime: Runtime, data: unknown): void {
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
        audience: { recipients: 'self' }
      }
    });
  applyWillbenderActivationTraits(runtime, cause, virtue);
}

/** Same-virtue fields overlap; a different virtue retires all pending work from the prior flame group. */
function flames(runtime: Runtime, data: unknown): void {
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
function hit(runtime: Runtime, event: Gw2ResolverEvent, details: NativeResolvedDamageDetails): void {
  if (
    !((details.hitContext?.damage ?? 0) > 0) ||
    !(Number(event.coefficient) > 0) ||
    (event.actorType !== 'player' && event.sourceId !== `sigil.${SIGIL_IDS.AIR}`)
  )
    return;
  const state = willbenderState.from(runtime);
  for (const virtue of ['justice', 'resolve', 'courage'] as const) {
    const until = state[`${virtue}Until`];
    if (!(until > 0) || runtime.time > until) continue;
    const threshold = permeatingWrathThreshold(runtime, virtue, PROFILE.virtueWindows);
    state.virtueHitCounts[virtue]++;
    if (state.virtueHitCounts[virtue] < threshold) continue;
    state.virtueHitCounts[virtue] = 0;
    state.triggeredVirtueEffects++;
    applyWillbenderTriggerTraits(runtime, event);
    if (virtue === 'justice') {
      const profile = requireBalanceProfileFromContext(runtime, CORE_PROFILE.justice);
      const burn = requireEffect(profile, 'condition', 'Burning (active)');
      if (burn) {
        runtime.profession.core.justiceActiveBurns++;
        runtime.effects.emit({
          kind: 'packet',
          cause: event,
          event: buildResolverCondition({
            at: runtime.time,
            priority: 5,
            source: 'guardian',
            sourceId: 'guardian.justice-passive',
            actorType: 'player',
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
      for (const name of ['aegis', 'stability']) {
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
              actorType: 'player',
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
              audience: { recipients: 'self' }
            })
          });
        }
      }

    triggerPhoenixProtocol(runtime, event, virtue);
  }
}

/** Virtue windows, flame lifetimes, and earned recharge reductions live beside the shared cast and damage owners. */
export const willbenderHooks: Partial<RuntimeProfession<GuardianRuntimeState, GuardianSkill>> = {
  /** Initial Tempo uses its normal grant function, retaining the selected cap and subsequent refresh behavior. */
  initialize(runtime) {
    const parameters = lethalTempoParameters(runtime);
    if (!parameters) return;
    for (const buff of runtime.config.initialBuffs ?? []) {
      if (buff.kind !== 'lethal-tempo') continue;
      for (let i = 0; i < Math.min(buff.stacks, parameters.maximumStacks); i++)
        gainLethalTempo(willbenderState.from(runtime), runtime.time, { ...parameters, duration: buff.duration });
    }
  },
  sideEffectHandlers: willbenderVirtueActions,
  availability(runtime, skill) {
    return skill.id === ID.REPOSE && !skillFlipReady(runtime.profession.core.availableFlips[ID.REPOSE], runtime.time)
      ? denySkillCast(skill, 'guardian.flip-not-armed', 'not currently armed.')
      : { ready: true };
  },
  onCastStart(runtime, cast) {
    if (cast.cancelled) return;
    const virtue = VIRTUES.find(([id]) => id === cast.skill.id)?.[1];
    if (!virtue) return;
    refreshGuardianVirtues(runtime);
    if (runtime.profession.core.virtueReadyAt[virtue] <= runtime.time) readyVirtues.add(cast);
  },
  onCastCommit(runtime, cast) {
    const virtue = VIRTUES.find(([id]) => id === cast.skill.id)?.[1];
    if (virtue) {
      refreshGuardianVirtues(runtime);
      if (readyVirtues.has(cast)) {
        applyGuardianVirtueActivationTraits(runtime, cast, virtue);
        if (virtue === 'justice') triggerGuardianFuriousFocus(runtime, cast);
      }
    }
  },
  tasks: {
    [ACTIVATE]: activate,
    [FLAMES]: flames,
    [PULSE](runtime, data) {
      const event = data as Gw2ResolverEvent;
      runtime.effects.emit({
        kind: 'packet',
        event: buildResolverStrike({ ...event, at: runtime.time, coefficient: Number(event.coefficient) })
      });
    }
  },
  reactions: {
    'damage.resolved': (runtime, event, details) => hit(runtime, event, details)
  }
};
