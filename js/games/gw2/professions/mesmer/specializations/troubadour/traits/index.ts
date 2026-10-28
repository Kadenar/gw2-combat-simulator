import { PRIMARY_ATTRIBUTES } from '#gw2/platform/attributes/calculation.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { ACTOR, BOON, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { StrikeEffect } from '#gw2/platform/effects/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { castWasInterrupted } from '#gw2/platform/execution/cast-timing.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { isCommittedInterruptedPhantasm } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { mesmerConditionFromProfile } from '#gw2/professions/mesmer/core/mechanics/condition-profiles.js';
import { illusionSource } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import {
  buildMesmerConditions,
  buildMesmerPacket,
  buildMesmerStrikes,
  mesmerPacketOwner
} from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { createMesmerIllusionRewards, mesmerActivePrimaryWeapon } from '#gw2/professions/mesmer/family-resources.js';
import {
  activeInstrumentCount,
  hasLute
} from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-queries.js';
import { afterimageInstrumentAttack } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instruments.js';
import {
  troubadourCrescendoResolved,
  troubadourDodgeCompleted,
  troubadourInstrumentAnnounced,
  troubadourInstrumentCommitted,
  troubadourInstrumentConditions,
  troubadourInstrumentControl,
  troubadourInstrumentStrike,
  troubadourTaleResolved
} from '#gw2/professions/mesmer/specializations/troubadour/mechanics/trigger-points.js';
import type { MesmerInstrument, MesmerRuntime } from '#gw2/professions/mesmer/types.js';

// Afterimages and Syncopate waves retain fixed delivery offsets while their payloads remain patchable.
export const CALL_AND_RESPONSE_DELAY_SECONDS = 1.5;

export const SYNCOPATE_DELAY_SECONDS = 3;

/** Wandering Minstrel owns baseline note capacity and instrument playing durations. */
const wanderingMinstrel = defineTrait<MesmerSkill>({
  name: 'Wandering Minstrel',
  id: TRAIT.WANDERING_MINSTREL,
  balance: { maximumStacks: 3, baseDuration: 5, durationPerTier: 5 }
});

/** Harmonize owns its existing profile and ordered performance consequences. */
export const harmonize = defineTrait<MesmerSkill>({
  name: 'Harmonize',
  id: TRAIT.HARMONIZE,
  balance: {
    resourceGain: 1
  },
  // Harmonize is an implicit minor; isolation still suppresses its new note reward.
  triggers: [{ on: 'castCommit', requiresSelection: false, run: completeTroubadourPhantasm }]
});

/** Mayhem owns its existing profile and ordered performance consequences. */
const mayhem = defineTrait<MesmerSkill>({
  name: 'Mayhem',
  id: TRAIT.MAYHEM,
  balance: {
    rechargeReduction: 1.5,
    effects: [{ name: CONDITION.TORMENT, type: 'condition', condition: CONDITION.TORMENT, duration: 5, stacks: 4 }]
  },
  triggers: [
    onTriggerPoint(troubadourDodgeCompleted, {
      run(runtime, { cast }: TriggerPointInput<typeof troubadourDodgeCompleted>) {
        const flute = runtime.helpers.skillsById.get(ID.FLUSTERING_FLUTE);

        if (!flute || !runtime.cooldownController.hasCooldown(flute.id)) return;

        runtime.cooldownController.reduceSkillRecharge(
          flute,
          balanceNumberFromContext(runtime, TRAIT.MAYHEM, 'rechargeReduction'),
          runtime.time
        );
        runtime.effects.emit({
          kind: 'announcement',
          log: true,
          attribution: { source: 'Trait', sourceId: TRAIT.MAYHEM, actorType: ACTOR.EFFECT },
          announcement: { type: 'trait', name: 'Mayhem', at: runtime.time, sourceSkill: cast.skill.name, detail: '' }
        });
      }
    }),
    onTriggerPoint(troubadourInstrumentConditions, {
      run: (runtime, input: TriggerPointInput<typeof troubadourInstrumentConditions>) =>
        applyMayhemInstrument(runtime, input.skill, input.data, input.damageAt, input.delivery)
    })
  ]
});

