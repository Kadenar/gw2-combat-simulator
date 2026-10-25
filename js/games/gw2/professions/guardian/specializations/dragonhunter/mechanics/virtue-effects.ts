import { ACTOR, CONDITION, BOON } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import { projectCastRelativeEffectTimingMs } from '#gw2/platform/execution/cast-timing.js';
import { armSkillFlip, consumeSkillFlip, expireSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { createPassiveCourageTask } from '#gw2/professions/guardian/core/mechanics/passive-courage.js';
import {
  admitVirtueActivation,
  completeVirtueActivation,
  guardianVirtueForSlot,
  justiceActivated,
  reactToJusticeHitWithOptions,
  refreshGuardianVirtues,
  type JusticeActivation
} from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { indomitableCourageInterval } from '#gw2/professions/guardian/core/traits/virtues/behavior.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { dragonhunterCastCompleted } from '#gw2/professions/guardian/specializations/dragonhunter/mechanics/trigger-points.js';
import { DRAGONHUNTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/dragonhunter/profiles.js';
import { dragonhunterState } from '#gw2/professions/guardian/specializations/dragonhunter/state.js';
import { bigGameHunterTetherDuration } from '#gw2/professions/guardian/specializations/dragonhunter/traits/behavior.js';
import type {
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianRuntime,
  GuardianRuntimeState,
  GuardianSkill
} from '#gw2/professions/guardian/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

function reactToDragonhunterJusticeHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  dependencies: Pick<NativeResolvedDamageDetails, 'hitContext'> = {}
): void {
  const outcome = reactToJusticeHitWithOptions(context, event, dependencies, {
    retainsPassive: false,
    skillId: ID.SPEAR_OF_JUSTICE,
    skillName: 'Spear of Justice'
  });

  // Only this hit's emitted passive Burning grants Crippled, after Burning's immediate reactions have settled.
  if (outcome === 'passive') {
    const tetherProfile = requireBalanceProfileFromContext(context, PROFILE.tether);
    const crippled = requireEffect(tetherProfile, 'condition', 'Crippled (passive)');

    if (crippled) {
      context.effects.emit({
        kind: 'packet',
        settlement: 'reaction',
        event: buildResolverCondition({
          at: event.at,
          source: 'guardian',
          sourceId: ID.SPEAR_OF_JUSTICE,
          // The passive condition belongs to the accepted hit, including delayed impacts.
          activationId: event.activationId,
          causalOrder: event.causalOrder ?? event.eventOrder,
          actorType: ACTOR.PLAYER,
          skillId: ID.SPEAR_OF_JUSTICE,
          skillName: 'Spear of Justice',
          name: 'Spear of Justice — Passive Crippled',
          condition: String(crippled.condition),
          stacks: effectNumber(tetherProfile, crippled, 'stacks'),
          duration: effectNumber(tetherProfile, crippled, 'duration')
        })
      });
    }
  }
}

const COURAGE = 'guardian.dragonhunter.courage';

const FURIOUS = 'guardian.dragonhunter.furious-focus';

const TETHER = 'guardian.dragonhunter.tether';

const BURN = 'guardian.dragonhunter.tether-burn';

const EXPIRY = 'guardian.dragonhunter.tether-expiry';

/** Dragonhunter gates its attributed Aegis packet on actual recharge and retains Indomitable Courage tuning. */
const couragePulse = createPassiveCourageTask({
  taskId: COURAGE,
  profileId: PROFILE.passiveCourage,
  interval: indomitableCourageInterval,
  ready(runtime) {
    refreshGuardianVirtues(runtime);
    return runtime.profession.core.virtueReadyAt.courage <= runtime.time;
  },
  deliver(runtime, profile, effect) {
    const skill = runtime.helpers.skillsById.get(ID.SHIELD_OF_COURAGE)!;
    runtime.effects.emit({
      kind: 'packet',
      event: {
        type: 'buff',
        at: runtime.time,
        source: 'guardian',
        sourceId: skill.id,
        actorType: ACTOR.PLAYER,
        skillId: skill.id,
        skillName: skill.name,
        name: 'Shield of Courage — Passive Aegis',
        kind: boonKey(BOON.AEGIS),
        duration: effectNumber(profile, effect, 'duration'),
        stacks: effectNumber(profile, effect, 'stacks')
      }
    });
  }
});

/** A landed spear attaches after commitment; failed hostile outcomes cannot arm the follow-up or create burning. */
function attachTether(runtime: GuardianRuntime, data: unknown): void {
  if (runtime.deathTime != null) return;

  const event = data as Gw2ResolverEvent;
  const state = dragonhunterState.from(runtime);

  if (state.tetherActivationId === event.activationId) return;

  const duration = bigGameHunterTetherDuration(runtime, 6);

  if (!(duration > 0)) return;

  state.tetherActivationId = event.activationId ?? null;
  state.tetherUntil = canonicalTime(runtime.time + duration);
  const window = armSkillFlip(
    runtime.profession.core.availableFlips,
    ID.HUNTERS_VERDICT,
    runtime.time,
    state.tetherUntil
  );
  runtime.schedule(EXPIRY, state.tetherUntil, { identity: window.identity }, undefined, -220);
  runtime.schedule(BURN, runtime.time, { event, activationId: state.tetherActivationId, deadline: state.tetherUntil });
}

/** Only the current tether schedules another pulse; replacing or breaking it invalidates already queued work. */
function tetherBurn(runtime: GuardianRuntime, data: unknown): void {
  const pulse = data as { event: Gw2ResolverEvent; activationId: string | null; deadline: number };
  const state = dragonhunterState.from(runtime);

  if (
    runtime.deathTime != null ||
    state.tetherActivationId !== pulse.activationId ||
    state.tetherUntil !== pulse.deadline ||
    runtime.time >= pulse.deadline
  )
    return;

  const profile = requireBalanceProfileFromContext(runtime, PROFILE.tether);
  const effect = requireEffect(profile, 'condition', CONDITION.BURNING);

  if (!effect) return;

  runtime.effects.emit({
    kind: 'packet',
    cause: pulse.event,
    event: buildResolverCondition({
      at: runtime.time,
      source: 'guardian',
      sourceId: ID.SPEAR_OF_JUSTICE,
      actorType: ACTOR.PLAYER,
      skillId: ID.SPEAR_OF_JUSTICE,
      skillName: 'Spear of Justice',
      name: 'Spear of Justice — Active Burning',
      condition: String(effect.condition),
      stacks: effectNumber(profile, effect, 'stacks'),
      duration: effectNumber(profile, effect, 'duration')
    })
  });
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  const next = canonicalTime(runtime.time + interval);

  if (interval > 0 && next < pulse.deadline) runtime.schedule(BURN, next, data);
}

/** Virtue readiness, passive Courage, and landed tether tasks share their cast and expiry owners. */
export const dragonhunterVirtueLifecycle: RuntimeHooks<GuardianRuntimeState, GuardianSkill> = {
  /** Hold the selected preview state while evaluating detached damage queries. */
  prepareDamageState(runtime, _skill, inputs) {
    dragonhunterState.from(runtime).tetherUntil = inputs.bigGameHunter ? Infinity : 0;
  },
  sideEffectHandlers: {
    // Breaking a tether retires its follow-up without touching parent recharge.
    'guardian.break-tether'(runtime) {
      dragonhunterState.from(runtime).tetherUntil = 0;
      consumeSkillFlip(runtime.profession.core.availableFlips, ID.HUNTERS_VERDICT);
    },
    'guardian.attach-tether'(runtime, context) {
      if (context.kind !== 'effect') return;

      const event = context.trigger.event;
      const action = runtime.facts
        .read()
        .find((candidate) => candidate.type === 'action' && candidate.activationId === event.activationId);

      if (!action) return;

      runtime.schedule(TETHER, Math.max(runtime.time, Number(action.endsAt)), event, undefined, -50);
    }
  },
  initialize(runtime) {
    runtime.schedule(COURAGE, runtime.time, undefined, undefined, -200);
  },
  onCastStart(runtime, cast) {
    if (!cast.skill.categories?.includes('Virtue')) return;

    const virtue = guardianVirtueForSlot(cast.skill.slot);

    if (!virtue || !admitVirtueActivation(runtime, cast, virtue)) return;

    if (cast.skill.id === ID.SPEAR_OF_JUSTICE && !cast.cancelled) {
      const at = canonicalTime(
        cast.start + projectCastRelativeEffectTimingMs(cast.skill, (cast.fullEnd - cast.start) * 1000, 480) / 1000
      );

      // Deferred attribution excludes the skill's executable reaction declarations.
      if (at <= cast.effectiveEnd)
        runtime.schedule(FURIOUS, at, { id: cast.id, skill: { id: cast.skill.id, name: cast.skill.name } });
    }
  },
  onCastCommit(runtime, cast) {
    const virtue = cast.skill.categories?.includes('Virtue') ? guardianVirtueForSlot(cast.skill.slot) : null;

    // Furious Focus waits for the spear's impact, so Justice's own point fires from that task instead.
    if (virtue) completeVirtueActivation(runtime, cast, virtue, { deferJustice: true });

    runtime.fireTrigger(dragonhunterCastCompleted, { cast });
  },
  tasks: {
    [COURAGE]: couragePulse,
    // The deferred spear grants Furious Focus at its own impact, later than the shared virtue rewards.
    [FURIOUS]: (runtime, data) => runtime.fireTrigger(justiceActivated, { cast: data as JusticeActivation['cast'] }),
    [TETHER]: attachTether,
    [BURN]: tetherBurn,
    [EXPIRY](runtime, data) {
      const { identity } = data as { identity: number | string };
      expireSkillFlip(runtime.profession.core.availableFlips, ID.HUNTERS_VERDICT, runtime.time, identity);
    }
  },
  reactions: {
    'damage.resolved'(runtime, event, details) {
      refreshGuardianVirtues(runtime);
      const damage = details as NativeResolvedDamageDetails;

      if (!(Number(event.coefficient) > 0) || !(Number(damage.hitContext?.damage) > 0)) return;

      reactToDragonhunterJusticeHit(runtime, event, damage);
    }
  }
};
