import { emitThiefStateSnapshot } from '#gw2/content/professions/thief/state.js';
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2AlliedPlayerAssumptions } from '#gw2/platform/combat/state/allied-players.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/content/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { specterState } from '#gw2/content/professions/thief/specializations/specter/state.js';
import type { ThiefScheduledTask, ThiefSchedulerContext } from '#gw2/content/professions/thief/types.js';
import type {
  ThiefCastContext,
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefSimulationEvent,
  ThiefSkill
} from '#gw2/content/professions/thief/types.js';

import { SPECTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/thief/specializations/specter/profiles.js';

const ROT_WALLOW_VENOM_ICON = 'https://render.guildwars2.com/file/0F0B6509C8D5023D949153929E02FD2195AF63FE/2503654.png';

interface LarcenousTormentTaskPayload extends Record<string, unknown> {
  readonly stacks: number;
}

interface DarkSentryTaskPayload extends Record<string, unknown> {
  readonly maximumRecipients?: number;
  readonly allyIndices?: readonly number[];
}

/** Adds Shade Step's ally boon and arms Dark Sentry for barrier skills. */
export function completeShadowShroudSkill(context: ThiefCastContext, skill: ThiefSkill): void {
  // Shadow shroud skills suppressed mid-cast should not grant their trait effects.
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  if (hasTrait(context.config, TRAIT.SHADESTEP)) {
    const profile = balanceProfileFromContext(context, PROFILE.shadeStep);
    const authoredBoon =
      skill.id === ID.GRASPING_SHADOWS
        ? { index: 0, fallback: 'alacrity', duration: 5 }
        : skill.id === ID.DAWNS_REPOSE
          ? { index: 1, fallback: 'protection', duration: 5 }
          : skill.id === ID.MIND_SHOCK
            ? { index: 2, fallback: 'aegis', duration: 4 }
            : null;
    if (authoredBoon) {
      // Resolve the selected Shade Step packet once, then emit it through the canonical boon path.
      const effect = balanceProfileEffect(profile, 'boon', authoredBoon.index);
      const boon = String(effect?.boon || authoredBoon.fallback);
      emitSkillBuff(context, {
        at: context.effectiveEnd,
        source: 'Trait',
        sourceId: TRAIT.SHADESTEP,
        actorType: 'player',
        skillId: context.skill.id,
        skillName: context.skill.name,
        name: `Shade Step - ${boon}`,
        kind: boon,
        boon,
        duration: gw2SchedulerBoonDuration(
          context,
          context.skill,
          boon,
          Number(effect?.duration || authoredBoon.duration)
        ),
        stacks: 1,
        audience: { recipients: 'party' as const }
      });
    }
  }

  // Dawn's Repose grants barrier to the tethered ally and nearby allies, not the caster.
  // Dark Sentry is a mandatory Specter minor trait.
  if (skill.id === ID.DAWNS_REPOSE) {
    const profile = balanceProfileFromContext(context, PROFILE.dawnsReposeBarrier);
    const barrier = balanceProfileEffect(profile, 'buff');
    const alliedRecipients = Math.min(
      Number(profile?.maximumTargets || 4),
      gw2AlliedPlayerAssumptions(context.config).count
    );
    if (!alliedRecipients) return;
    const allyIndices = Array.from({ length: alliedRecipients }, (_, index) => index + 1);
    emitSkillBuff(context, {
      at: context.effectiveEnd,
      source: 'thief',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: "Dawn's Repose - Barrier",
      kind: 'barrier',
      duration: Number(barrier?.duration || 5),
      stacks: Number(barrier?.stacks || 1),
      audience: { recipients: 'party' as const, affectsSelf: false, maximumRecipients: alliedRecipients }
    });
    context.tasks.schedule({
      type: 'thief.specter-dark-sentry',
      at: context.effectiveEnd,
      payload: { allyIndices }
    });
  }
}

/** Defers shadow-force gains until each torment application actually lands. */
export function observeSpecterEvent(context: ThiefSchedulerContext, event: ThiefSimulationEvent): void {
  if (
    event.type !== 'condition' ||
    event.condition !== 'Torment' ||
    event.actorType !== 'player' ||
    !hasTrait(context.config, TRAIT.LARCENOUS_TORMENT)
  )
    return;
  // eventOrder makes the id unique per Torment application so concurrent bursts don't collide.
  context.tasks.schedule({
    id: `thief.larcenous-torment:${event.eventOrder}`,
    type: 'thief.larcenous-torment',
    at: Math.max(context.state.time, event.at),
    payload: { stacks: Number(event.stacks || 0) }
  });
}

export function handleLarcenousTorment(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<LarcenousTormentTaskPayload>
): void {
  const stacks = Math.max(0, Number(task.payload.stacks || 0));
  if (!(stacks > 0)) return;
  const state = specterState.from(context);
  const profile = balanceProfileFromContext(context, PROFILE.larcenousTorment);
  state.shadowForce = Math.min(
    state.maximumShadowForce,
    state.shadowForce + stacks * Number(profile?.resourceGain || 0.5)
  );
  emitThiefStateSnapshot(context, task.at, 'larcenous-torment');
}

export function handleDarkSentry(
  context: ThiefSchedulerContext,
  task: ThiefScheduledTask<DarkSentryTaskPayload>
): void {
  const state = specterState.from(context);
  const party = gw2AlliedPlayerAssumptions(context.config);
  const maximumRecipients = Math.min(
    party.count,
    Math.max(0, Math.trunc(Number(task.payload.maximumRecipients ?? party.count)))
  );
  const requestedAllies = task.payload.allyIndices
    ? [
        ...new Set(
          task.payload.allyIndices
            .map(Number)
            .filter((allyIndex) => Number.isInteger(allyIndex) && allyIndex >= 1 && allyIndex <= party.count)
        )
      ]
    : Array.from({ length: maximumRecipients }, (_, index) => index + 1);
  const eligibleAllies = requestedAllies.filter((allyIndex) =>
    isInternalCooldownReady(task.at, Number(state.darkSentryReadyAtByAlly[String(allyIndex)] || 0))
  );
  const recipientCount = eligibleAllies.length;
  if (!recipientCount) return;
  const profile = balanceProfileFromContext(context, PROFILE.darkSentry);
  const venom = balanceProfileEffect(profile, 'buff');
  const torment = balanceProfileEffect(profile, 'condition');
  for (const allyIndex of eligibleAllies) {
    state.darkSentryReadyAtByAlly[String(allyIndex)] = task.at + Number(profile?.internalCooldown || 1);
  }

  state.darkSentryReadyAt = Math.max(0, ...Object.values(state.darkSentryReadyAtByAlly));
  emitSkillBuff(context, {
    at: task.at,
    source: 'Trait',
    sourceId: TRAIT.DARK_SENTRY,
    actorType: 'player',
    skillId: TRAIT.DARK_SENTRY,
    skillName: 'Dark Sentry',
    name: 'Rot Wallow Venom',
    icon: ROT_WALLOW_VENOM_ICON,
    kind: 'rot-wallow-venom',
    duration: Number(venom?.duration || 10),
    stacks: Number(venom?.stacks || 1),
    audience: { recipients: 'party' as const, affectsSelf: false, maximumRecipients: recipientCount }
  });
  // Rot Wallow Venom procs on the next allied strike, not immediately on application.
  if (party.strikesPerSecond > 0) {
    const procAt = task.at + 1 / party.strikesPerSecond;
    for (const allyIndex of eligibleAllies) {
      emitSkillCondition(context, {
        at: procAt,
        source: 'Trait',
        sourceId: TRAIT.DARK_SENTRY,
        actorType: 'player',
        skillId: TRAIT.DARK_SENTRY,
        skillName: 'Rot Wallow Venom',
        name: `Rot Wallow Venom - Ally ${allyIndex} Torment`,
        icon: ROT_WALLOW_VENOM_ICON,
        condition: String(torment?.condition || 'Torment'),
        stacks: Number(torment?.stacks || 1),
        duration: Number(torment?.duration || 2),
        triggeredByAlly: allyIndex
      });
    }
  }

  emitThiefStateSnapshot(context, task.at, 'dark-sentry');
}

/** Resolver-side life siphons fire once for every applied torment stack. */
export function applyLarcenousTorment(context: ThiefResolverContext, application: ThiefResolverEvent): void {
  if (
    application.condition !== 'Torment' ||
    application.actorType !== 'player' ||
    !hasTrait(context.config, TRAIT.LARCENOUS_TORMENT)
  )
    return;
  // One life-siphon event per stack so each stack shows as a separate hit in the log.
  const stacks = Math.max(0, Math.trunc(Number(application.stacks || 0)));
  const profile = balanceProfileFromContext(context, PROFILE.larcenousTorment);
  const strike = balanceProfileEffect(profile, 'strike');
  for (let stack = 1; stack <= stacks; stack += 1) {
    enqueueOrdered(context.queue, {
      type: 'damage',
      at: application.at,
      source: 'Trait',
      sourceId: TRAIT.LARCENOUS_TORMENT,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: TRAIT.LARCENOUS_TORMENT,
      skillName: 'Larcenous Torment',
      name: 'Larcenous Torment - Life Siphon',
      coefficient: Number(strike?.coefficient || 0.005),
      hits: 1,
      canCrit: false,
      noCrit: true,
      lifeSiphon: true,
      triggeredBy: application.skillName,
      stackIndex: stack
    });
  }

  const state = specterState.from(context);
  state.shadowForce = Math.min(
    state.maximumShadowForce,
    state.shadowForce + stacks * Number(profile?.resourceGain || 0.5)
  );
}
