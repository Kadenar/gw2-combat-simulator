import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import {
  balanceProfileEffectFromContext as profileEffect,
  balanceProfileValueFromContext as profileValue
} from '#gw2/platform/combat/state/balance-profiles.js';
import { TROUBADOUR_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/specializations/troubadour/profiles.js';
import { troubadourState } from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import type { MesmerCastContext, MesmerRuntime, MesmerInstrument } from '#gw2/professions/mesmer/types.js';

import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

const conditionFromProfile = (
  runtime: MesmerRuntime,
  id: number | string,
  fallback: { name: string; duration: number; stacks: number }
) => {
  const effect = profileEffect(runtime, id, 'condition');
  return {
    name: String(effect?.condition || fallback.name),
    duration: Number(effect?.duration ?? fallback.duration),
    stacks: Number(effect?.stacks ?? fallback.stacks)
  };
};

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
  if (data.coefficient || data.ticks?.length) {
    const shredding = profileEffect(runtime, TRAIT.SHREDDING, 'strike');
    const shreddingCoefficient = Number(shredding?.coefficient || 1);
    const shreddingActive = data.instrument === 'Lute' && runtime.traits.has(TRAIT.SHREDDING);
    if (shreddingActive && shredding?.atMs == null) {
      throw new TypeError('Shredding requires an explicit Lute packet timestamp.');
    }

    // Shredding appends its authored fourth note instead of extending an aggregate interval at runtime.
    const ticks = data.ticks?.length
      ? [
          ...data.ticks,
          ...(shreddingActive ? [{ atMs: Number(shredding?.atMs), coefficient: shreddingCoefficient }] : [])
        ]
      : undefined;
    runtime.addDamage(
      skill,
      damageAt,
      {
        ...(ticks
          ? { ticks, timingAnchor: 'castStart' as const, timingScale: 'fixed' as const }
          : { coefficient: Number(data.coefficient), hits: Number(data.hits) }),
        source,
        actorType,
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

  if (data.instrument === 'Flute' && runtime.traits.has(TRAIT.MAYHEM)) {
    runtime.addCondition(
      skill.name,
      damageAt,
      conditionFromProfile(runtime, TRAIT.MAYHEM, {
        name: 'Torment',
        duration: 5,
        stacks: 4
      }),
      source,
      'Mayhem — Torment',
      { source, sourceId: TRAIT.MAYHEM, skillId: skill.id, actorType }
    );
  }

  if (data.instrument === 'Flute' || data.instrument === 'Drum') {
    runtime.addEvent({
      type: 'control',
      at: damageAt,
      skillId: skill.id,
      skillName: skill.name,
      source,
      sourceId: skill.id,
      actorType
    });
  }

  if (data.instrument === 'Drum' && runtime.traits.has(TRAIT.SYNCOPATE)) {
    const delayedAt = damageAt + profileValue(runtime, TRAIT.SYNCOPATE, 'initialDelay', 3);
    const delayedWave = runtime.traitDamage.SyncopateDelayedWave;
    runtime.addDamage(
      {
        id: 'Syncopate delayed wave',
        name: 'Syncopate',
        weapon: 'Utility',
        blade: false
      },
      delayedAt,
      {
        coefficient: delayedWave.coefficient,
        hits: delayedWave.hits,
        source: 'Trait',
        actorType,
        weaponStrengthProfileId: 'nonweapon.unequipped'
      },
      {
        source: 'Trait',
        sourceId: TRAIT.SYNCOPATE,
        skillId: skill.id,
        actorType,
        name: 'Syncopate — delayed wave'
      }
    );
    runtime.addEvent({
      type: 'control',
      at: delayedAt,
      skillId: skill.id,
      skillName: 'Syncopate — delayed wave',
      controlKind: 'daze',
      source,
      sourceId: TRAIT.SYNCOPATE,
      actorType
    });
    runtime.addTraitProc('Syncopate', delayedAt, skill.name, 'delayed drum wave');
  }

  if (runtime.traits.has(TRAIT.LIFE_OF_THE_PARTY) && data.instrument === 'Lute') {
    const quickness = profileEffect(runtime, TRAIT.LIFE_OF_THE_PARTY, 'boon', 0);
    const might = profileEffect(runtime, TRAIT.LIFE_OF_THE_PARTY, 'boon', 1);
    runtime.addEvent({
      type: 'buff',
      at: damageAt,
      kind: String(quickness?.boon || 'quickness'),
      stacks: Number(quickness?.stacks || 1),
      duration: gw2SchedulerBoonDuration(
        context,
        skill,
        String(quickness?.boon || 'quickness'),
        Number(quickness?.duration || 6)
      ),
      skillName: skill.name,
      sourceSkill: skill.name,
      audience: { recipients: 'party' as const, maximumRecipients: 5 }
    });
    runtime.addEvent({
      type: 'buff',
      at: damageAt,
      kind: String(might?.boon || 'might'),
      stacks: Number(might?.stacks || 5),
      duration: gw2SchedulerBoonDuration(context, skill, String(might?.boon || 'might'), Number(might?.duration || 8)),
      skillName: skill.name,
      sourceSkill: skill.name,
      audience: { recipients: 'party' as const, maximumRecipients: 5 }
    });
  }
}

/** Spends notes, performs the instrument attack, and opens its active-instrument window. */
function resolveInstrument(context: MesmerCastContext, skill: MesmerSkill, data: MesmerInstrument, at: number): void {
  const runtime = mesmerRuntimeFor(context);
  const spent = runtime.actions.consumeResources(at, {
    sourceSkill: skill.name,
    rotationIndex: context.commandIndex
  });
  const damageAt = context.start + Number(data.damageAtMs || 0) / 1000;
  instrumentAttack(context, skill, data, damageAt);
  const baseDuration = profileValue(runtime, PROFILE.instruments, 'durationMultiplier', 5);
  const durationPerNote = profileValue(runtime, PROFILE.instruments, 'durationPerTier', 5);
  const expiresAt = at + baseDuration + spent * durationPerNote;
  const state = troubadourState.from(context);
  state.instruments[data.instrument] = expiresAt;
  state.lastInstrument = data.instrument;
  runtime.addEvent({
    type: 'mesmer.instrument',
    at: at + context.epsilon,
    instrument: data.instrument,
    expiresAt
  });

  if (data.instrument === 'Harp') {
    const distortion = profileEffect(runtime, PROFILE.instruments, 'buff');
    runtime.addEvent({
      type: 'buff',
      at: context.start,
      kind: 'distortion',
      stacks: Number(distortion?.stacks || 1),
      duration: Number(distortion?.duration || 2),
      sourceSkill: skill.name
    });
  }

  if (
    runtime.traits.has(TRAIT.CALL_AND_RESPONSE) &&
    spent === profileValue(runtime, TRAIT.CALL_AND_RESPONSE, 'threshold', 3)
  ) {
    const afterimageAt = at + profileValue(runtime, TRAIT.CALL_AND_RESPONSE, 'initialDelay', 1.5);
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
      context.state.cooldowns.set(
        crescendo.id,
        Math.max(at, ready - profileValue(runtime, TRAIT.ALTERED_CHORD, 'rechargeReduction', 2))
      );
    }
  }
}

/** Resolves Crescendo against the instruments active at its cast-start packet timestamp. */
function resolveCrescendo(context: MesmerCastContext, skill: MesmerSkill, at: number): void {
  const runtime = mesmerRuntimeFor(context);
  const state = troubadourState.from(context);
  const damageAt = context.start + Number(skill.damageAtMs || 0) / 1000;
  const activeInstruments = Object.entries(state.instruments).filter(([, expiresAt]) => expiresAt > damageAt);
  const strike = profileEffect(runtime, PROFILE.crescendo, 'strike');
  runtime.addDamage(skill, damageAt, {
    coefficient:
      Number(strike?.coefficient ?? 2.25) *
      (1 + activeInstruments.length * profileValue(runtime, PROFILE.crescendo, 'damageIncreasePerStack', 0.25)),
    hits: Number(strike?.hits ?? 1),
    source: 'Player',
    weaponStrengthProfileId: 'nonweapon.profession-mechanic'
  });

  if (runtime.traits.has(TRAIT.LIFE_OF_THE_PARTY)) {
    const effects = [
      profileEffect(runtime, TRAIT.LIFE_OF_THE_PARTY, 'boon', 2),
      profileEffect(runtime, TRAIT.LIFE_OF_THE_PARTY, 'boon', 3),
      profileEffect(runtime, TRAIT.LIFE_OF_THE_PARTY, 'boon', 4)
    ];
    for (const [index, [kind, stacks, duration]] of [
      ['quickness', 1, 8],
      ['might', 8, 15],
      ['fury', 1, 8]
    ].entries()) {
      const effect = effects[index];
      runtime.addEvent({
        type: 'buff',
        at: damageAt,
        kind: String(effect?.boon || kind),
        stacks: Number(effect?.stacks || stacks),
        duration: gw2SchedulerBoonDuration(
          context,
          skill,
          String(effect?.boon || kind),
          Number(effect?.duration || duration)
        ),
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
        at: damageAt + context.epsilon,
        kind: 'altered-chord',
        stacks: 1,
        duration: profileValue(runtime, TRAIT.ALTERED_CHORD, 'durationMultiplier', 10)
      });
      runtime.addTraitProc('Altered Chord', damageAt + context.epsilon, skill.name, 'Lute');
    } else if (state.lastInstrument === 'Flute') {
      runtime.addCondition(
        skill.name,
        damageAt,
        conditionFromProfile(runtime, TRAIT.ALTERED_CHORD, {
          name: 'Confusion',
          duration: 8,
          stacks: 5
        }),
        'Player',
        'Altered Chord — Confusion'
      );
      runtime.addTraitProc('Altered Chord', damageAt, skill.name, 'Flute');
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
    const applications = profileValue(runtime, TRAIT.FORTISSIMO, 'maximumStacks', 5);
    const interval = profileValue(runtime, TRAIT.FORTISSIMO, 'pulseInterval', 1);
    const resourceGain = profileValue(runtime, TRAIT.FORTISSIMO, 'resourceGain', 1);
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

/** Owns Troubadour performance completion while preserving packet attribution and Harp's interrupt commit point. */
export function completeTroubadourPerformance(context: MesmerCastContext, skill: MesmerSkill): void {
  const runtime = mesmerRuntimeFor(context);
  const instrument = runtime.instruments[skill.id];
  if (!instrument && skill.id !== ID.CRESCENDO) return;

  const interrupted = context.effectiveEnd < context.fullEnd - context.epsilon;
  const at = interrupted && instrument?.instrument === 'Harp' ? context.effectiveEnd : context.fullEnd;
  const previousEmission = runtime.activeEmission;
  runtime.activeEmission = {
    skill,
    effectiveEnd: interrupted ? context.effectiveEnd : Infinity,
    activationId: context.reservationId
  };
  try {
    if (instrument) {
      resolveInstrument(context, skill, instrument, at);
    } else {
      resolveCrescendo(context, skill, at);
    }
  } finally {
    runtime.activeEmission = previousEmission;
  }
}
