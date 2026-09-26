import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { scheduleSyncopateDrumWave } from '#gw2/professions/mesmer/specializations/troubadour/traits/syncopate.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerConditionFromProfile, mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { withMesmerCastEmission } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { TROUBADOUR_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/specializations/troubadour/profiles.js';
import {
  activeTroubadourInstrumentsAt,
  troubadourState
} from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import type { MesmerRuntime, MesmerInstrument } from '#gw2/professions/mesmer/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { emitMesmerEffects } from '#gw2/professions/mesmer/core/events.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';

/** Resolves an instrument's player or afterimage packets with their Troubadour trait interactions. */
function instrumentAttack(
  context: MesmerRuntime,
  skill: MesmerSkill,
  data: MesmerInstrument,
  damageAt: number,
  source = 'Player',
  actorType: 'player' | 'summon' = 'player'
): void {
  const runtime = mesmerMechanicsFor(context);
  const shredding =
    data.instrument === 'Lute' && runtime.traits.has(TRAIT.SHREDDING)
      ? requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.SHREDDING), 'strike', 'Strike')
      : undefined;
  if (shredding && !shredding.ticks)
    effectNumber(requireBalanceProfileFromContext(runtime, TRAIT.SHREDDING), shredding, 'atMs');
  // The extra note belongs to Shredding, so removing the native Lute strike does not remove it.
  for (const attack of [data, shredding]) {
    if (attack?.type !== 'strike') continue;
    runtime.addDamage(
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
    );
  }

  for (const condition of data.conditions || []) {
    runtime.addCondition(skill.name, damageAt, condition, source, '', {
      source,
      sourceId: skill.id,
      skillId: skill.id,
      actorType
    });
  }

  // The trait condition is independent of the instrument's strike and recharge behavior.
  if (data.instrument === 'Flute' && runtime.traits.has(TRAIT.MAYHEM)) {
    const condition = mesmerConditionFromProfile(context, TRAIT.MAYHEM, 'Torment');
    if (condition)
      runtime.addCondition(skill.name, damageAt, condition, source, 'Mayhem — Torment', {
        source,
        sourceId: TRAIT.MAYHEM,
        skillId: skill.id,
        actorType
      });
  }

  // Player and valid afterimage impacts use the same authored control with distinct ownership.
  emitMesmerEffects(
    context,
    {
      ...skill,
      effects: (skill.effects || [])
        .filter((effect) => effect.type === 'control')
        .map((effect) => ({
          ...effect,
          source,
          actorType
        }))
    },
    damageAt,
    damageAt
  );

  if (data.instrument === 'Drum') scheduleSyncopateDrumWave(context, skill, damageAt, source, actorType);

  if (runtime.traits.has(TRAIT.LIFE_OF_THE_PARTY) && data.instrument === 'Lute') {
    // Each named boon survives independently when its sibling is removed.
    for (const name of ['Lute Quickness', 'Lute Might']) {
      const lifeOfThePartyProfile = requireBalanceProfileFromContext(runtime, TRAIT.LIFE_OF_THE_PARTY);
      const effect = requireEffect(lifeOfThePartyProfile, 'boon', name);
      if (!effect) continue;
      runtime.addEvent({
        type: 'buff',
        at: damageAt,
        kind: effect.boon,
        stacks: effect.stacks,
        duration: Number(effect.duration),
        skillName: skill.name,
        sourceSkill: skill.name,
        audience: { recipients: 'party', maximumRecipients: 5 }
      });
    }
  }
}

