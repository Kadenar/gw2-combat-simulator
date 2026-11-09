import { boonKey } from '#gw2/platform/combat/boons.js';
import { ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { projectCastRelativeEffectTimingMs } from '#gw2/platform/execution/cast-timing.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { effectNumber, requireEffect, requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { createPassiveCourageTask } from '#gw2/professions/guardian/core/mechanics/passive-courage.js';
import {
  admitVirtueActivation,
  completeVirtueActivation,
  justiceActivated,
  reactToJusticeHitWithOptions,
  type JusticeActivation
} from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { indomitableCourageInterval } from '#gw2/professions/guardian/core/traits/virtues/behavior.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { dragonhunterCastCompleted } from '#gw2/professions/guardian/specializations/dragonhunter/mechanics/trigger-points.js';
import { dragonhunterState } from '#gw2/professions/guardian/specializations/dragonhunter/state.js';
import { bigGameHunterTetherDuration } from '#gw2/professions/guardian/specializations/dragonhunter/traits/behavior.js';
import type {
  GuardianResolverEvent,
  GuardianRuntime,
  GuardianRuntimeState,
  GuardianSkill,
  GuardianVirtueContext
} from '#gw2/professions/guardian/types.js';
import { guardianVirtueReadyAt } from '#gw2/professions/guardian/virtue-readiness.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Reuse Justice's hit counter and passive suppression, adding Dragonhunter's Crippled only when that hit procs Burning. */
function reactToDragonhunterJusticeHit(context: GuardianVirtueContext, event: GuardianResolverEvent): void {
  const outcome = reactToJusticeHitWithOptions(context, event, {
    retainsPassive: false,
    skillId: ID.SPEAR_OF_JUSTICE,
    skillName: 'Spear of Justice'
  });

  // Only this hit's emitted passive Burning grants Crippled, after Burning's immediate reactions have settled.
  if (outcome === 'passive') {
    const skill = requireSkill(context.helpers, ID.SPEAR_OF_JUSTICE);
    const crippled = requireEffect(skill, 'condition', 'Crippled (passive)');

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
          name: 'Spear of Justice - Passive Crippled',
          condition: String(crippled.condition),
          stacks: effectNumber(skill, crippled, 'stacks'),
          duration: effectNumber(skill, crippled, 'duration')
        })
      });
    }
  }
}

const COURAGE = 'guardian.dragonhunter.courage';

const FURIOUS = 'guardian.dragonhunter.furious-focus';

const TETHER = 'guardian.dragonhunter.tether';

const BURN = 'guardian.dragonhunter.tether-burn';

/** Dragonhunter gates its attributed Aegis packet on actual recharge and retains Indomitable Courage tuning. */
const couragePulse = createPassiveCourageTask({
  taskId: COURAGE,
  skillId: ID.SHIELD_OF_COURAGE,
  interval: indomitableCourageInterval,
  ready(runtime) {
    return guardianVirtueReadyAt(runtime, 'courage') <= runtime.time;
  },
  deliver(runtime, owner, effect) {
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
        name: 'Shield of Courage - Passive Aegis',
        kind: boonKey(BOON.AEGIS),
        duration: effectNumber(owner, effect, 'duration'),
        stacks: effectNumber(owner, effect, 'stacks')
      }
    });
  }
});

/** A landed spear attaches after commitment; failed hostile outcomes cannot arm the follow-up or create burning. */
function attachTether(runtime: GuardianRuntime, data: unknown): void {
  if (runtime.deathTime != null) return;

  const event = data as Gw2ResolverEvent;
  const state = dragonhunterState.from(runtime.profession);

  if (state.tetherActivationId === event.activationId) return;

  const duration = bigGameHunterTetherDuration(
    runtime,
    skillNumber(requireSkill(runtime.helpers, ID.SPEAR_OF_JUSTICE), 'duration')
  );

  if (!(duration > 0)) return;

  state.tetherActivationId = event.activationId ?? null;
  state.tetherUntil = canonicalTime(runtime.time + duration);
  runtime.armFlip(ID.HUNTERS_VERDICT, { expiresAt: state.tetherUntil });
  runtime.schedule(BURN, runtime.time, { event, activationId: state.tetherActivationId, deadline: state.tetherUntil });
}