/** Raconteur owns its existing profile and ordered performance consequences. */
const raconteur = defineTrait<MesmerSkill>({
  name: 'Raconteur',
  id: TRAIT.RACONTEUR,
  balance: {
    effects: [{ name: boonKey(BOON.PROTECTION), type: 'boon', boon: BOON.PROTECTION, duration: 3, stacks: 1 }]
  },
  triggers: [
    onTriggerPoint(troubadourTaleResolved, {
      run: (runtime, input: TriggerPointInput<typeof troubadourTaleResolved>) =>
        triggerRaconteur(runtime, input.skill, input.at)
    })
  ]
});

/** Shredding owns its existing profile and ordered performance consequences. */
const shredding = defineTrait<MesmerSkill>({
  name: 'Shredding',
  id: TRAIT.SHREDDING,
  balance: {
    damageIncrease: 0.15,
    conditionDamageIncrease: 0.15,
    effects: [{ name: 'Strike', type: 'strike', coefficient: 1, hits: 1, atMs: 600 }]
  },
  modifierRules: [
    {
      id: 'mesmer.shredding',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      amount: (context, target) =>
        target === MODIFIER_TARGET.CONDITION_DAMAGE
          ? balanceNumberFromContext(context, TRAIT.SHREDDING, 'conditionDamageIncrease')
          : balanceNumberFromContext(context, TRAIT.SHREDDING, 'damageIncrease'),
      when: (context) => hasLute(context) && !illusionSource(context)
    }
  ],
  triggers: [
    onTriggerPoint(troubadourInstrumentStrike, {
      run: (runtime, input: TriggerPointInput<typeof troubadourInstrumentStrike>) => emitShredding(runtime, input)
    })
  ]
});

/** Life of the Party owns its existing profile and ordered performance consequences. */
const lifeOfTheParty = defineTrait<MesmerSkill>({
  name: 'Life of the Party',
  id: TRAIT.LIFE_OF_THE_PARTY,
  balance: {
    effects: [
      {
        type: 'boon',
        name: 'Lute Quickness',
        boon: BOON.QUICKNESS,
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        name: 'Lute Might',
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 5
      },
      {
        type: 'boon',
        name: 'Crescendo Quickness',
        boon: BOON.QUICKNESS,
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        name: 'Crescendo Might',
        boon: BOON.MIGHT,
        duration: 15,
        stacks: 8
      },
      {
        type: 'boon',
        name: 'Crescendo Fury',
        boon: BOON.FURY,
        duration: 8,
        stacks: 1
      }
    ]
  },
  triggers: [
    onTriggerPoint(troubadourCrescendoResolved, {
      run: (runtime, input: TriggerPointInput<typeof troubadourCrescendoResolved>) =>
        grantCrescendoPartyBoons(runtime, input)
    }),
    onTriggerPoint(troubadourInstrumentControl, {
      run: (runtime, input: TriggerPointInput<typeof troubadourInstrumentControl>) =>
        applyLuteLifeOfTheParty(runtime, input.skill, input.data, input.damageAt, input.delivery)
    })
  ]
});

/** Fortissimo owns its existing profile and ordered performance consequences. */
export const fortissimo = defineTrait<MesmerSkill>({
  name: 'Fortissimo',
  id: TRAIT.FORTISSIMO,
  balance: {
    attributeConversion: 0.04,
    maximumStacks: 5,
    pulseInterval: 1,
    resourceGain: 1
  },
  // Convert eligible attributes once, excluding Might, signet passives, and other conversion results.
  attributes: (context) => {
    const multiplier =
      activeInstrumentCount(context) * balanceNumberFromContext(context, TRAIT.FORTISSIMO, 'attributeConversion');
    return {
      attributeEffects: PRIMARY_ATTRIBUTES.map((attribute) => ({
        kind: 'conversion' as const,
        from: attribute,
        to: attribute,
        multiplier,
        rounding: 'round' as const,
        input: 'eligible' as const
      }))
    };
  },
  triggers: [
    onTriggerPoint(troubadourCrescendoResolved, {
      run: (runtime, input: TriggerPointInput<typeof troubadourCrescendoResolved>) =>
        queueFortissimoNotes(runtime, input)
    })
  ]
});