/** Spends notes and commits the active-instrument state after its cast completes. */
function commitInstrument(
  context: MesmerRuntime,
  cast: RuntimeCast,
  skill: MesmerSkill,
  data: MesmerInstrument,
  at: number
): void {
  at = canonicalTime(at);
  const runtime = mesmerMechanicsFor(context);
  const spent = runtime.actions.consumeResources(at, {
    activationId: cast.id
  });
  const instrumentsProfile = requireBalanceProfileFromContext(runtime, PROFILE.instruments);
  const baseDuration = balanceProfileNumber(instrumentsProfile, 'durationMultiplier');
  const durationPerNote = balanceProfileNumber(instrumentsProfile, 'durationPerTier');
  // Playing windows are exact and replace only the matching instrument, without action-tick rounding.
  const expiresAt = canonicalTime(at + baseDuration + spent * durationPerNote);
  const state = troubadourState.from(context);
  state.instruments[data.instrument] = expiresAt;
  context.schedule('mesmer.instrument-expire', expiresAt, { instrument: data.instrument, expiresAt });
  state.lastInstrument = data.instrument;
  runtime.addEvent({
    type: 'mesmer.instrument',
    at,
    instrument: data.instrument,
    expiresAt
  });

  if (
    runtime.traits.has(TRAIT.CALL_AND_RESPONSE) &&
    spent === balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.CALL_AND_RESPONSE), 'threshold')
  ) {
    const callAndResponseProfile = requireBalanceProfileFromContext(runtime, TRAIT.CALL_AND_RESPONSE);
    const afterimageAt = at + balanceProfileNumber(callAndResponseProfile, 'initialDelay');
    instrumentAttack(context, skill, data, afterimageAt, 'Afterimage', 'summon');
    runtime.addTraitProc('Call and Response', afterimageAt, skill.name);
  }

  runtime.addEvent({
    type: 'marker',
    at,
    name: skill.name,
    detail: `${data.instrument} playing for ${(baseDuration + spent * durationPerNote).toFixed(0)}s`
  });

  if (runtime.traits.has(TRAIT.ALTERED_CHORD) && spent > 0) {
    const crescendo = runtime.skillsById.get(ID.CRESCENDO);
    const ready = crescendo ? context.cooldowns.get(crescendo.id) : undefined;
    if (crescendo && ready) {
      const alteredChordProfile = requireBalanceProfileFromContext(runtime, TRAIT.ALTERED_CHORD);
      context.cooldownController.reduceSkillRecharge(
        crescendo,
        balanceProfileNumber(alteredChordProfile, 'rechargeReduction'),
        at
      );
    }
  }
}

/** Resolves Crescendo against the instruments active at its cast-start packet timestamp. */
export function resolveCrescendo(context: MesmerRuntime, cast: RuntimeCast, skill: MesmerSkill, at: number): void {
  const runtime = mesmerMechanicsFor(context);
  const state = troubadourState.from(context);
  const damageAt = canonicalTime(cast.start + Number(skill.damageAtMs || 0) / 1000);
  const activeInstruments = activeTroubadourInstrumentsAt(
    context.history.filter((event) => event.type === 'mesmer.instrument'),
    damageAt
  );
  const crescendoProfile = requireBalanceProfileFromContext(runtime, PROFILE.crescendo);
  const strike = requireEffect(crescendoProfile, 'strike', 'Strike');
  // Fragmentation replaces Crescendo's per-instrument effectiveness with the trait's improved value.
  const effectiveness = runtime.traits.has(TRAIT.MASTER_OF_FRAGMENTATION)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, TRAIT.MASTER_OF_FRAGMENTATION),
        'damageIncreasePerStack'
      )
    : balanceProfileNumber(crescendoProfile, 'damageIncreasePerStack');
  if (strike)
    runtime.addDamage(skill, damageAt, {
      ...strike,
      name: undefined,
      summonKind: undefined,
      ...(strike.coefficient === undefined
        ? { multiplier: 1 + activeInstruments.size * effectiveness }
        : { coefficient: strike.coefficient * (1 + activeInstruments.size * effectiveness) }),
      source: 'Player',
      weaponStrengthProfileId: 'nonweapon.profession-mechanic'
    });

  if (runtime.traits.has(TRAIT.LIFE_OF_THE_PARTY)) {
    for (const name of ['Crescendo Quickness', 'Crescendo Might', 'Crescendo Fury']) {
      const lifeOfThePartyProfile = requireBalanceProfileFromContext(runtime, TRAIT.LIFE_OF_THE_PARTY);
      const effect = requireEffect(lifeOfThePartyProfile, 'boon', name);
      if (!effect) continue;
      runtime.addEvent({
        type: 'buff',
        at: damageAt,
        kind: String(effect.boon),
        stacks: Number(effect.stacks),
        duration: Number(effect.duration),
        skillName: skill.name,
        sourceSkill: skill.name,
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      });
    }
  }

  if (runtime.traits.has(TRAIT.ALTERED_CHORD)) {
    if (state.lastInstrument === 'Lute') {
      const alteredChordProfile = requireBalanceProfileFromContext(runtime, TRAIT.ALTERED_CHORD);
      runtime.addEvent({
        type: 'buff',
        at: damageAt,
        // Altered Chord must not modify the Crescendo strike that triggered it.
        priority: 5,
        kind: 'altered-chord',
        stacks: 1,
        duration: balanceProfileNumber(alteredChordProfile, 'durationMultiplier')
      });
      runtime.addTraitProc('Altered Chord', damageAt, skill.name, 'Lute');
    } else if (state.lastInstrument === 'Flute') {
      const condition = mesmerConditionFromProfile(context, TRAIT.ALTERED_CHORD, 'Confusion');
      if (condition) runtime.addCondition(skill.name, damageAt, condition, 'Player', 'Altered Chord — Confusion');
      if (condition) runtime.addTraitProc('Altered Chord', damageAt, skill.name, 'Flute');
    } else if (state.lastInstrument === 'Drum') {
      runtime.addEvent({
        type: 'control',
        at: damageAt,
        skillId: skill.id,
        skillName: skill.name,
        source: 'Player',
        sourceId: TRAIT.ALTERED_CHORD,
        actorType: 'player'
      });
      runtime.addTraitProc('Altered Chord', damageAt, skill.name, 'Drum');
    }
  }

  if (runtime.traits.has(TRAIT.FORTISSIMO)) {
    const fortissimoProfile = requireBalanceProfileFromContext(runtime, TRAIT.FORTISSIMO);
    const applications = balanceProfileNumber(fortissimoProfile, 'maximumStacks');
    const interval = balanceProfileNumber(fortissimoProfile, 'pulseInterval');
    const resourceGain = balanceProfileNumber(fortissimoProfile, 'resourceGain');
    for (let index = 1; index <= applications; index += 1) {
      runtime.resources.queueResources(
        at + index * interval,
        resourceGain,
        runtime.activePrimaryWeapon(),
        'Fortissimo',
        {
          traitId: TRAIT.FORTISSIMO,
          traitName: 'Fortissimo'
        }
      );
    }
  }
}

