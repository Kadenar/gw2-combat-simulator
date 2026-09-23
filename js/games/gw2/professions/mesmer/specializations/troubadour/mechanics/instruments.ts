import { scheduleSyncopateDrumWave } from '#gw2/professions/mesmer/specializations/troubadour/traits/syncopate.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerConditionFromProfile, mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { withMesmerCastEmission } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import {
  requireEffectFromContext,
  effectNumberFromContext,
  balanceProfileNumberFromContext as profileValue
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { TROUBADOUR_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/specializations/troubadour/profiles.js';
import {
  activeTroubadourInstrumentsAt,
  troubadourState
} from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import type { MesmerCastContext, MesmerInstrument } from '#gw2/professions/mesmer/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { scheduleDeclarativeEffects } from '#gw2/platform/execution/effect-adapter.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';

/** Resolves an instrument's player or afterimage packets with their Troubadour trait interactions. */
function instrumentAttack(
  context: MesmerCastContext,
  skill: MesmerSkill,
  data: MesmerInstrument,
  damageAt: number,
  source = 'Player',
  actorType: 'player' | 'summon' = 'player'
): void {
  const runtime = mesmerRuntimeFor(context);
  const shredding =
    data.instrument === 'Lute' && runtime.traits.has(TRAIT.SHREDDING)
      ? requireEffectFromContext(runtime, 'balance-profile', TRAIT.SHREDDING, 'strike', 'Strike')
      : undefined;
  if (shredding && !shredding.ticks)
    effectNumberFromContext(runtime, 'balance-profile', TRAIT.SHREDDING, shredding, 'atMs');
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
  scheduleDeclarativeEffects(
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
    context.reservationId,
    damageAt,
    damageAt,
    actorType === 'summon' ? damageAt : Math.min(damageAt, context.effectiveEnd)
  );

  if (data.instrument === 'Drum') scheduleSyncopateDrumWave(context, skill, damageAt, source, actorType);

  if (runtime.traits.has(TRAIT.LIFE_OF_THE_PARTY) && data.instrument === 'Lute') {
    // Each named boon survives independently when its sibling is removed.
    for (const name of ['Lute Quickness', 'Lute Might']) {
      const effect = requireEffectFromContext(runtime, 'balance-profile', TRAIT.LIFE_OF_THE_PARTY, 'boon', name);
      if (!effect) continue;
      runtime.addEvent({
        type: 'buff',
        at: damageAt,
        kind: effect.boon,
        stacks: effect.stacks,
        duration: gw2SchedulerBoonDuration(context, skill, String(effect.boon), Number(effect.duration)),
        skillName: skill.name,
        sourceSkill: skill.name,
        audience: { recipients: 'party', maximumRecipients: 5 }
      });
    }
  }
}

/** Spends notes and commits the active-instrument state after its cast completes. */
function commitInstrument(context: MesmerCastContext, skill: MesmerSkill, data: MesmerInstrument, at: number): void {
  at = canonicalTime(at);
  const runtime = mesmerRuntimeFor(context);
  const spent = runtime.actions.consumeResources(at, {
    sourceSkill: skill.name,
    rotationIndex: context.commandIndex
  });
  const baseDuration = profileValue(runtime, PROFILE.instruments, 'durationMultiplier');
  const durationPerNote = profileValue(runtime, PROFILE.instruments, 'durationPerTier');
  // Playing windows are exact and replace only the matching instrument, without action-tick rounding.
  const expiresAt = canonicalTime(at + baseDuration + spent * durationPerNote);
  const state = troubadourState.from(context);
  state.instruments[data.instrument] = expiresAt;
  state.lastInstrument = data.instrument;
  runtime.addEvent({
    type: 'mesmer.instrument',
    at,
    instrument: data.instrument,
    expiresAt
  });

  if (
    runtime.traits.has(TRAIT.CALL_AND_RESPONSE) &&
    spent === profileValue(runtime, TRAIT.CALL_AND_RESPONSE, 'threshold')
  ) {
    const afterimageAt = at + profileValue(runtime, TRAIT.CALL_AND_RESPONSE, 'initialDelay');
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
    const ready = crescendo ? context.state.cooldowns.get(crescendo.id) : undefined;
    if (crescendo && ready) {
      context.cooldownController.reduceSkillRecharge(
        crescendo,
        profileValue(runtime, TRAIT.ALTERED_CHORD, 'rechargeReduction'),
        at
      );
    }
  }
}

/** Resolves Crescendo against the instruments active at its cast-start packet timestamp. */
function resolveCrescendo(context: MesmerCastContext, skill: MesmerSkill, at: number): void {
  const runtime = mesmerRuntimeFor(context);
  const state = troubadourState.from(context);
  const damageAt = canonicalTime(context.start + Number(skill.damageAtMs || 0) / 1000);
  const activeInstruments = activeTroubadourInstrumentsAt(context.eventsOfType('mesmer.instrument'), damageAt);
  const strike = requireEffectFromContext(runtime, 'balance-profile', PROFILE.crescendo, 'strike', 'Strike');
  // Fragmentation replaces Crescendo's per-instrument effectiveness with the trait's improved value.
  const effectiveness = runtime.traits.has(TRAIT.MASTER_OF_FRAGMENTATION)
    ? profileValue(runtime, TRAIT.MASTER_OF_FRAGMENTATION, 'damageIncreasePerStack')
    : profileValue(runtime, PROFILE.crescendo, 'damageIncreasePerStack');
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
      const effect = requireEffectFromContext(runtime, 'balance-profile', TRAIT.LIFE_OF_THE_PARTY, 'boon', name);
      if (!effect) continue;
      runtime.addEvent({
        type: 'buff',
        at: damageAt,
        kind: String(effect.boon),
        stacks: Number(effect.stacks),
        duration: gw2SchedulerBoonDuration(context, skill, String(effect.boon), Number(effect.duration)),
        skillName: skill.name,
        sourceSkill: skill.name,
        audience: { recipients: 'party' as const, maximumRecipients: 5 }
      });
    }
  }

  if (runtime.traits.has(TRAIT.ALTERED_CHORD)) {
    if (state.lastInstrument === 'Lute') {
      runtime.addEvent({
        type: 'buff',
        at: damageAt,
        // Altered Chord must not modify the Crescendo strike that triggered it.
        priority: 5,
        kind: 'altered-chord',
        stacks: 1,
        duration: profileValue(runtime, TRAIT.ALTERED_CHORD, 'durationMultiplier')
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
    const applications = profileValue(runtime, TRAIT.FORTISSIMO, 'maximumStacks');
    const interval = profileValue(runtime, TRAIT.FORTISSIMO, 'pulseInterval');
    const resourceGain = profileValue(runtime, TRAIT.FORTISSIMO, 'resourceGain');
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
export function scheduleTroubadourPerformance(context: MesmerCastContext, skill: MesmerSkill): void {
  if (context.action.cancelled) return;
  const runtime = mesmerRuntimeFor(context);
  const instrument = runtime.instruments[skill.id];
  if (!instrument && skill.id !== ID.CRESCENDO) return;
  withMesmerCastEmission(context, skill, () => {
    if (instrument) {
      instrumentAttack(context, skill, instrument, context.start + Number(instrument.damageAtMs || 0) / 1000);
      if (instrument.instrument === 'Harp') {
        const distortion = requireEffectFromContext(
          runtime,
          'balance-profile',
          PROFILE.instruments,
          'buff',
          'distortion'
        );
        if (distortion)
          runtime.addEvent({
            type: 'buff',
            at: context.start,
            kind: 'distortion',
            stacks: Number(distortion.stacks),
            duration: Number(distortion.duration),
            sourceSkill: skill.name
          });
      }
    } else {
      resolveCrescendo(context, skill, context.fullEnd);
    }
  });
}

/** Commits Troubadour instrument state while preserving Harp's interrupt commit point. */
export function completeTroubadourPerformance(context: MesmerCastContext, skill: MesmerSkill): void {
  // Cancelled performances retain their notes; committed Harp interruptions still activate the instrument.
  if (context.action.cancelled) return;

  const runtime = mesmerRuntimeFor(context);
  const instrument = runtime.instruments[skill.id];
  if (!instrument) return;

  const interrupted = castWasInterrupted(context);
  const at = interrupted && instrument?.instrument === 'Harp' ? context.effectiveEnd : context.fullEnd;
  withMesmerCastEmission(context, skill, () => commitInstrument(context, skill, instrument, at));
}
