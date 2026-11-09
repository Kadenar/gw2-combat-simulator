/** Owns spear etchings, recharge entitlements, and empowerment snapshots for casts and Fulgor sequences. */
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import { ACTOR, CONTROL, WEAPON } from '#gw2/platform/constants.js';
import type { CustomSideEffectAction } from '#gw2/platform/effects/actions.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { requireEffect, requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { ETCHING_CHAINS } from '#gw2/professions/elementalist/core/constants.js';
import { elementalistControlRequest, elementalistStrikeRequest } from '#gw2/professions/elementalist/core/events.js';
import { etchingChain, skillWeapon } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import type { ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSimulationEvent,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Core prepares packets after hitbox filtering; spear resolves the cast's accepted snapshot internally. */
export function prepareElementalistSpearEvent(
  context: ElementalistRuntime,
  event: SimulationEventBase
): SimulationEventBase {
  return empowerSpearPacket(
    context,
    event as ElementalistSimulationEvent,
    context.profession.core.spearFollowups[String(event.activationId)]
  );
}

/** Core calls this after shared commit observers; delayed Fulgor work already owns its snapshot. */
export function finishElementalistSpearCast(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>): void {
  delete context.profession.core.spearFollowups[cast.id];
}

/** Snapshots armed one-shot bonuses for the next eligible spear activation. */
export function beginElementalistSpearCast(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  const state = professionCoreState(context.profession);

  if (skillWeapon(skill) !== WEAPON.SPEAR || String(skill.slot || '') === 'Weapon_1') return;

  const followup = {
    damage: state.spearNextDamageBonus,
    critical: state.spearNextGuaranteedCritical,
    control: state.spearNextControlHit
  };

  if (!followup.damage && !followup.critical && !followup.control) return;

  state.spearFollowups[cast.id] = followup;
  state.spearNextDamageBonus = false;
  state.spearNextGuaranteedCritical = false;
  state.spearNextControlHit = false;
}

/** Casts and delayed sequences supply their own snapshot; the first positive strike consumes its control rider. */
function empowerSpearPacket(
  context: ElementalistRuntime,
  event: ElementalistSimulationEvent,
  followup: ElementalistCoreState['spearFollowups'][string] | undefined
): ElementalistSimulationEvent {
  if (!followup || event.type !== 'damage' || !(Number(event.coefficient) > 0)) return event;

  if (followup.control) {
    followup.control = false;
    context.effects.emit(elementalistControlRequest({ ...event, controlKind: CONTROL.DAZE }));
  }

  return {
    ...event,
    ...(followup.damage
      ? {
          // Keep the accepted entitlement on the packet after the cast's transient state is retired.
          metadata: {
            ...event.metadata,
            elementalistSeetheDamageFactor: skillNumber(
              requireSkill(context.helpers, ID.SEETHE),
              'nextSkillDamageMultiplier'
            )
          }
        }
      : {}),
    ...(followup.critical ? { forceCrit: true } : {})
  };
}

/** Root/release declarations own their state; the observer below only grants ordinary cast credit. */
export function openElementalistEtching(context: ElementalistRuntime, skill: Skill): void {
  const chain = etchingChain(skill.id)!;
  const expiresAt = context.time + Number(skill.comboFields?.[0]?.duration ?? 0);
  professionCoreState(context.profession).etchings[chain.etching] = { stage: 'lesser', otherCasts: 0, expiresAt };
  context.schedule('elementalist.etching-expire', expiresAt, null);
}

/** The selected release spends its etching; the cast-progress observer must not credit that release toward another one. */
export function consumeElementalistEtching(context: ElementalistRuntime, skill: Skill): void {
  professionCoreState(context.profession).etchings[etchingChain(skill.id)!.etching] = null;
}

/** Releases never credit another etching, and a root never credits itself. */
export function completeElementalistSpearProgression(context: ElementalistRuntime, skill: Skill): void {
  const state = professionCoreState(context.profession);
  const chain = etchingChain(skill.id);

  if (chain && Number(skill.id) !== chain.etchingId) return;

  for (const candidate of ETCHING_CHAINS) {
    const progress = state.etchings[candidate.etching];

    if (!progress || progress.stage !== 'lesser' || Number(skill.id) === candidate.etchingId) continue;

    // Full etchings stop earning credit; retain the crossing count rather than consuming or clamping it.
    const counter = advanceCounter(
      progress.otherCasts,
      1,
      skillNumber(requireSkill(context.helpers, candidate.etchingId), 'etchingCompletionThreshold'),
      'retain'
    );
    state.etchings[candidate.etching] = {
      ...progress,
      stage: counter.reached ? 'full' : 'lesser',
      otherCasts: counter.value
    };
  }
}

/** Mechanic-trigger handlers arm each one-shot spear bonus for a future cast. */
const elementalistSpearMechanicHandlers = Object.freeze({
  'elementalist.core.arm-spear-damage': (context: ElementalistRuntime): void => {
    professionCoreState(context.profession).spearNextDamageBonus = true;
  },
  'elementalist.core.arm-spear-recharge': (context: ElementalistRuntime): void => {
    professionCoreState(context.profession).spearNextRechargeReduction = true;
  },
  'elementalist.core.arm-spear-critical': (context: ElementalistRuntime): void => {
    professionCoreState(context.profession).spearNextGuaranteedCritical = true;
  },
  'elementalist.core.arm-spear-control': (context: ElementalistRuntime): void => {
    professionCoreState(context.profession).spearNextControlHit = true;
  }
});

/** Spear actions and scheduled work share their snapshots while Core retains shared cast sequencing. */
export const elementalistSpearLifecycle = {
  onCastCancel(context, cast) {
    // An activated, cancelled cast still earns etching credit; zero-length cancellations do not.
    if (cast.effectiveEnd > cast.start) completeElementalistSpearProgression(context, cast.skill);

    finishElementalistSpearCast(context, cast);
  },
  // The accepted non-auto spear cast consumes this grant once and retains its reserved recharge.
  reserveRecharge(context, skill, duration) {
    if (skill.type !== 'Weapon' || String(skill.slot || '') === 'Weapon_1' || skillWeapon(skill) !== WEAPON.SPEAR)
      return duration;

    const state = context.profession.core;

    if (!state.spearNextRechargeReduction) return duration;

    state.spearNextRechargeReduction = false;
    return duration * skillNumber(requireSkill(context.helpers, ID.RIPPLE), 'nextSkillRechargeMultiplier');
  },
  sideEffectHandlers: {
    'elementalist.replace-fulgor'(context, trigger, action) {
      if (trigger.kind !== 'cast') throw new TypeError('Fulgor requires a cast trigger.');

      replaceFulgor(context, trigger.cast, action);
    },
    'elementalist.open-etching'(context, trigger) {
      if (trigger.kind !== 'cast') throw new TypeError('Etchings require a cast trigger.');

      openElementalistEtching(context, trigger.skill);
    },
    'elementalist.consume-etching'(context, trigger) {
      if (trigger.kind !== 'cast') throw new TypeError('Etchings require a cast trigger.');

      consumeElementalistEtching(context, trigger.skill);
    }
  },
  tasks: {
    ...elementalistSpearMechanicHandlers,
    'elementalist.fulgor-pulse': fulgorPulse,
    'elementalist.etching-expire'(runtime) {
      const state = runtime.profession.core;
      for (const [name, progress] of Object.entries(state.etchings))
        if (progress && progress.expiresAt <= runtime.time) state.etchings[name] = null;
    }
  }
} satisfies RuntimeHooks<ElementalistRuntimeState, ElementalistSkill>;

const FULGOR_OWNER = { id: 'elementalist.fulgor', generation: 0 };

/** Pending work owns the snapshot, so cast completion cannot retire a live Fulgor sequence. */
interface FulgorSequence {
  packets: ElementalistSimulationEvent[];
  empowerment: ElementalistCoreState['spearFollowups'][string] | undefined;
}

function scheduleNextPulse(context: ElementalistRuntime, sequence: FulgorSequence): void {
  if (sequence.packets.length)
    context.schedule('elementalist.fulgor-pulse', sequence.packets[0].at, sequence, FULGOR_OWNER);
}

/** A committed recast replaces only the procedural stream; ordinary strikes keep their existing lifetime. */
function replaceFulgor(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  action: CustomSideEffectAction
): void {
  const pulse = requireEffect(cast.skill, 'strike', 'Fulgor', action);

  if (!pulse?.ticks?.length) throw new TypeError('Fulgor requires an explicit strike timeline.');

  context.cancelOwner(FULGOR_OWNER);
  const packets: ElementalistSimulationEvent[] = pulse.ticks.map((tick) => ({
    type: 'damage',
    at: canonicalTime(Math.max(context.time, cast.start + tick.atMs / 1000)),
    source: cast.skill.name,
    sourceId: cast.skill.id,
    actorType: ACTOR.EFFECT,
    ownerActorType: ACTOR.PLAYER,
    skillName: cast.skill.name,
    skillId: cast.skill.id,
    coefficient: tick.coefficient,
    flatStrikeBase: Number(tick.flatStrikeBase),
    flatStrikePowerCoeff: Number(tick.flatStrikePowerCoeff),
    canCrit: false,
    activationId: cast.id,
    offTarget: cast.command.offTarget
  }));
  scheduleNextPulse(context, {
    packets,
    empowerment: context.profession.core.spearFollowups[cast.id]
  });
}

/** Carry the consumed control flag forward with the remaining pulses, releasing the snapshot after the last one. */
function fulgorPulse(context: ElementalistRuntime, data: unknown): void {
  const {
    packets: [packet, ...remaining],
    empowerment
  } = data as FulgorSequence;
  const empowered = empowerSpearPacket(context, packet, empowerment);
  context.effects.emit(
    elementalistStrikeRequest(context, { ...empowered, coefficient: Number(empowered.coefficient) })
  );
  scheduleNextPulse(context, { packets: remaining, empowerment });
}
