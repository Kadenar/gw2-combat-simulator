import type { EffectDelivery } from '#gw2/platform/simulation/effect-emission.js';
import {
  buildMesmerStrikes,
  mesmerPacketOwner,
  buildMesmerConditions,
  buildMesmerPacket
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { mesmerCastDelivery } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { masterOfFragmentationCrescendo } from '#gw2/professions/mesmer/core/traits/behavior.js';
import { TROUBADOUR_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/specializations/troubadour/profiles.js';
import {
  activeTroubadourInstrumentsAt,
  troubadourState
} from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import {
  applyCallAndResponse,
  applyCrescendoTraits,
  applyLuteLifeOfTheParty,
  applyMayhemInstrument,
  reduceAlteredChordRecharge,
  shreddingStrike
} from '#gw2/professions/mesmer/specializations/troubadour/traits/performance.js';
import { scheduleSyncopateDrumWave } from '#gw2/professions/mesmer/specializations/troubadour/traits/syncopate.js';
import type { MesmerInstrument, MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

/** Resolves an instrument's player or afterimage packets with their Troubadour trait interactions. */
function instrumentAttack(
  context: MesmerRuntime,
  skill: MesmerSkill,
  data: MesmerInstrument,
  damageAt: number,
  source = 'Player',
  actorType: 'player' | 'summon' = 'player',
  delivery: EffectDelivery = {}
): void {
  const runtime = mesmerMechanicsFor(context);
  const shredding = shreddingStrike(context, data);
  // The extra note belongs to Shredding, so removing the native Lute strike does not remove it.
  for (const attack of actorType === 'summon' ? [data, shredding] : [shredding]) {
    if (attack?.type !== 'strike') continue;
    buildMesmerStrikes(
      runtime.context,
      skill,
      damageAt,
      {
        ...attack,
        name: undefined,
        summonKind: undefined,
        source,
        actorType,
        persistsAfterInterrupt: data.persistsAfterInterrupt,
        weaponStrengthProfileId: 'nonweapon.profession-mechanic'
      },
      { source, sourceId: skill.id, skillId: skill.id, actorType }
    ).forEach((packet) => {
      runtime.context.effects.emit({
        ...delivery,
        kind: 'packet',
        // The extra note is trait-owned; afterimage copies retain their summon actor and stay excluded from preview.
        event: attack === shredding ? { ...packet, name: 'Shredding', procType: 'trait' } : packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    });
  }

  for (const condition of actorType === 'summon' ? data.conditions || [] : []) {
    buildMesmerConditions(runtime.context, skill.name, damageAt, condition, source, '', {
      source,
      sourceId: skill.id,
      skillId: skill.id,
      actorType
    }).forEach((packet) => {
      runtime.context.effects.emit({
        ...delivery,
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    });
  }

  // The trait condition is independent of the instrument's strike and recharge behavior.
  applyMayhemInstrument(context, skill, data, damageAt, source, actorType, delivery);

  // Player and valid afterimage impacts use the same authored control with distinct ownership.
  if (actorType === 'summon')
    context.effects.emit({
      ...delivery,
      kind: 'profile',
      profile: skill,
      effects: (skill.effects || [])
        .filter((effect) => effect.type === 'control')
        .map((effect) => ({ ...effect, source, actorType })),
      at: damageAt,
      fullEnd: damageAt,
      attribution: { source, sourceId: skill.id, actorType, skillId: skill.id, skillName: skill.name }
    });

  scheduleSyncopateDrumWave(context, skill, data, damageAt, source, actorType, delivery);

  applyLuteLifeOfTheParty(context, skill, data, damageAt, delivery);
}

/** Spends notes and commits the active-instrument state after its cast completes. */
function commitInstrument(
  context: MesmerRuntime,
  cast: RuntimeCast<MesmerSkill>,
  skill: MesmerSkill,
  data: MesmerInstrument,
  at: number,
  delivery: EffectDelivery = {}
): void {
  at = canonicalTime(at);
  const runtime = mesmerMechanicsFor(context);
  const spent = runtime.actions.consumeResources(at, {
    activationId: cast.id
  });
  const instrumentsProfile = requireBalanceProfileFromContext(context, PROFILE.instruments);
  const baseDuration = balanceProfileNumber(instrumentsProfile, 'durationMultiplier');
  const durationPerNote = balanceProfileNumber(instrumentsProfile, 'durationPerTier');
  // Playing windows are exact and replace only the matching instrument, without action-tick rounding.
  const expiresAt = canonicalTime(at + baseDuration + spent * durationPerNote);
  const state = troubadourState.from(context);
  state.instruments[data.instrument] = expiresAt;
  state.lastInstrument = data.instrument;
  {
    const packet = buildMesmerPacket({
      type: 'mesmer.instrument',
      at,
      instrument: data.instrument,
      expiresAt
    });
    runtime.context.effects.emit({
      ...delivery,
      kind: 'packet',
      event: packet,
      owner: mesmerPacketOwner(packet),
      priority: Number(packet.priority ?? 0)
    });
  }

  applyCallAndResponse(context, skill, data, at, spent, instrumentAttack, delivery);

  {
    const packet = buildMesmerPacket({
      type: 'marker',
      at,
      name: skill.name,
      detail: `${data.instrument} playing for ${(baseDuration + spent * durationPerNote).toFixed(0)}s`
    });
    runtime.context.effects.emit({
      ...delivery,
      kind: 'packet',
      event: packet,
      owner: mesmerPacketOwner(packet),
      priority: Number(packet.priority ?? 0)
    });
  }

  reduceAlteredChordRecharge(context, spent, at);
}

/** Resolves Crescendo against the instruments active at its cast-start packet timestamp. */
export function resolveCrescendo(
  context: MesmerRuntime,
  cast: RuntimeCast<MesmerSkill>,
  skill: MesmerSkill,
  at: number,
  delivery: EffectDelivery = {}
): void {
  const runtime = mesmerMechanicsFor(context);
  const damageAt = canonicalTime(cast.start + Number(skill.damageAtMs || 0) / 1000);
  const activeInstruments = activeTroubadourInstrumentsAt(
    context.history.filter((event) => event.type === 'mesmer.instrument'),
    damageAt
  );
  const crescendoProfile = requireBalanceProfileFromContext(context, skill.crescendoProfileId!);
  const strike = requireEffect(crescendoProfile, 'strike', 'Strike');
  // Fragmentation replaces Crescendo's per-instrument effectiveness with the trait's improved value.
  const effectiveness = masterOfFragmentationCrescendo(context, crescendoProfile);
  if (strike)
    buildMesmerStrikes(runtime.context, skill, damageAt, {
      ...strike,
      name: undefined,
      summonKind: undefined,
      ...(strike.coefficient === undefined
        ? { multiplier: 1 + activeInstruments.size * effectiveness }
        : { coefficient: strike.coefficient * (1 + activeInstruments.size * effectiveness) }),
      source: 'Player',
      weaponStrengthProfileId: 'nonweapon.profession-mechanic'
    }).forEach((packet) => {
      runtime.context.effects.emit({
        ...delivery,
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    });

  applyCrescendoTraits(context, skill, damageAt, at, delivery);
}

/** Registers performance packets at cast start while leaving note spending and instrument state at completion. */
export function scheduleTroubadourPerformance(
  context: MesmerRuntime,
  cast: RuntimeCast<MesmerSkill>,
  skill: MesmerSkill
): void {
  if (cast.cancelled) return;
  const runtime = mesmerMechanicsFor(context);
  const instrument = runtime.instruments[skill.id];
  if (!instrument) return;
  instrumentAttack(
    context,
    skill,
    instrument,
    cast.start + (instrument.damageAtMs || 0) / 1000,
    undefined,
    undefined,
    mesmerCastDelivery(cast, skill)
  );
}

/** Commits Troubadour instrument state while preserving Harp's interrupt commit point. */
export function completeTroubadourPerformance(
  context: MesmerRuntime,
  cast: RuntimeCast<MesmerSkill>,
  skill: MesmerSkill
): void {
  // Committed Harp interruptions activate the instrument at their shortened completion.

  const runtime = mesmerMechanicsFor(context);
  const instrument = runtime.instruments[skill.id];
  if (!instrument) return;

  const interrupted = castWasInterrupted(cast);
  const at = skill.interruptMode === 'per-packet' ? (interrupted ? cast.effectiveEnd : cast.fullEnd) : context.time;
  commitInstrument(context, cast, skill, instrument, at, mesmerCastDelivery(cast, skill));
}