/** Call and Response owns its existing profile and ordered performance consequences. */
const callAndResponse = defineTrait<MesmerSkill>({
  name: 'Call and Response',
  id: TRAIT.CALL_AND_RESPONSE,
  balance: {
    threshold: 3
  },
  triggers: [
    onTriggerPoint(troubadourInstrumentCommitted, {
      run: (runtime, input: TriggerPointInput<typeof troubadourInstrumentCommitted>) =>
        applyCallAndResponse(runtime, input.skill, input.data, input.at, input.spent, input.delivery)
    })
  ]
});

/** Symphonic Resonance owns its existing profile and ordered performance consequences. */
const symphonicResonance = defineTrait<MesmerSkill>({
  name: 'Symphonic Resonance',
  id: TRAIT.SYMPHONIC_RESONANCE,
  balance: { enduranceRegenerationMultiplier: 1.25 }
});

/** Altered Chord owns its existing profile and ordered performance consequences. */
const alteredChord = defineTrait<MesmerSkill>({
  name: 'Altered Chord',
  id: TRAIT.ALTERED_CHORD,
  balance: {
    damageIncrease: 0.25,
    rechargeReduction: 2,
    duration: 10,
    effects: [{ name: CONDITION.CONFUSION, type: 'condition', condition: CONDITION.CONFUSION, duration: 8, stacks: 5 }]
  },
  modifierRules: [
    {
      id: 'mesmer.altered-chord',
      requiresSelection: false,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, TRAIT.ALTERED_CHORD, 'damageIncrease'),
      when: (context) => buffActive(context, 'altered-chord') && !illusionSource(context)
    }
  ],
  triggers: [
    onTriggerPoint(troubadourCrescendoResolved, {
      run: (runtime, input: TriggerPointInput<typeof troubadourCrescendoResolved>) =>
        resolveAlteredChord(runtime, input)
    }),
    onTriggerPoint(troubadourInstrumentAnnounced, {
      run: (runtime, input: TriggerPointInput<typeof troubadourInstrumentAnnounced>) =>
        reduceAlteredChordRecharge(runtime, input.spent, input.at)
    })
  ]
});

/** Register the control reaction and queued heal wave without changing their separate eligibility. */
export const syncopate = defineTrait<MesmerSkill>({
  name: 'Syncopate',
  id: TRAIT.SYNCOPATE,
  balance: {
    effects: [
      { type: 'strike', name: 'Immediate wave', coefficient: 0.75, hits: 1 },
      { type: 'strike', name: 'Delayed wave', coefficient: 1, hits: 1 },
      { type: 'control', name: 'Delayed daze', controlKind: CONTROL.DAZE }
    ]
  },
  triggers: [
    { on: 'control.resolved', run: observeSyncopateEvent },
    onTriggerPoint(troubadourInstrumentControl, {
      run: (runtime, input: TriggerPointInput<typeof troubadourInstrumentControl>) =>
        scheduleSyncopateDrumWave(runtime, input.skill, input.data, input.damageAt, input.delivery)
    })
  ],
  lifetime: {
    tasks: { 'mesmer.syncopate': triggerMethodOfMadnessSyncopate }
  }
});

/** Collect trait owners while instruments, notes, afterimage packets, and endurance remain shared mechanics. */
export const troubadourTraits = [
  wanderingMinstrel,
  harmonize,
  mayhem,
  raconteur,
  shredding,
  lifeOfTheParty,
  fortissimo,
  callAndResponse,
  symphonicResonance,
  alteredChord,
  syncopate
];

/** Grants Harmonize's resource only once a phantasm has crossed its summon point. */
function completeTroubadourPhantasm(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const skill = cast.skill;

  if (skill.resource?.mode !== 'phantasm') return;

  const interrupted = castWasInterrupted(cast);
  const completedInterruptedPhantasm = isCommittedInterruptedPhantasm(cast, skill);

  if (interrupted && !completedInterruptedPhantasm) return;

  createMesmerIllusionRewards(context).queueResources(
    context.time,
    balanceNumberFromContext(context, TRAIT.HARMONIZE, 'resourceGain'),
    mesmerActivePrimaryWeapon(context),
    'Harmonize',
    { traitId: TRAIT.HARMONIZE, traitName: 'Harmonize' }
  );
}

