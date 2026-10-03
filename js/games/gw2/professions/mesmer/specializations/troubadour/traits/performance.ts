import type { EffectDelivery } from '#gw2/platform/simulation/effect-emission.js';
import type { MesmerEventExtra } from '#gw2/professions/mesmer/data/types.js';
import {
  buildMesmerConditions,
  mesmerPacketOwner,
  buildMesmerPacket
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { StrikeEffect } from '#gw2/platform/engine/skills/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { isCommittedInterruptedPhantasm } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { mesmerConditionFromProfile, mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { activeInstrumentCount } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-queries.js';
import { troubadourState } from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import type { MesmerInstrument, MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Grants Harmonize's resource only once a phantasm has crossed its summon point. */
export function completeTroubadourPhantasm(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const skill = cast.skill;
  if (skill.resource?.mode !== 'phantasm') return;
  const interrupted = castWasInterrupted(cast);
  const completedInterruptedPhantasm = isCommittedInterruptedPhantasm(cast, skill);
  if (interrupted && !completedInterruptedPhantasm) return;

  const runtime = mesmerMechanicsFor(context);
  const harmonizeProfile = requireBalanceProfileFromContext(context, TRAIT.HARMONIZE);
  runtime.resources.queueResources(
    context.time,
    balanceProfileNumber(harmonizeProfile, 'resourceGain'),
    runtime.activePrimaryWeapon(),
    'Harmonize',
    { traitId: TRAIT.HARMONIZE, traitName: 'Harmonize' }
  );
}

/** Shredding's extra note remains independent of the native Lute strike and validates its packet timing. */
export function shreddingStrike(context: MesmerRuntime, data: MesmerInstrument): StrikeEffect | undefined {
  const shredding =
    data.instrument === 'Lute' && hasTrait(context, TRAIT.SHREDDING)
      ? requireEffect(requireBalanceProfileFromContext(context, TRAIT.SHREDDING), 'strike', 'Strike')
      : undefined;
  if (shredding && !shredding.ticks)
    effectNumber(requireBalanceProfileFromContext(context, TRAIT.SHREDDING), shredding, 'atMs');
  return shredding;
}

/** Keep mayhem at the existing instrument execution boundary. */
export function applyMayhemInstrument(
  context: MesmerRuntime,
  skill: MesmerSkill,
  data: MesmerInstrument,
  damageAt: number,
  source: string,
  actorType: 'player' | 'summon',
  delivery: EffectDelivery = {}
): void {
  const runtime = mesmerMechanicsFor(context);
  if (data.instrument === 'Flute' && hasTrait(context, TRAIT.MAYHEM)) {
    const condition = mesmerConditionFromProfile(context, TRAIT.MAYHEM, 'Torment');
    if (condition)
      buildMesmerConditions(runtime.context, skill.name, damageAt, condition, source, 'Mayhem — Torment', {
        source,
        sourceId: TRAIT.MAYHEM,
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
}

/** Keep life of the party at the existing instrument execution boundary. */
export function applyLuteLifeOfTheParty(
  context: MesmerRuntime,
  skill: MesmerSkill,
  data: MesmerInstrument,
  damageAt: number,
  delivery: EffectDelivery = {}
): void {
  const runtime = mesmerMechanicsFor(context);
  if (hasTrait(context, TRAIT.LIFE_OF_THE_PARTY) && data.instrument === 'Lute') {
    // Each named boon survives independently when its sibling is removed.
    for (const name of ['Lute Quickness', 'Lute Might']) {
      const lifeOfThePartyProfile = requireBalanceProfileFromContext(context, TRAIT.LIFE_OF_THE_PARTY);
      const effect = requireEffect(lifeOfThePartyProfile, 'boon', name);
      if (!effect) continue;
      {
        const packet = buildMesmerPacket({
          type: 'buff',
          at: damageAt,
          kind: effect.boon,
          stacks: effect.stacks,
          duration: effect.duration,
          source: 'Trait',
          sourceId: TRAIT.LIFE_OF_THE_PARTY,
          skillId: TRAIT.LIFE_OF_THE_PARTY,
          skillName: lifeOfThePartyProfile.name,
          sourceSkill: skill.name,
          audience: { recipients: 'party', maximumRecipients: 5 }
        });
        runtime.context.effects.emit({
          ...delivery,
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
      }
    }
  }
}

/** Keep call and response at the existing instrument execution boundary. */
export function applyCallAndResponse(
  context: MesmerRuntime,
  skill: MesmerSkill,
  data: MesmerInstrument,
  at: number,
  spent: number,
  instrumentAttack: (
    context: MesmerRuntime,
    skill: MesmerSkill,
    data: MesmerInstrument,
    at: number,
    source: string,
    actorType: 'player' | 'summon',
    delivery?: EffectDelivery
  ) => void,
  delivery: EffectDelivery = {}
): void {
  const runtime = mesmerMechanicsFor(context);
  if (
    hasTrait(context, TRAIT.CALL_AND_RESPONSE) &&
    spent === balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CALL_AND_RESPONSE), 'threshold')
  ) {
    const callAndResponseProfile = requireBalanceProfileFromContext(context, TRAIT.CALL_AND_RESPONSE);
    const afterimageAt = at + balanceProfileNumber(callAndResponseProfile, 'initialDelay');
    instrumentAttack(context, skill, data, afterimageAt, 'Afterimage', 'summon', delivery);
    runtime.context.effects.emit({
      ...delivery,
      kind: 'announcement',
      log: true,
      attribution: { source: 'Trait', sourceId: TRAIT.CALL_AND_RESPONSE, actorType: 'effect' },
      announcement: { type: 'trait', name: 'Call and Response', at: afterimageAt, sourceSkill: skill.name, detail: '' }
    });
  }
}

/** Keep altered chord at the existing instrument execution boundary. */
export function reduceAlteredChordRecharge(context: MesmerRuntime, spent: number, at: number): void {
  if (hasTrait(context, TRAIT.ALTERED_CHORD) && spent > 0) {
    const crescendo = context.helpers.skillsById.get(ID.CRESCENDO);
    const ready = crescendo ? context.cooldowns.get(crescendo.id) : undefined;
    if (crescendo && ready) {
      const alteredChordProfile = requireBalanceProfileFromContext(context, TRAIT.ALTERED_CHORD);
      context.cooldownController.reduceSkillRecharge(
        crescendo,
        balanceProfileNumber(alteredChordProfile, 'rechargeReduction'),
        at
      );
    }
  }
}

/** Party boons precede Altered Chord and Fortissimo after Crescendo's strike has been materialized. */
export function applyCrescendoTraits(
  context: MesmerRuntime,
  skill: MesmerSkill,
  damageAt: number,
  at: number,
  delivery: EffectDelivery = {}
): void {
  const runtime = mesmerMechanicsFor(context);
  const state = troubadourState.from(context);
  if (hasTrait(context, TRAIT.LIFE_OF_THE_PARTY)) {
    for (const name of ['Crescendo Quickness', 'Crescendo Might', 'Crescendo Fury']) {
      const lifeOfThePartyProfile = requireBalanceProfileFromContext(context, TRAIT.LIFE_OF_THE_PARTY);
      const effect = requireEffect(lifeOfThePartyProfile, 'boon', name);
      if (!effect) continue;
      {
        const packet = buildMesmerPacket({
          type: 'buff',
          at: damageAt,
          kind: String(effect.boon),
          stacks: Number(effect.stacks),
          duration: effect.duration,
          source: 'Trait',
          sourceId: TRAIT.LIFE_OF_THE_PARTY,
          skillId: TRAIT.LIFE_OF_THE_PARTY,
          skillName: lifeOfThePartyProfile.name,
          sourceSkill: skill.name,
          audience: { recipients: 'party' as const, maximumRecipients: 5 }
        });
        runtime.context.effects.emit({
          ...delivery,
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
      }
    }
  }

  if (hasTrait(context, TRAIT.ALTERED_CHORD)) {
    if (state.lastInstrument === 'Lute') {
      const alteredChordProfile = requireBalanceProfileFromContext(context, TRAIT.ALTERED_CHORD);
      // The activation owns its status row without changing the status's post-strike priority.
      const proc = runtime.context.effects.emit({
        ...delivery,
        kind: 'announcement',
        log: true,
        attribution: { source: 'Trait', sourceId: TRAIT.ALTERED_CHORD, actorType: 'effect' },
        announcement: { type: 'trait', name: 'Altered Chord', at: damageAt, sourceSkill: skill.name, detail: 'Lute' }
      });
      {
        const packet = buildMesmerPacket({
          type: 'buff',
          at: damageAt,
          source: 'Trait',
          sourceId: TRAIT.ALTERED_CHORD,
          skillId: TRAIT.ALTERED_CHORD,
          skillName: alteredChordProfile.name,
          sourceSkill: skill.name,
          // Altered Chord must not modify the Crescendo strike that triggered it.
          priority: 5,
          kind: 'altered-chord',
          stacks: 1,
          duration: balanceProfileNumber(alteredChordProfile, 'durationMultiplier')
        });
        runtime.context.effects.emit({
          ...delivery,
          kind: 'packet',
          cause: proc,
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
      }
    } else if (state.lastInstrument === 'Flute') {
      const condition = mesmerConditionFromProfile(context, TRAIT.ALTERED_CHORD, 'Confusion');
      if (condition)
        buildMesmerConditions(
          runtime.context,
          skill.name,
          damageAt,
          condition,
          'Player',
          'Altered Chord — Confusion'
        ).forEach((packet) => {
          runtime.context.effects.emit({
            ...delivery,
            kind: 'packet',
            event: packet,
            owner: mesmerPacketOwner(packet),
            priority: Number(packet.priority ?? 0)
          });
        });
      if (condition)
        runtime.context.effects.emit({
          ...delivery,
          kind: 'announcement',
          log: true,
          attribution: { source: 'Trait', sourceId: TRAIT.ALTERED_CHORD, actorType: 'effect' },
          announcement: { type: 'trait', name: 'Altered Chord', at: damageAt, sourceSkill: skill.name, detail: 'Flute' }
        });
    } else if (state.lastInstrument === 'Drum') {
      {
        const packet = buildMesmerPacket({
          type: 'control',
          at: damageAt,
          skillId: skill.id,
          skillName: skill.name,
          source: 'Player',
          sourceId: TRAIT.ALTERED_CHORD,
          actorType: 'player'
        });
        runtime.context.effects.emit({
          ...delivery,
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
      }

      runtime.context.effects.emit({
        ...delivery,
        kind: 'announcement',
        log: true,
        attribution: { source: 'Trait', sourceId: TRAIT.ALTERED_CHORD, actorType: 'effect' },
        announcement: { type: 'trait', name: 'Altered Chord', at: damageAt, sourceSkill: skill.name, detail: 'Drum' }
      });
    }
  }

  if (hasTrait(context, TRAIT.FORTISSIMO)) {
    const fortissimoProfile = requireBalanceProfileFromContext(context, TRAIT.FORTISSIMO);
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

/** Raconteur follows the Tale's own boons and eligible note grant. */
export function triggerRaconteur(context: MesmerRuntime, skill: MesmerSkill, at: number): void {
  const runtime = mesmerMechanicsFor(context);
  const partyRecipients = { audience: { recipients: 'party' as const, maximumRecipients: 5 } };
  if (hasTrait(context, TRAIT.RACONTEUR)) {
    const raconteurProfile = requireBalanceProfileFromContext(context, TRAIT.RACONTEUR);
    const protection = requireEffect(raconteurProfile, 'boon', 'protection');
    if (!protection) return;
    {
      const grants: readonly MesmerEventExtra[] = [
        {
          kind: String(protection.boon),
          stacks: Number(protection.stacks),
          duration: protection.duration,
          skillName: skill.name,
          sourceSkill: skill.name,
          ...partyRecipients
        }
      ];
      const traitProfile = requireBalanceProfileFromContext(runtime.context, TRAIT.RACONTEUR);
      const traitSource = {
        source: 'Trait',
        sourceId: TRAIT.RACONTEUR,
        actorType: 'player' as const,
        skillId: TRAIT.RACONTEUR,
        skillName: traitProfile.name
      };
      {
        const proc = runtime.context.effects.emit({
          kind: 'announcement',
          log: true,
          attribution: { ...traitSource, actorType: 'effect' },
          announcement: { type: 'trait', name: traitProfile.name, at: at, sourceSkill: skill.name, detail: '' }
        });
        for (const grant of grants)
          runtime.context.effects.emit({
            kind: 'packet',
            cause: proc,
            event: { ...grant, ...traitSource, type: 'buff', at: at, name: traitProfile.name, sourceSkill: skill.name }
          });
      }
    }
  }
}

/** Flute's intrinsic endurance contribution retains its playing-window gate without current trait selection. */
export function symphonicResonanceEndurance(context: MesmerRuntime, flutePlaying: boolean): number {
  return flutePlaying
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(context, TRAIT.SYMPHONIC_RESONANCE),
        'enduranceRegenerationMultiplier'
      ) - 1
    : 0;
}

/** Fortissimo scales the original attributes once per currently playing instrument. */
export function applyTroubadourAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const instrumentCount = hasTrait(context, TRAIT.FORTISSIMO) ? activeInstrumentCount(context) : 0;
  const fortissimo = instrumentCount
    ? 1 +
      instrumentCount *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FORTISSIMO), 'attributeConversion')
    : 1;
  if (fortissimo === 1) return attributes;
  return {
    ...attributes,
    power: (attributes.power || 0) * fortissimo,
    precision: (attributes.precision || 0) * fortissimo,
    toughness: (attributes.toughness || 0) * fortissimo,
    vitality: (attributes.vitality || 0) * fortissimo,
    ferocity: (attributes.ferocity || 0) * fortissimo,
    conditionDamage: (attributes.conditionDamage || 0) * fortissimo,
    expertise: (attributes.expertise || 0) * fortissimo,
    concentration: (attributes.concentration || 0) * fortissimo,
    healingPower: (attributes.healingPower || 0) * fortissimo
  };
}
