/** Own instrument commitments, playing windows, preview state, and scheduled performance work. */
import { ENDURANCE, enduranceRegenerationRate } from '#gw2/platform/combat/resources/endurance-rules.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { ACTOR } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import {
  balanceNumber,
  balanceProfileNumber,
  requireBalanceProfile,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { mesmerCastDelivery } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import {
  buildMesmerConditions,
  buildMesmerPacket,
  buildMesmerStrikes
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { mesmerProfessionActionCommitted } from '#gw2/professions/mesmer/core/mechanics/profession-actions.js';
import type { MesmerShatterTraitHit } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { cloneShatterMaterialized } from '#gw2/professions/mesmer/core/mechanics/shatters.js';
import {
  masterOfFragmentationCrescendo,
  triggerMaimTheDisillusioned
} from '#gw2/professions/mesmer/core/traits/illusions/index.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { consumeMesmerResources } from '#gw2/professions/mesmer/shatter-lifecycle.js';
import { mesmerSelectedInstrument } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-projection.js';
import {
  assumedTroubadourInstruments,
  playingTroubadourInstruments,
  replaceTroubadourInstrumentWindow,
  troubadourFluteTransitions
} from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-windows.js';
import {
  troubadourCrescendoResolved,
  troubadourInstrumentAnnounced,
  troubadourInstrumentCommitted,
  troubadourInstrumentConditions,
  troubadourInstrumentControl,
  troubadourInstrumentStrike
} from '#gw2/professions/mesmer/specializations/troubadour/mechanics/trigger-points.js';
import { MESMER_TROUBADOUR_INSTRUMENTS } from '#gw2/professions/mesmer/specializations/troubadour/skills/index.js';
import { troubadourState } from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import type { MesmerInstrument, MesmerRuntime, MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Resolve selected instrument tuning for the performance handlers that consume it. */
function mesmerInstruments(context: MesmerRuntime) {
  return Object.fromEntries(
    Object.entries(MESMER_TROUBADOUR_INSTRUMENTS).map(([skillId]) => [
      Number(skillId),
      mesmerSelectedInstrument(context.helpers, Number(skillId))
    ])
  );
}

/** Lists one hit per native packet; Harp's damageless pulse still hits foes once at its impact. */
function instrumentHits(data: MesmerInstrument, damageAt: number): MesmerShatterTraitHit[] {
  if (data.ticks?.length)
    return data.ticks.map((tick) => ({ at: canonicalTime(damageAt + tick.atMs / 1000), count: 1 }));

  return [{ at: damageAt, count: Math.max(1, Math.trunc(Number(data.hits) || 0)) }];
}

/** Resolves the player's instrument trait riders at the performance's native impact. */
function instrumentTraitReactions(
  context: MesmerRuntime,
  skill: MesmerSkill,
  data: MesmerInstrument,
  damageAt: number,
  delivery: EffectDelivery
): void {
  context.fireTrigger(troubadourInstrumentStrike, { skill, data, damageAt, delivery });

  // Maim follows each of the player's own performance hits.
  triggerMaimTheDisillusioned(context, {
    skill,
    at: damageAt,
    delivery,
    traitHits: instrumentHits(data, damageAt),
    shatterTraitEligible: false,
    persistsAfterInterrupt: data.persistsAfterInterrupt
  });

  // The trait condition is independent of the instrument's strike and recharge behavior.
  context.fireTrigger(troubadourInstrumentConditions, { skill, data, damageAt, delivery });

  // Flute is Troubadour's shatter skill 2, so Core's slot-two shatter reward (Blinding Dissipation) follows its
  // materialized confusion exactly as it follows Cry of Frustration's.
  if (data.slot === 2)
    context.fireTrigger(cloneShatterMaterialized, { skillName: skill.name, at: damageAt, count: 1, delivery });

  context.fireTrigger(troubadourInstrumentControl, { skill, data, damageAt, delivery });
}

/**
 * Replays an instrument's native packets as a Call and Response afterimage. Afterimages are illusions, so illusion
 * rules govern their packets and the player's instrument traits never ride on the replay.
 */
export function afterimageInstrumentAttack(
  context: MesmerRuntime,
  skill: MesmerSkill,
  data: MesmerInstrument,
  damageAt: number,
  delivery: EffectDelivery
): void {
  const ownership = {
    source: 'Afterimage',
    sourceId: skill.id,
    skillId: skill.id,
    actorType: ACTOR.SUMMON,
    summonKind: 'afterimage'
  } as const;

  if (data.type === 'strike')
    buildMesmerStrikes(
      context,
      skill,
      damageAt,
      {
        ...data,
        name: undefined,
        summonKind: ownership.summonKind,
        source: ownership.source,
        actorType: ownership.actorType,
        persistsAfterInterrupt: data.persistsAfterInterrupt,
        weaponStrengthProfileId: 'nonweapon.profession-mechanic'
      },
      ownership
    ).forEach((packet) => {
      context.effects.emit({
        ...delivery,
        kind: 'packet',
        // Afterimage copies retain their summon actor and stay excluded from preview.
        event: packet
      });
    });

  for (const condition of data.conditions || [])
    buildMesmerConditions(context, skill.name, damageAt, condition, ownership.source, '', ownership).forEach(
      (packet) => {
        context.effects.emit({
          ...delivery,
          kind: 'packet',
          event: packet
        });
      }
    );

  // The afterimage impact reuses the performance's authored control under its own illusion ownership.
  context.effects.emit({
    ...delivery,
    kind: 'profile',
    profile: skill,
    effects: (skill.effects || [])
      .filter((effect) => effect.type === 'control')
      .map((effect) => ({
        ...effect,
        source: ownership.source,
        actorType: ownership.actorType,
        summonKind: ownership.summonKind
      })),
    at: damageAt,
    fullEnd: damageAt,
    attribution: {
      source: ownership.source,
      sourceId: skill.id,
      actorType: ownership.actorType,
      skillId: skill.id,
      skillName: skill.name
    }
  });
}

/** Publish a background playing window without spending notes or performing the instrument's attack. */
export function startTroubadourInstrument(
  context: MesmerRuntime,
  instrument: string,
  at: number,
  expiresAt: number,
  delivery: EffectDelivery = {}
): void {
  const packet = buildMesmerPacket(
    replaceTroubadourInstrumentWindow(troubadourState.from(context.profession).instruments, instrument, at, expiresAt)
  );
  context.effects.emit({
    ...delivery,
    kind: 'packet',
    event: packet
  });
}

/** Spend notes once when playing begins so duration and on-use rewards share the same instrument state. */
function commitInstrument(
  context: MesmerRuntime,
  cast: RuntimeCast<MesmerSkill>,
  skill: MesmerSkill,
  data: MesmerInstrument,
  at: number,
  delivery: EffectDelivery = {}
): void {
  at = canonicalTime(at);
  const spent = consumeMesmerResources(context, at, {
    activationId: cast.id
  });
  const instrumentsProfile = requireBalanceProfile(context.helpers, TRAIT.WANDERING_MINSTREL);
  const baseDuration = balanceProfileNumber(instrumentsProfile, 'baseDuration');
  const durationPerNote = balanceProfileNumber(instrumentsProfile, 'durationPerTier');
  // Playing windows are exact and replace only the matching instrument, without action-tick rounding.
  const expiresAt = canonicalTime(at + baseDuration + spent * durationPerNote);
  const state = troubadourState.from(context.profession);
  state.lastInstrument = data.instrument;
  startTroubadourInstrument(context, data.instrument, at, expiresAt, delivery);

  // Core on-use rewards share the committed note count before specialization rewards or afterimages.
  context.fireTrigger(mesmerProfessionActionCommitted, { slot: data.slot, skill, at, spent, delivery });
  context.fireTrigger(troubadourInstrumentCommitted, { skill, data, at, spent, delivery });

  {
    const packet = buildMesmerPacket({
      type: 'marker',
      at,
      name: skill.name,
      detail: `${data.instrument} playing for ${(baseDuration + spent * durationPerNote).toFixed(0)}s`
    });
    context.effects.emit({
      ...delivery,
      kind: 'packet',
      event: packet
    });
  }

  context.fireTrigger(troubadourInstrumentAnnounced, { spent, at });
}

/** Capture playing instruments at Crescendo's impact so delayed packets retain the same bonus. */
export function resolveCrescendo(
  context: MesmerRuntime,
  cast: RuntimeCast<MesmerSkill>,
  skill: MesmerSkill,
  at: number,
  delivery: EffectDelivery = {}
): void {
  const damageAt = canonicalTime(cast.start + (skill.damageAtMs ?? 0) / 1000);
  const activeInstruments = playingTroubadourInstruments(context.facts, damageAt);
  const strike = requireEffect(skill, 'strike', 'Strike', requireSkillAction(skill, 'crescendo'));
  // Fragmentation replaces Crescendo's per-instrument effectiveness with the trait's improved value.
  const effectiveness = masterOfFragmentationCrescendo(context, skill);

  if (strike)
    buildMesmerStrikes(
      context,
      skill,
      damageAt,
      {
        ...strike,
        name: undefined,
        summonKind: undefined,
        source: 'Player',
        weaponStrengthProfileId: 'nonweapon.profession-mechanic'
      },
      {
        // Preserve the same snapshot for scalar and timeline strikes; the skill owns the damage calculation.
        crescendoInstrumentCount: activeInstruments.size,
        crescendoEffectiveness: effectiveness
      }
    ).forEach((packet) => {
      context.effects.emit({
        ...delivery,
        kind: 'packet',
        event: packet
      });
    });

  // Crescendo's single hit applies one Maim proc, independent of active instruments.
  triggerMaimTheDisillusioned(context, {
    skill,
    at: damageAt,
    delivery,
    traitHits: [{ at: damageAt, count: 1 }],
    shatterTraitEligible: false
  });

  context.fireTrigger(troubadourCrescendoResolved, {
    skill,
    damageAt,
    at,
    delivery,
    lastInstrument: troubadourState.from(context.profession).lastInstrument
  });
}

/** Registers performance packets at cast start while leaving note spending and instrument state at completion. */
export function scheduleTroubadourPerformance(
  context: MesmerRuntime,
  cast: RuntimeCast<MesmerSkill>,
  skill: MesmerSkill
): void {
  if (cast.cancelledBeforeCommit) return;

  const instrument = mesmerInstruments(context)[skill.id];

  if (!instrument) return;

  instrumentTraitReactions(
    context,
    skill,
    instrument,
    cast.start + (instrument.damageAtMs || 0) / 1000,
    mesmerCastDelivery(cast, skill)
  );
}

/** Commit instrument state at its playing boundary while preserving Harp's interrupt commit point. */
export function completeTroubadourPerformance(
  context: MesmerRuntime,
  cast: RuntimeCast<MesmerSkill>,
  skill: MesmerSkill
): void {
  // Committed Harp interruptions activate the instrument at their shortened completion.
  const instrument = mesmerInstruments(context)[skill.id];

  if (!instrument) return;

  const interrupted = castWasInterrupted(cast);
  const at = skill.interruptMode === 'per-packet' ? (interrupted ? cast.effectiveEnd : cast.fullEnd) : context.time;
  commitInstrument(context, cast, skill, instrument, at, mesmerCastDelivery(cast, skill));
}

/** Flute recovery integrates its committed history independently of current trait selection. */
export const troubadourEndurance: EndurancePolicy<MesmerRuntime> = {
  state: (context) => troubadourState.from(context.profession).endurance,
  maximum: () => ENDURANCE.maximum,
  regenerationBoundaries: (context) => troubadourFluteTransitions(context.facts),
  regenerationRate: (context, vigor, at) => {
    const flutePlaying = playingTroubadourInstruments(context.facts, at).has('Flute');
    const fluteBonus = flutePlaying
      ? balanceNumber(context.helpers, TRAIT.SYMPHONIC_RESONANCE, 'enduranceRegenerationMultiplier') - 1
      : 0;
    return Math.min(ENDURANCE.maximumRegenerationPerSecond, enduranceRegenerationRate(vigor, fluteBonus));
  }
};

/** Keep window preparation, action admission, and scheduled commitments with the instrument owner. */
export const troubadourInstrumentLifecycle: RuntimeHooks<MesmerRuntimeState, MesmerSkill> = {
  prepareDamageState(runtime, _skill, inputs) {
    const windows = troubadourState.from(runtime.profession).instruments;
    for (const event of assumedTroubadourInstruments(
      Number(inputs.instruments ?? 0),
      runtime.time,
      Infinity,
      'assumption.instruments'
    )) {
      replaceTroubadourInstrumentWindow(windows, event.instrument, event.at, event.expiresAt);
      runtime.observations.record(event);
    }
  },
  endurance: troubadourEndurance,
  sideEffectHandlers: {
    // Harp grants protection at performance start, before its playing-state commitment.
    'mesmer.troubadour.harp-distortion'(runtime, context) {
      runtime.effects.emit({
        kind: 'profile',
        profile: context.skill,
        effects: requireSkillAction(context.skill, 'distortion').effects,
        at: runtime.time,
        fullEnd: runtime.time,
        attribution: {
          source: 'Player',
          sourceId: context.skill.id,
          skillId: context.skill.id,
          skillName: context.skill.name,
          activationId: context.kind === 'cast' ? context.cast.id : context.trigger.event.activationId,
          actorType: ACTOR.PLAYER
        }
      });
    },
    'mesmer.troubadour.performance-traits'(runtime, context) {
      if (context.kind === 'cast') scheduleTroubadourPerformance(runtime, context.cast, context.skill);
    },
    'mesmer.troubadour.commit-instrument'(runtime, context) {
      if (context.kind === 'cast') completeTroubadourPerformance(runtime, context.cast, context.skill);
    },
    'mesmer.troubadour.schedule-lute-playing'(runtime, context) {
      if (context.kind !== 'cast' || context.cast.cancelledBeforeCommit) return;

      // Lute starts playing at wave launch, before its first impact.
      runtime.scheduleForCast('mesmer.troubadour.lute-playing', context.cast.start + 0.36, context.cast);
    },
    'mesmer.troubadour.schedule-crescendo'(runtime, context) {
      if (context.kind !== 'cast' || context.cast.cancelledBeforeCommit) return;

      runtime.scheduleForCast(
        'mesmer.crescendo',
        context.cast.start + (context.skill.damageAtMs ?? 0) / 1000,
        context.cast
      );
    }
  },
  tasks: {
    'mesmer.troubadour.lute-playing'(runtime, data) {
      const { cast } = data as { cast: RuntimeCast<MesmerSkill> };
      completeTroubadourPerformance(runtime, cast, cast.skill);
    },
    'mesmer.crescendo'(runtime, data) {
      const { cast } = data as { cast: RuntimeCast<MesmerSkill> };
      resolveCrescendo(runtime, cast, cast.skill, cast.fullEnd, mesmerCastDelivery(cast, cast.skill));
    }
  },
  eventHandlers: {
    // Executed commitments support historical queries in detailed and score output.
    'mesmer.instrument': (runtime, event) => runtime.observations.record(event)
  }
};