/** Shredding's extra note remains independent of the native Lute strike and validates its packet timing. */
function shreddingStrike(context: MesmerRuntime, data: MesmerInstrument): StrikeEffect | undefined {
  const shredding =
    data.instrument === 'Lute'
      ? requireEffect(requireBalanceProfileFromContext(context, TRAIT.SHREDDING), 'strike', 'Strike')
      : undefined;

  if (shredding && !shredding.ticks)
    effectNumber(requireBalanceProfileFromContext(context, TRAIT.SHREDDING), shredding, 'atMs');

  return shredding;
}

/** Mayhem adds Torment to the player's own Flute impact; afterimage replays never carry it. */
function applyMayhemInstrument(
  context: MesmerRuntime,
  skill: MesmerSkill,
  data: MesmerInstrument,
  damageAt: number,
  delivery: EffectDelivery = {}
): void {
  if (data.instrument === 'Flute') {
    const condition = mesmerConditionFromProfile(context, TRAIT.MAYHEM, CONDITION.TORMENT);

    if (condition)
      buildMesmerConditions(context, skill.name, damageAt, condition, 'Player', 'Mayhem — Torment', {
        source: 'Player',
        sourceId: TRAIT.MAYHEM,
        skillId: skill.id,
        actorType: ACTOR.PLAYER
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
}

/** Keep life of the party at the existing instrument execution boundary. */
function applyLuteLifeOfTheParty(
  context: MesmerRuntime,
  skill: MesmerSkill,
  data: MesmerInstrument,
  damageAt: number,
  delivery: EffectDelivery = {}
): void {
  if (data.instrument !== 'Lute') return;

  const profile = requireBalanceProfileFromContext(context, TRAIT.LIFE_OF_THE_PARTY);
  // Named grants retain independent removal and their original party attribution.
  for (const name of ['Lute Quickness', 'Lute Might'])
    emitTraitProfile(context, TRAIT.LIFE_OF_THE_PARTY, TRAIT.LIFE_OF_THE_PARTY, delivery.cause, {
      ...delivery,
      at: damageAt,
      effect: { type: 'boon', name },
      preserveName: true,
      // Party boons keep the explicit default packet priority their dedicated packets carried.
      priority: 0,
      skillId: TRAIT.LIFE_OF_THE_PARTY,
      skillName: profile.name,
      attribution: { actorType: ACTOR.PLAYER, audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 } },
      transform: (event) => ({ ...event, sourceSkill: skill.name })
    });
}

/** Keep call and response at the existing instrument execution boundary. */
function applyCallAndResponse(
  context: MesmerRuntime,
  skill: MesmerSkill,
  data: MesmerInstrument,
  at: number,
  spent: number,
  delivery: EffectDelivery = {}
): void {
  if (spent === balanceNumberFromContext(context, TRAIT.CALL_AND_RESPONSE, 'threshold')) {
    const afterimageAt = at + CALL_AND_RESPONSE_DELAY_SECONDS;
    afterimageInstrumentAttack(context, skill, data, afterimageAt, delivery);
    context.effects.emit({
      ...delivery,
      kind: 'announcement',
      log: true,
      attribution: { source: 'Trait', sourceId: TRAIT.CALL_AND_RESPONSE, actorType: ACTOR.EFFECT },
      announcement: { type: 'trait', name: 'Call and Response', at: afterimageAt, sourceSkill: skill.name, detail: '' }
    });
  }
}

/** Keep altered chord at the existing instrument execution boundary. */
function reduceAlteredChordRecharge(context: MesmerRuntime, spent: number, at: number): void {
  if (spent > 0) {
    const crescendo = context.helpers.skillsById.get(ID.CRESCENDO);
    const ready = crescendo ? context.cooldownController.readyAt(crescendo.id) : undefined;

    if (crescendo && ready) {
      context.cooldownController.reduceSkillRecharge(
        crescendo,
        balanceNumberFromContext(context, TRAIT.ALTERED_CHORD, 'rechargeReduction'),
        at
      );
    }
  }
}

/** Raconteur follows the Tale's own boons and eligible note grant. */
function triggerRaconteur(context: MesmerRuntime, skill: MesmerSkill, at: number): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.RACONTEUR);

  if (!requireEffect(profile, 'boon', boonKey(BOON.PROTECTION))) return;

  const proc = context.effects.emit({
    receipt: true,
    kind: 'announcement',
    log: true,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.RACONTEUR,
      actorType: ACTOR.EFFECT,
      skillId: TRAIT.RACONTEUR,
      skillName: profile.name
    },
    announcement: { type: 'trait', name: profile.name, at, sourceSkill: skill.name, detail: '' }
  });
  emitTraitProfile(context, TRAIT.RACONTEUR, TRAIT.RACONTEUR, proc, {
    at,
    effect: { type: 'boon', name: boonKey(BOON.PROTECTION) },
    skillId: TRAIT.RACONTEUR,
    skillName: profile.name,
    attribution: { actorType: ACTOR.PLAYER, audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 } },
    transform: (event) => ({ ...event, sourceSkill: skill.name })
  });
}

