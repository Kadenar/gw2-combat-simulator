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
import { masterOfFragmentationCrescendo } from '#gw2/professions/mesmer/core/traits/illusions/index.js';
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
} from '#gw2/professions/mesmer/specializations/troubadour/mechanics/trait-boundaries.js';
import { TROUBADOUR_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/specializations/troubadour/profiles.js';
import {
  activeTroubadourInstrumentsAt,
  troubadourState
} from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import type { MesmerInstrument, MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Resolves an instrument's player or afterimage packets with their Troubadour trait interactions. */
export function instrumentAttack(
  context: MesmerRuntime,
  skill: MesmerSkill,
  data: MesmerInstrument,
  damageAt: number,
  source = 'Player',
  actorType: 'player' | 'summon' = 'player',
  delivery: EffectDelivery = {}
): void {
  // The extra note belongs to Shredding, so removing the native Lute strike does not remove it.
  for (const attack of actorType === 'summon' ? [data] : []) {
    if (attack.type !== 'strike') continue;
    buildMesmerStrikes(
      context,
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
      context.effects.emit({
        ...delivery,
        kind: 'packet',
        // The extra note is trait-owned; afterimage copies retain their summon actor and stay excluded from preview.
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    });
  }

  context.fireTrigger(troubadourInstrumentStrike, { skill, data, damageAt, source, actorType, delivery });

  for (const condition of actorType === 'summon' ? data.conditions || [] : []) {
    buildMesmerConditions(context, skill.name, damageAt, condition, source, '', {
      source,
      sourceId: skill.id,
      skillId: skill.id,
      actorType
    }).forEach((packet) => {
      context.effects.emit({
        ...delivery,
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    });
  }

  // The trait condition is independent of the instrument's strike and recharge behavior.
  context.fireTrigger(troubadourInstrumentConditions, { skill, data, damageAt, source, actorType, delivery });

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

  context.fireTrigger(troubadourInstrumentControl, { skill, data, damageAt, source, actorType, delivery });
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
  const spent = createMesmerActions(context).consumeResources(at, {
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
    context.effects.emit({
      ...delivery,
      kind: 'packet',
      event: packet,
      owner: mesmerPacketOwner(packet),
      priority: Number(packet.priority ?? 0)
    });
  }

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
  const instrument = mesmerInstruments(context)[skill.id];
  if (!instrument) return;

  const interrupted = castWasInterrupted(cast);
  const at = skill.interruptMode === 'per-packet' ? (interrupted ? cast.effectiveEnd : cast.fullEnd) : context.time;
  commitInstrument(context, cast, skill, instrument, at, mesmerCastDelivery(cast, skill));
}
