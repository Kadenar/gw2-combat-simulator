import { buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { scheduledReaction } from '#gw2/platform/profession-definition/mechanics.js';
import { gainShadowForce } from '#gw2/professions/thief/specializations/specter/mechanics/shadow-shroud.js';
import { emitThiefStateSnapshot } from '#gw2/professions/thief/family-state.js';
import {
  balanceProfileNumberFromContext,
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2AlliedPlayerAssumptions, gw2AlliedPlayerProcTimeline } from '#gw2/platform/combat/state/allied-players.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { specterState } from '#gw2/professions/thief/specializations/specter/state.js';
import type { ThiefScheduledTask, ThiefSchedulerContext } from '#gw2/professions/thief/types.js';
import type {
  ThiefCastContext,
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefSimulationEvent,
  ThiefSkill
} from '#gw2/professions/thief/types.js';

import { SPECTER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/specter/profiles.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';

const ROT_WALLOW_VENOM_ICON = 'https://render.guildwars2.com/file/0F0B6509C8D5023D949153929E02FD2195AF63FE/2503654.png';

interface LarcenousTormentTaskPayload {
  readonly stacks: number;
}

interface DarkSentryTaskPayload {
  readonly maximumRecipients?: number;
  readonly allyIndices?: readonly number[];
}

/** Adds Shade Step's ally boon and arms Dark Sentry for barrier skills. */
export function completeShadowShroudSkill(context: ThiefCastContext, skill: ThiefSkill): void {
  // Shadow shroud skills suppressed mid-cast should not grant their trait effects.
  if (castWasInterrupted(context)) return;
  if (hasTrait(context.config, TRAIT.SHADESTEP)) {
    // Skill identity binds each boon even after an earlier packet is removed.
    const boonName =
      skill.id === ID.GRASPING_SHADOWS
        ? 'alacrity'
        : skill.id === ID.DAWNS_REPOSE
          ? 'protection'
          : skill.id === ID.MIND_SHOCK
            ? 'aegis'
            : null;
    if (boonName) {
      const shadeStepProfile = requireBalanceProfileFromContext(context, PROFILE.shadeStep);
      const effect = requireEffect(shadeStepProfile, 'boon', boonName, context);
      if (effect) {
        const boon = String(effect.boon);
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
            effectNumber(shadeStepProfile, effect, 'duration', context)
          ),
          stacks: effectNumber(shadeStepProfile, effect, 'stacks', context),
          audience: { recipients: 'party' as const }
        });
      }
    }
  }
  // Dawn's Repose grants barrier to the tethered ally and nearby allies, not the caster.
  // Dark Sentry is a mandatory Specter minor trait.
  if (skill.id === ID.DAWNS_REPOSE) {
    const dawnsReposeBarrierProfile = requireBalanceProfileFromContext(context, PROFILE.dawnsReposeBarrier);
    const barrier = requireEffect(dawnsReposeBarrierProfile, 'buff', 'barrier', context);
    const alliedRecipients = Math.min(
      balanceProfileNumber(dawnsReposeBarrierProfile, 'maximumTargets', context),
      gw2AlliedPlayerAssumptions(context.config).count
    );
    // Barrier removal also suppresses the barrier-triggered Dark Sentry reaction.
    if (!barrier || !alliedRecipients) return;
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
      duration: effectNumber(dawnsReposeBarrierProfile, barrier, 'duration', context),
      stacks: effectNumber(dawnsReposeBarrierProfile, barrier, 'stacks', context),
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
export const larcenousTormentReaction = scheduledReaction<
  ThiefSchedulerContext,
  ThiefSimulationEvent,
  LarcenousTormentTaskPayload
>({
  id: 'thief.larcenous-torment',
  order: 20,
  select(context, event) {
    if (
      event.type !== 'condition' ||
      event.condition !== 'Torment' ||
      event.actorType !== 'player' ||
      !hasTrait(context.config, TRAIT.LARCENOUS_TORMENT)
    )
      return null;
    // eventOrder makes the id unique per Torment application so concurrent bursts don't collide.
    return {
      id: `thief.larcenous-torment:${event.eventOrder}`,
      at: Math.max(context.state.time, event.at),
      payload: { stacks: Number(event.stacks || 0) }
    };
  },
  execute(context, taskAt, payload) {
    // Eligibility is checked when Torment lands, since shroud may change after the cast.
    if (specterState.from(context).shadowShroudActive) return;
    const stacks = Math.max(0, Number(payload.stacks || 0));
    if (!(stacks > 0)) return;

    gainShadowForce(
      context,
      stacks * balanceProfileNumberFromContext(context, PROFILE.larcenousTorment, 'resourceGain')
    );
    emitThiefStateSnapshot(context, taskAt, 'larcenous-torment');
  }
});

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

  const darkSentryProfile = requireBalanceProfileFromContext(context, PROFILE.darkSentry);
  const venom = requireEffect(darkSentryProfile, 'buff', 'rot-wallow-venom', context);
  if (!venom) return;
  const torment = requireEffect(darkSentryProfile, 'condition', 'Torment', context);
  // Reuse immutable tuning across every recipient and queued proc in this grant.
  const readyAt = task.at + balanceProfileNumber(darkSentryProfile, 'internalCooldown', context);
  const venomDuration = effectNumber(darkSentryProfile, venom, 'duration', context);
  for (const allyIndex of eligibleAllies) {
    state.darkSentryReadyAtByAlly[String(allyIndex)] = readyAt;
  }

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
    duration: venomDuration,
    stacks: effectNumber(darkSentryProfile, venom, 'stacks', context),
    audience: { recipients: 'party' as const, affectsSelf: false, maximumRecipients: recipientCount }
  });
  // The next allied strike must fit the grant, including the shared allied expiry boundary.
  if (torment) {
    const tormentStacks = effectNumber(darkSentryProfile, torment, 'stacks', context);
    const tormentDuration = effectNumber(darkSentryProfile, torment, 'duration', context);
    for (const proc of gw2AlliedPlayerProcTimeline(context.config, {
      start: task.at,
      duration: venomDuration,
      maximumPerAlly: 1
    })) {
      if (eligibleAllies.includes(proc.allyIndex)) {
        const allyIndex = proc.allyIndex;
        emitSkillCondition(context, {
          at: proc.at,
          source: 'Trait',
          skillId: TRAIT.DARK_SENTRY,
          skillName: 'Rot Wallow Venom',
          name: `Rot Wallow Venom - Ally ${allyIndex} Torment`,
          icon: ROT_WALLOW_VENOM_ICON,
          condition: String(torment.condition),
          stacks: tormentStacks,
          duration: tormentDuration,
          metadata: { triggeredByAlly: allyIndex }
        });
      }
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

  const larcenousTormentProfile = requireBalanceProfileFromContext(context, PROFILE.larcenousTorment);
  const strike = requireEffect(larcenousTormentProfile, 'strike', 'Larcenous Torment', context);
  // Force gain is independent of the removable life-siphon packet.
  if (strike) {
    const flatStrikeBase = effectNumber(larcenousTormentProfile, strike, 'flatStrikeBase', context);
    const flatStrikePowerCoeff = effectNumber(larcenousTormentProfile, strike, 'flatStrikePowerCoeff', context);
    for (let stack = 1; stack <= stacks; stack += 1) {
      context.queue.enqueue(
        buildResolverStrike({
          at: application.at,
          source: 'Trait',
          sourceId: TRAIT.LARCENOUS_TORMENT,
          actorType: 'effect',
          ownerActorType: 'player',
          skillId: TRAIT.LARCENOUS_TORMENT,
          skillName: 'Larcenous Torment',
          name: 'Larcenous Torment - Life Siphon',
          // Life steal scales directly with Power, bypassing armor and weapon-strike modifiers.
          flatStrikeBase,
          flatStrikePowerCoeff,

          canCrit: false,
          noCrit: true,
          lifeSiphon: true,
          triggeredBy: application.skillName,
          stackIndex: stack
        })
      );
    }
  }
  const state = specterState.from(context);
  // Shroud suppresses the force gain, but the life siphons above still resolve.
  if (state.shadowShroudActive) return;
  state.shadowClock.value = Math.min(
    state.shadowClock.maximum,
    state.shadowClock.value + stacks * balanceProfileNumber(larcenousTormentProfile, 'resourceGain', context)
  );
}