/** Resolve Syncopate's control reward after its trait listener admits selection. */
function observeSyncopateEvent(context: MesmerRuntime, event: SimulationEvent): void {
  if (event.type !== 'control') return;

  const syncopateProfile = requireBalanceProfileFromContext(context, TRAIT.SYNCOPATE);
  const damage = requireEffect(syncopateProfile, 'strike', 'Immediate wave');

  if (!damage) return;

  const skillName = event.skillName || event.name || 'Control effect';
  buildMesmerStrikes(
    context,
    { id: 'Syncopate', name: 'Syncopate', weapon: 'Utility', blade: false },
    event.at,
    {
      ...damage,
      name: undefined,
      summonKind: undefined,
      source: 'Trait',
      actorType: ACTOR.PLAYER,
      // A proc caused by a surviving delayed disable inherits that packet's interruption protection.
      persistsAfterInterrupt: event.persistsAfterInterrupt === true,
      weapon: 'utility',
      weaponStrengthProfileId: 'nonweapon.unequipped'
    },
    { source: 'Trait', sourceId: TRAIT.SYNCOPATE, actorType: ACTOR.PLAYER }
  ).forEach((packet) => {
    context.effects.emit({
      kind: 'packet',
      event: packet,
      owner: mesmerPacketOwner(packet),
      priority: Number(packet.priority ?? 0)
    });
  });
  context.effects.emit({
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.SYNCOPATE, actorType: ACTOR.EFFECT },
    announcement: { type: 'trait', name: 'Syncopate', at: event.at, sourceSkill: skillName, detail: '' }
  });
}

/** The committed heal triggers its immediate wave even when diagnostic proc output is suppressed. */
function triggerMethodOfMadnessSyncopate(context: MesmerRuntime): void {
  if (!hasTrait(context, TRAIT.SYNCOPATE)) return;

  const damage = requireEffect(requireBalanceProfileFromContext(context, TRAIT.SYNCOPATE), 'strike', 'Immediate wave');

  if (!damage) return;

  buildMesmerStrikes(context, { id: 'Syncopate', name: 'Syncopate', weapon: 'Utility', blade: false }, context.time, {
    ...damage,
    name: undefined,
    summonKind: undefined,
    source: 'Player',
    weapon: 'utility'
  }).forEach((packet) => {
    context.effects.emit({
      kind: 'packet',
      event: packet,
      owner: mesmerPacketOwner(packet),
      priority: Number(packet.priority ?? 0)
    });
  });
  context.effects.emit({
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.SYNCOPATE, actorType: ACTOR.EFFECT },
    announcement: { type: 'trait', name: 'Syncopate', at: context.time, sourceSkill: 'Lesser Chaos Storm', detail: '' }
  });
}

