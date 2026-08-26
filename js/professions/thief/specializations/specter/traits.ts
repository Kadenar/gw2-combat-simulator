import { enqueueOrdered } from '../../../../platform/engine/events/queue.js';
import { gw2AlliedPlayerAssumptions } from '../../../../platform/gw2/combat/state/allied-players.js';
import { gw2SchedulerBoonDuration } from '../../../../platform/gw2/scheduler/policy.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { hasThiefTrait } from '../../core/state.js';
import { emitThiefState } from '../../core/shared.js';
import { specterState } from './state.js';
import type { ThiefScheduledTask, ThiefSchedulerContext } from '../../types.js';
import type {
  ThiefCastContext,
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefSimulationEvent,
  ThiefSkill
} from '../../types.js';
import { thiefBalanceProfile, thiefBalanceProfileEffect } from '../../core/profiles.js';
import { SPECTER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

const ROT_WALLOW_VENOM_ICON = 'https://render.guildwars2.com/file/0F0B6509C8D5023D949153929E02FD2195AF63FE/2503654.png';

interface LarcenousTormentTaskPayload extends Record<string, unknown> {
  readonly stacks: number;
}

interface DarkSentryTaskPayload extends Record<string, unknown> {
  readonly maximumRecipients?: number;
  readonly allyIndices?: readonly number[];
}

function emitShadeStepBoon(context: ThiefCastContext, boon: string, duration: number): void {
  const party = gw2AlliedPlayerAssumptions(context.config);
  context.emit({
    type: 'buff',
    at: context.effectiveEnd,
    source: 'Trait',
    sourceId: TRAIT.SHADESTEP,
    actorType: 'player',
    skillId: context.skill.id,
    skillName: context.skill.name,
    name: `Shade Step - ${boon}`,
    kind: boon,
    boon,
    duration: gw2SchedulerBoonDuration(context, context.skill, boon, duration),
    stacks: 1,
    recipients: 'party',
    recipientCount: party.count + 1
  });
}

/** Adds Shade Step's ally boon and arms Dark Sentry for barrier skills. */
export function completeShadowShroudSkill(context: ThiefCastContext, skill: ThiefSkill): void {
  // Shadow shroud skills suppressed mid-cast should not grant their trait effects.
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  if (hasThiefTrait(context.config, TRAIT.SHADESTEP)) {
    const profile = thiefBalanceProfile(context, PROFILE.shadeStep);
    if (skill.id === ID.GRASPING_SHADOWS) {
      const boon = thiefBalanceProfileEffect(profile, 'boon', 0);
      emitShadeStepBoon(context, String(boon?.boon || 'alacrity'), Number(boon?.duration || 5));
    } else if (skill.id === ID.DAWNS_REPOSE) {
      const boon = thiefBalanceProfileEffect(profile, 'boon', 1);
      emitShadeStepBoon(context, String(boon?.boon || 'protection'), Number(boon?.duration || 5));
    } else if (skill.id === ID.MIND_SHOCK) {
      const boon = thiefBalanceProfileEffect(profile, 'boon', 2);
      emitShadeStepBoon(context, String(boon?.boon || 'aegis'), Number(boon?.duration || 4));
    }
  }

  // Dawn's Repose grants barrier to the tethered ally and nearby allies.
  // Dark Sentry is a mandatory Specter minor trait.
  if (skill.id === ID.DAWNS_REPOSE) {
    const profile = thiefBalanceProfile(context, PROFILE.dawnsReposeBarrier);
    const barrier = thiefBalanceProfileEffect(profile, 'buff');
    const alliedRecipients = Math.min(
      Number(profile?.maximumTargets || 4),
      gw2AlliedPlayerAssumptions(context.config).count
    );
    if (!alliedRecipients) return;
    const allyIndices = Array.from({ length: alliedRecipients }, (_, index) => index + 1);
    context.emit({
      type: 'buff',
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
      affectsSelf: false,
      recipients: 'allies',
      recipientCount: alliedRecipients,
      maximumRecipients: alliedRecipients
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
    !hasThiefTrait(context.config, TRAIT.LARCENOUS_TORMENT)
  )
    return;
  // __order makes the id unique per Torment application so concurrent bursts don't collide.
  context.tasks.schedule({
    id: `thief.larcenous-torment:${event.__order}`,
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
  const profile = thiefBalanceProfile(context, PROFILE.larcenousTorment);
  state.shadowForce = Math.min(
    state.maximumShadowForce,
    state.shadowForce + stacks * Number(profile?.resourceGain || 0.5)
  );
  emitThiefState(context, task.at, 'larcenous-torment');
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
  const eligibleAllies = requestedAllies.filter(
    (allyIndex) => task.at + context.epsilon >= Number(state.darkSentryReadyAtByAlly[String(allyIndex)] || 0)
  );
  const recipientCount = eligibleAllies.length;
  if (!recipientCount) return;
  const profile = thiefBalanceProfile(context, PROFILE.darkSentry);
  const venom = thiefBalanceProfileEffect(profile, 'buff');
  const torment = thiefBalanceProfileEffect(profile, 'condition');
  for (const allyIndex of eligibleAllies) {
    state.darkSentryReadyAtByAlly[String(allyIndex)] = task.at + Number(profile?.internalCooldown || 1);
  }

  state.darkSentryReadyAt = Math.max(0, ...Object.values(state.darkSentryReadyAtByAlly));
  context.emit({
    type: 'buff',
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
    affectsSelf: false,
    recipients: 'allies',
    recipientCount,
    maximumRecipients: recipientCount
  });
  // Rot Wallow Venom procs on the next allied strike, not immediately on application.
  if (party.strikesPerSecond > 0) {
    const procAt = task.at + 1 / party.strikesPerSecond;
    for (const allyIndex of eligibleAllies) {
      context.emit({
        type: 'condition',
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

  emitThiefState(context, task.at, 'dark-sentry');
}

/** Resolver-side life siphons fire once for every applied torment stack. */
export function applyLarcenousTorment(context: ThiefResolverContext, application: ThiefResolverEvent): void {
  if (
    application.condition !== 'Torment' ||
    application.actorType !== 'player' ||
    !hasThiefTrait(context.config, TRAIT.LARCENOUS_TORMENT)
  )
    return;
  // One life-siphon event per stack so each stack shows as a separate hit in the log.
  const stacks = Math.max(0, Math.trunc(Number(application.stacks || 0)));
  const profile = thiefBalanceProfile(context, PROFILE.larcenousTorment);
  const strike = thiefBalanceProfileEffect(profile, 'strike');
  for (let stack = 1; stack <= stacks; stack += 1) {
    enqueueOrdered(context.queue, {
      type: 'damage',
      at: application.at,
      source: 'Trait',
      sourceId: TRAIT.LARCENOUS_TORMENT,
      actorType: 'effect',
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