/** Only the current tether schedules another pulse; replacing or breaking it invalidates already queued work. */
function tetherBurn(runtime: GuardianRuntime, data: unknown): void {
  const pulse = data as { event: Gw2ResolverEvent; activationId: string | null; deadline: number };
  const state = dragonhunterState.from(runtime.profession);

  if (
    runtime.deathTime != null ||
    state.tetherActivationId !== pulse.activationId ||
    state.tetherUntil !== pulse.deadline ||
    runtime.time >= pulse.deadline
  )
    return;

  const owner = requireSkill(runtime.helpers, ID.SPEAR_OF_JUSTICE);
  const effect = requireEffect(owner, 'condition', CONDITION.BURNING);

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
      name: 'Spear of Justice - Active Burning',
      condition: String(effect.condition),
      stacks: effectNumber(owner, effect, 'stacks'),
      duration: effectNumber(owner, effect, 'duration')
    })
  });
  const interval = skillNumber(owner, 'tetherInterval');
  const next = canonicalTime(runtime.time + interval);

  if (interval > 0 && next < pulse.deadline) runtime.schedule(BURN, next, data);
}

/** Virtue readiness, passive Courage, and landed tether tasks share their cast and expiry owners. */
export const dragonhunterVirtueLifecycle: RuntimeHooks<GuardianRuntimeState, GuardianSkill> = {
  /** Hold the selected preview state while evaluating detached damage queries. */
  prepareDamageState(runtime, _skill, inputs) {
    dragonhunterState.from(runtime.profession).tetherUntil = inputs.bigGameHunter ? Infinity : 0;
  },
  sideEffectHandlers: {
    // Breaking a tether retires its follow-up without touching parent recharge.
    'guardian.break-tether'(runtime) {
      dragonhunterState.from(runtime.profession).tetherUntil = 0;
      runtime.consumeFlip(ID.HUNTERS_VERDICT);
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
    const virtue = cast.skill.virtue;

    if (!virtue || !admitVirtueActivation(runtime, cast, virtue)) return;

    if (cast.skill.id === ID.SPEAR_OF_JUSTICE && !cast.cancelledBeforeCommit) {
      const at = canonicalTime(
        cast.start + projectCastRelativeEffectTimingMs(cast.skill, (cast.fullEnd - cast.start) * 1000, 480) / 1000
      );

      // Deferred attribution excludes the skill's executable reaction declarations.
      if (at <= cast.effectiveEnd)
        runtime.schedule(FURIOUS, at, { id: cast.id, skill: { id: cast.skill.id, name: cast.skill.name } });
    }
  },
  onCastCommit(runtime, cast) {
    const virtue = cast.skill.virtue;

    // Furious Focus waits for the spear's impact, so Justice's own point fires from that task instead.
    if (virtue) completeVirtueActivation(runtime, cast, virtue, { deferJustice: true });

    runtime.fireTrigger(dragonhunterCastCompleted, { cast });
  },
  tasks: {
    [COURAGE]: couragePulse,
    // The deferred spear grants Furious Focus at its own impact, later than the shared virtue rewards.
    [FURIOUS]: (runtime, data) => runtime.fireTrigger(justiceActivated, { cast: data as JusticeActivation['cast'] }),
    [TETHER]: attachTether,
    [BURN]: tetherBurn
  },
  reactions: {
    'damage.resolved'(runtime, event, details) {
      if (!(Number(event.coefficient) > 0) || !(details.hitContext.damage > 0)) return;

      reactToDragonhunterJusticeHit(runtime, event);
    }
  }
};