/** Registers performance packets at cast start while leaving note spending and instrument state at completion. */
export function scheduleTroubadourPerformance(context: MesmerRuntime, cast: RuntimeCast, skill: MesmerSkill): void {
  if (cast.cancelled) return;
  const runtime = mesmerMechanicsFor(context);
  const instrument = runtime.instruments[skill.id];
  if (!instrument && skill.id !== ID.CRESCENDO) return;
  withMesmerCastEmission(context, cast, skill, () => {
    if (instrument) {
      instrumentAttack(context, skill, instrument, cast.start + Number(instrument.damageAtMs || 0) / 1000);
      if (instrument.instrument === 'Harp') {
        const instrumentsProfile = requireBalanceProfileFromContext(runtime, PROFILE.instruments);
        const distortion = requireEffect(instrumentsProfile, 'buff', 'distortion');
        if (distortion)
          runtime.addEvent({
            type: 'buff',
            at: cast.start,
            kind: 'distortion',
            stacks: Number(distortion.stacks),
            duration: Number(distortion.duration),
            sourceSkill: skill.name
          });
      }
    } else {
      // Instrument state is read when the strike occurs, after intervening accepted performances.
      context.schedule('mesmer.crescendo', cast.start + Number(skill.damageAtMs || 0) / 1000, cast);
    }
  });
}

/** Commits Troubadour instrument state while preserving Harp's interrupt commit point. */
export function completeTroubadourPerformance(context: MesmerRuntime, cast: RuntimeCast, skill: MesmerSkill): void {
  // Cancelled performances retain their notes; committed Harp interruptions still activate the instrument.
  if (cast.cancelled) return;

  const runtime = mesmerMechanicsFor(context);
  const instrument = runtime.instruments[skill.id];
  if (!instrument) return;

  const interrupted = castWasInterrupted(cast);
  const at = interrupted && instrument?.instrument === 'Harp' ? cast.effectiveEnd : cast.fullEnd;
  withMesmerCastEmission(context, cast, skill, () => commitInstrument(context, cast, skill, instrument, at));
}