/** Adds the delayed wave and its daze to the player's own Drum impact; afterimage replays never carry it. */
function scheduleSyncopateDrumWave(
  context: MesmerRuntime,
  skill: MesmerSkill,
  instrument: MesmerInstrument,
  damageAt: number,
  delivery: EffectDelivery = {}
): void {
  if (instrument.instrument !== 'Drum') return;

  const syncopateProfile = requireBalanceProfileFromContext(context, TRAIT.SYNCOPATE);
  const delayedAt = damageAt + SYNCOPATE_DELAY_SECONDS;
  const delayedWave = requireEffect(syncopateProfile, 'strike', 'Delayed wave');
  const daze = requireEffect(syncopateProfile, 'control', 'Delayed daze');

  // The delayed strike and disable survive independently; empty output produces no proc.
  if (!delayedWave && !daze) return;

  if (delayedWave)
    buildMesmerStrikes(
      context,
      {
        id: 'Syncopate delayed wave',
        name: 'Syncopate',
        weapon: 'Utility',
        blade: false
      },
      delayedAt,
      {
        ...delayedWave,
        name: undefined,
        summonKind: undefined,
        source: 'Trait',
        actorType: ACTOR.PLAYER,
        // The committed Drum owns this delayed projectile even after its animation is interrupted.
        persistsAfterInterrupt: true,
        weaponStrengthProfileId: 'nonweapon.unequipped'
      },
      {
        source: 'Trait',
        sourceId: TRAIT.SYNCOPATE,
        skillId: skill.id,
        actorType: ACTOR.PLAYER,
        damageBreakdownName: 'Syncopate (Delay Wave)',
        name: 'Syncopate — delayed wave'
      }
    ).forEach((packet) => {
      context.effects.emit({
        ...delivery,
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    });

  if (daze) {
    const packet = buildMesmerPacket({
      type: 'control',
      at: delayedAt,
      skillId: skill.id,
      skillName: 'Syncopate — delayed wave',
      controlKind: daze.controlKind,
      persistsAfterInterrupt: true,
      source: 'Player',
      sourceId: TRAIT.SYNCOPATE,
      actorType: ACTOR.PLAYER
    });
    context.effects.emit({
      ...delivery,
      kind: 'packet',
      event: packet,
      owner: mesmerPacketOwner(packet),
      priority: Number(packet.priority ?? 0)
    });
  }

  context.effects.emit({
    ...delivery,
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.SYNCOPATE, actorType: ACTOR.EFFECT },
    announcement: {
      type: 'trait',
      name: 'Syncopate',
      at: delayedAt,
      sourceSkill: skill.name,
      detail: 'delayed drum wave'
    }
  });
}

/** life of the party consumes the captured Crescendo boundary after its strike. */
function grantCrescendoPartyBoons(
  context: MesmerRuntime,
  { skill, damageAt, delivery }: TriggerPointInput<typeof troubadourCrescendoResolved>
): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.LIFE_OF_THE_PARTY);
  // Named grants retain independent removal and their original party attribution.
  for (const name of ['Crescendo Quickness', 'Crescendo Might', 'Crescendo Fury'])
    emitTraitProfile(context, TRAIT.LIFE_OF_THE_PARTY, TRAIT.LIFE_OF_THE_PARTY, delivery.cause, {
      ...delivery,
      at: damageAt,
      effect: { type: 'boon', name },
      preserveName: true,
      // Party boons keep the explicit default packet priority their dedicated packets carried.
      priority: 0,
      skillId: TRAIT.LIFE_OF_THE_PARTY,
      skillName: profile.name,
      attribution: { actorType: ACTOR.PLAYER, audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 } },
      transform: (event) => ({ ...event, sourceSkill: skill.name })
    });
}

