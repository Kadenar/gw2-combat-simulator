import { ACTOR } from '#gw2/platform/constants.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { mesmerCastDelivery } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import {
  buildMesmerConditions,
  buildMesmerPacket,
  buildMesmerStrikes,
  mesmerPacketOwner
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import type { MesmerShatterTraitHit } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { cloneShatterMaterialized } from '#gw2/professions/mesmer/core/mechanics/shatters.js';
import {
  masterOfFragmentationCrescendo,
  triggerMaimTheDisillusioned
} from '#gw2/professions/mesmer/core/traits/illusions/index.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { createMesmerActions } from '#gw2/professions/mesmer/family-mechanics.js';
import { mesmerInstruments } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/runtime.js';
import {
  troubadourCrescendoResolved,
  troubadourInstrumentAnnounced,
  troubadourInstrumentCommitted,
  troubadourInstrumentConditions,
  troubadourInstrumentControl,
  troubadourInstrumentStrike
} from '#gw2/professions/mesmer/specializations/troubadour/mechanics/trigger-points.js';
import { TROUBADOUR_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/specializations/troubadour/profiles.js';
import {
  activeTroubadourInstrumentsAt,
  troubadourState
} from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import type { MesmerInstrument, MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { mesmerProfessionActionCommitted } from '#gw2/professions/mesmer/core/mechanics/profession-actions.js';

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
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    });

  for (const condition of data.conditions || [])
    buildMesmerConditions(context, skill.name, damageAt, condition, ownership.source, '', ownership).forEach(
      (packet) => {
        context.effects.emit({
          ...delivery,
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
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
  troubadourState.from(context).instruments[instrument] = expiresAt;
  const packet = buildMesmerPacket({ type: 'mesmer.instrument', at, instrument, expiresAt });
  context.effects.emit({
    ...delivery,
    kind: 'packet',
    event: packet,
    owner: mesmerPacketOwner(packet),
    priority: Number(packet.priority ?? 0)
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
  const spent = createMesmerActions(context).consumeResources(at, {
    activationId: cast.id
  });
  const instrumentsProfile = requireBalanceProfileFromContext(context, PROFILE.instruments);
  const baseDuration = balanceProfileNumber(instrumentsProfile, 'baseDuration');
  const durationPerNote = balanceProfileNumber(instrumentsProfile, 'durationPerTier');
  // Playing windows are exact and replace only the matching instrument, without action-tick rounding.
  const expiresAt = canonicalTime(at + baseDuration + spent * durationPerNote);
  const state = troubadourState.from(context);
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
      event: packet,
      owner: mesmerPacketOwner(packet),
      priority: Number(packet.priority ?? 0)
    });
  }

  context.fireTrigger(troubadourInstrumentAnnounced, { spent, at });
}

/** Resolves Crescendo against the instruments active at its cast-start packet timestamp. */
export function resolveCrescendo(
  context: MesmerRuntime,
  cast: RuntimeCast<MesmerSkill>,
  skill: MesmerSkill,
  at: number,
  delivery: EffectDelivery = {}
): void {
  const damageAt = canonicalTime(cast.start + Number(skill.damageAtMs || 0) / 1000);
  const activeInstruments = activeTroubadourInstrumentsAt(
    context.facts.read().filter((event) => event.type === 'mesmer.instrument'),
    damageAt
  );
  const crescendoProfile = requireBalanceProfileFromContext(context, skill.crescendoProfileId!);
  const strike = requireEffect(crescendoProfile, 'strike', 'Strike');
  // Fragmentation replaces Crescendo's per-instrument effectiveness with the trait's improved value.
  const effectiveness = masterOfFragmentationCrescendo(context, crescendoProfile);

  if (strike)
    buildMesmerStrikes(context, skill, damageAt, {
      ...strike,
      name: undefined,
      summonKind: undefined,
      ...(strike.coefficient === undefined
        ? { multiplier: 1 + activeInstruments.size * effectiveness }
        : { coefficient: strike.coefficient * (1 + activeInstruments.size * effectiveness) }),
      source: 'Player',
      weaponStrengthProfileId: 'nonweapon.profession-mechanic'
    }).forEach((packet) => {
      context.effects.emit({
        ...delivery,
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
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
    lastInstrument: troubadourState.from(context).lastInstrument
  });
}

/** Registers performance packets at cast start while leaving note spending and instrument state at completion. */
export function scheduleTroubadourPerformance(
  context: MesmerRuntime,
  cast: RuntimeCast<MesmerSkill>,
  skill: MesmerSkill
): void {
  if (cast.cancelled) return;

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