/** altered chord consumes the captured Crescendo boundary after its strike. */
function resolveAlteredChord(
  context: MesmerRuntime,
  { skill, damageAt, delivery, lastInstrument }: TriggerPointInput<typeof troubadourCrescendoResolved>
): void {
  if (lastInstrument === 'Lute') {
    const alteredChordProfile = requireBalanceProfileFromContext(context, TRAIT.ALTERED_CHORD);
    // The activation owns its status row without changing the status's post-strike priority.
    const proc = context.effects.emit({
      receipt: true,
      ...delivery,
      kind: 'announcement',
      log: true,
      attribution: { source: 'Trait', sourceId: TRAIT.ALTERED_CHORD, actorType: ACTOR.EFFECT },
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
        duration: balanceProfileNumber(alteredChordProfile, 'duration')
      });
      context.effects.emit({
        ...delivery,
        kind: 'packet',
        cause: proc,
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    }
  } else if (lastInstrument === 'Flute') {
    const condition = mesmerConditionFromProfile(context, TRAIT.ALTERED_CHORD, CONDITION.CONFUSION);

    if (condition)
      buildMesmerConditions(context, skill.name, damageAt, condition, 'Player', 'Altered Chord — Confusion', {
        skillId: skill.id
      }).forEach((packet) => {
        context.effects.emit({
          ...delivery,
          kind: 'packet',
          event: packet,
          owner: mesmerPacketOwner(packet),
          priority: Number(packet.priority ?? 0)
        });
      });

    if (condition)
      context.effects.emit({
        ...delivery,
        kind: 'announcement',
        log: true,
        attribution: { source: 'Trait', sourceId: TRAIT.ALTERED_CHORD, actorType: ACTOR.EFFECT },
        announcement: { type: 'trait', name: 'Altered Chord', at: damageAt, sourceSkill: skill.name, detail: 'Flute' }
      });
  } else if (lastInstrument === 'Drum') {
    {
      const packet = buildMesmerPacket({
        type: 'control',
        at: damageAt,
        skillId: skill.id,
        skillName: skill.name,
        source: 'Player',
        sourceId: TRAIT.ALTERED_CHORD,
        actorType: ACTOR.PLAYER
      });
      context.effects.emit({
        ...delivery,
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    }

    context.effects.emit({
      ...delivery,
      kind: 'announcement',
      log: true,
      attribution: { source: 'Trait', sourceId: TRAIT.ALTERED_CHORD, actorType: ACTOR.EFFECT },
      announcement: { type: 'trait', name: 'Altered Chord', at: damageAt, sourceSkill: skill.name, detail: 'Drum' }
    });
  }
}

/** fortissimo consumes the captured Crescendo boundary after its strike. */
function queueFortissimoNotes(
  context: MesmerRuntime,
  { at }: TriggerPointInput<typeof troubadourCrescendoResolved>
): void {
  const fortissimoProfile = requireBalanceProfileFromContext(context, TRAIT.FORTISSIMO);
  const applications = balanceProfileNumber(fortissimoProfile, 'maximumStacks');
  const interval = balanceProfileNumber(fortissimoProfile, 'pulseInterval');
  const resourceGain = balanceProfileNumber(fortissimoProfile, 'resourceGain');
  for (let index = 1; index <= applications; index += 1) {
    createMesmerIllusionRewards(context).queueResources(
      at + index * interval,
      resourceGain,
      mesmerActivePrimaryWeapon(context),
      'Fortissimo',
      {
        traitId: TRAIT.FORTISSIMO,
        traitName: 'Fortissimo'
      }
    );
  }
}

/** Shredding adds its extra note to the player's own Lute; afterimage replays never carry it. */
function emitShredding(
  context: MesmerRuntime,
  { skill, data, damageAt, delivery }: TriggerPointInput<typeof troubadourInstrumentStrike>
): void {
  const shredding = shreddingStrike(context, data);

  // The extra note belongs to Shredding, so removing the native Lute strike does not remove it.
  if (shredding?.type !== 'strike') return;

  buildMesmerStrikes(
    context,
    skill,
    damageAt,
    {
      ...shredding,
      name: undefined,
      summonKind: undefined,
      source: 'Player',
      actorType: ACTOR.PLAYER,
      persistsAfterInterrupt: data.persistsAfterInterrupt,
      weaponStrengthProfileId: 'nonweapon.profession-mechanic'
    },
    { source: 'Player', sourceId: skill.id, skillId: skill.id, actorType: ACTOR.PLAYER }
  ).forEach((packet) => {
    context.effects.emit({
      ...delivery,
      kind: 'packet',
      // The extra note is trait-owned so previews and breakdowns report it as Shredding.
      event: { ...packet, name: 'Shredding', procType: 'trait', traitId: TRAIT.SHREDDING },
      owner: mesmerPacketOwner(packet),
      priority: Number(packet.priority ?? 0)
    });
  });
}
