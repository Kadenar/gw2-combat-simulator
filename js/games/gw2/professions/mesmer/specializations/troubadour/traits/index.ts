import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
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
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { isCommittedInterruptedPhantasm } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { mesmerConditionFromProfile } from '#gw2/professions/mesmer/core/mechanics/conditions.js';
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
import { instrumentAttack } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instruments.js';
import {
  troubadourCrescendoResolved,
  troubadourDodgeCompleted,
  troubadourInstrumentAnnounced,
  troubadourInstrumentCommitted,
  troubadourInstrumentConditions,
  troubadourInstrumentControl,
  troubadourInstrumentStrike,
  troubadourTaleResolved
} from '#gw2/professions/mesmer/specializations/troubadour/mechanics/trait-boundaries.js';
import type { MesmerInstrument, MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Harmonize owns its existing profile and ordered performance consequences. */
export const harmonize = defineTrait<MesmerSkill>({
  id: TRAIT.HARMONIZE,
  name: 'Harmonize',
  balance: {
    resourceGain: 1
  },
  // Harmonize is an implicit minor; isolation still suppresses its new note reward.
  triggers: [{ on: 'castCommit', requiresSelection: false, run: completeTroubadourPhantasm }]
});

/** Mayhem owns its existing profile and ordered performance consequences. */
export const mayhem = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(troubadourDodgeCompleted, {
      run(runtime, { cast }: TriggerPointInput<typeof troubadourDodgeCompleted>) {
        const flute = runtime.helpers.skillsById.get(ID.FLUSTERING_FLUTE);
        if (!flute || !runtime.cooldownController.hasCooldown(flute.id)) return;
        runtime.cooldownController.reduceSkillRecharge(
          flute,
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.MAYHEM), 'rechargeReduction'),
          runtime.time
        );
        runtime.effects.emit({
          kind: 'announcement',
          log: true,
          attribution: { source: 'Trait', sourceId: TRAIT.MAYHEM, actorType: 'effect' },
          announcement: { type: 'trait', name: 'Mayhem', at: runtime.time, sourceSkill: cast.skill.name, detail: '' }
        });
      }
    }),
    onTriggerPoint(troubadourInstrumentConditions, {
      run: (runtime, input: TriggerPointInput<typeof troubadourInstrumentConditions>) =>
        applyMayhemInstrument(
          runtime,
          input.skill,
          input.data,
          input.damageAt,
          input.source,
          input.actorType,
          input.delivery
        )
    })
  ],
  id: TRAIT.MAYHEM,
  name: 'Mayhem',
  balance: {
    rechargeReduction: 1.5,
    effects: [{ name: 'Torment', type: 'condition', condition: 'Torment', duration: 5, stacks: 4 }]
  }
});

/** Raconteur owns its existing profile and ordered performance consequences. */
export const raconteur = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(troubadourTaleResolved, {
      run: (runtime, input: TriggerPointInput<typeof troubadourTaleResolved>) =>
        triggerRaconteur(runtime, input.skill, input.at)
    })
  ],
  id: TRAIT.RACONTEUR,
  name: 'Raconteur',
  balance: {
    effects: [{ name: 'protection', type: 'boon', boon: 'protection', duration: 3, stacks: 1 }]
  }
});

/** Shredding owns its existing profile and ordered performance consequences. */
export const shredding = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(troubadourInstrumentStrike, {
      run: (runtime, input: TriggerPointInput<typeof troubadourInstrumentStrike>) => emitShredding(runtime, input)
    })
  ],
  id: TRAIT.SHREDDING,
  name: 'Shredding',
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
          ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SHREDDING), 'conditionDamageIncrease')
          : balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SHREDDING), 'damageIncrease'),
      when: (context) => hasLute(context) && !illusionSource(context)
    }
  ]
});

/** Life of the Party owns its existing profile and ordered performance consequences. */
export const lifeOfTheParty = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(troubadourCrescendoResolved, {
      run: (runtime, input: TriggerPointInput<typeof troubadourCrescendoResolved>) =>
        grantCrescendoPartyBoons(runtime, input)
    }),
    onTriggerPoint(troubadourInstrumentControl, {
      run: (runtime, input: TriggerPointInput<typeof troubadourInstrumentControl>) =>
        applyLuteLifeOfTheParty(runtime, input.skill, input.data, input.damageAt, input.delivery)
    })
  ],
  id: TRAIT.LIFE_OF_THE_PARTY,
  name: 'Life of the Party',
  balance: {
    effects: [
      {
        type: 'boon',
        name: 'Lute Quickness',
        boon: 'quickness',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        name: 'Lute Might',
        boon: 'might',
        duration: 8,
        stacks: 5
      },
      {
        type: 'boon',
        name: 'Crescendo Quickness',
        boon: 'quickness',
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        name: 'Crescendo Might',
        boon: 'might',
        duration: 15,
        stacks: 8
      },
      {
        type: 'boon',
        name: 'Crescendo Fury',
        boon: 'fury',
        duration: 8,
        stacks: 1
      }
    ]
  }
});

/** Fortissimo owns its existing profile and ordered performance consequences. */
export const fortissimo = defineTrait<MesmerSkill>({
  // Scaling follows all additive grants, including boons and accepted buffs.
  attributes: (context) => ({
    transforms: [
      {
        kind: 'scale',
        factor:
          1 +
          activeInstrumentCount(context) *
            balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FORTISSIMO), 'attributeConversion')
      }
    ]
  }),
  triggers: [
    onTriggerPoint(troubadourCrescendoResolved, {
      run: (runtime, input: TriggerPointInput<typeof troubadourCrescendoResolved>) =>
        queueFortissimoNotes(runtime, input)
    })
  ],
  id: TRAIT.FORTISSIMO,
  name: 'Fortissimo',
  balance: {
    attributeConversion: 0.04,
    maximumStacks: 5,
    pulseInterval: 1,
    resourceGain: 1
  }
});

/** Call and Response owns its existing profile and ordered performance consequences. */
export const callAndResponse = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(troubadourInstrumentCommitted, {
      run: (runtime, input: TriggerPointInput<typeof troubadourInstrumentCommitted>) =>
        applyCallAndResponse(runtime, input.skill, input.data, input.at, input.spent, input.delivery)
    })
  ],
  id: TRAIT.CALL_AND_RESPONSE,
  name: 'Call and Response',
  balance: {
    threshold: 3,
    initialDelay: 1.5
  }
});

/** Symphonic Resonance owns its existing profile and ordered performance consequences. */
export const symphonicResonance = defineTrait<MesmerSkill>({
  id: TRAIT.SYMPHONIC_RESONANCE,
  name: 'Symphonic Resonance',
  balance: { enduranceRegenerationMultiplier: 1.25 }
});

/** Altered Chord owns its existing profile and ordered performance consequences. */
export const alteredChord = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(troubadourCrescendoResolved, {
      run: (runtime, input: TriggerPointInput<typeof troubadourCrescendoResolved>) =>
        resolveAlteredChord(runtime, input)
    }),
    onTriggerPoint(troubadourInstrumentAnnounced, {
      run: (runtime, input: TriggerPointInput<typeof troubadourInstrumentAnnounced>) =>
        reduceAlteredChordRecharge(runtime, input.spent, input.at)
    })
  ],
  id: TRAIT.ALTERED_CHORD,
  name: 'Altered Chord',
  balance: {
    damageIncrease: 0.25,
    rechargeReduction: 2,
    durationMultiplier: 10,
    effects: [{ name: 'Confusion', type: 'condition', condition: 'Confusion', duration: 8, stacks: 5 }]
  },
  modifierRules: [
    {
      id: 'mesmer.altered-chord',
      requiresSelection: false,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ALTERED_CHORD), 'damageIncrease'),
      when: (context) => buffActive(context, 'altered-chord') && !illusionSource(context)
    }
  ]
});

/** Register the control reaction and queued heal wave without changing their separate eligibility. */
export const syncopate = defineTrait<MesmerSkill>({
  triggers: [
    { on: 'control.resolved', run: observeSyncopateEvent },
    onTriggerPoint(troubadourInstrumentControl, {
      run: (runtime, input: TriggerPointInput<typeof troubadourInstrumentControl>) =>
        scheduleSyncopateDrumWave(
          runtime,
          input.skill,
          input.data,
          input.damageAt,
          input.source,
          input.actorType,
          input.delivery
        )
    })
  ],
  id: TRAIT.SYNCOPATE,
  name: 'Syncopate',
  balance: {
    initialDelay: 3,
    effects: [
      { type: 'strike', name: 'Immediate wave', coefficient: 0.75, hits: 1 },
      { type: 'strike', name: 'Delayed wave', coefficient: 1, hits: 1 },
      { type: 'control', name: 'Delayed daze', controlKind: 'daze' }
    ]
  },
  lifetime: {
    tasks: { 'mesmer.syncopate': triggerMethodOfMadnessSyncopate }
  }
});

/** Collect trait owners while instruments, notes, afterimage packets, and endurance remain shared mechanics. */
export const troubadourTraits = [
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
  const harmonizeProfile = requireBalanceProfileFromContext(context, TRAIT.HARMONIZE);
  createMesmerIllusionRewards(context).queueResources(
    context.time,
    balanceProfileNumber(harmonizeProfile, 'resourceGain'),
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

/** Keep mayhem at the existing instrument execution boundary. */
function applyMayhemInstrument(
  context: MesmerRuntime,
  skill: MesmerSkill,
  data: MesmerInstrument,
  damageAt: number,
  source: string,
  actorType: 'player' | 'summon',
  delivery: EffectDelivery = {}
): void {
  if (data.instrument === 'Flute') {
    const condition = mesmerConditionFromProfile(context, TRAIT.MAYHEM, 'Torment');
    if (condition)
      buildMesmerConditions(context, skill.name, damageAt, condition, source, 'Mayhem — Torment', {
        source,
        sourceId: TRAIT.MAYHEM,
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
      attribution: { actorType: 'player', audience: { recipients: 'party', maximumRecipients: 5 } },
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
  if (spent === balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CALL_AND_RESPONSE), 'threshold')) {
    const callAndResponseProfile = requireBalanceProfileFromContext(context, TRAIT.CALL_AND_RESPONSE);
    const afterimageAt = at + balanceProfileNumber(callAndResponseProfile, 'initialDelay');
    instrumentAttack(context, skill, data, afterimageAt, 'Afterimage', 'summon', delivery);
    context.effects.emit({
      ...delivery,
      kind: 'announcement',
      log: true,
      attribution: { source: 'Trait', sourceId: TRAIT.CALL_AND_RESPONSE, actorType: 'effect' },
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
      const alteredChordProfile = requireBalanceProfileFromContext(context, TRAIT.ALTERED_CHORD);
      context.cooldownController.reduceSkillRecharge(
        crescendo,
        balanceProfileNumber(alteredChordProfile, 'rechargeReduction'),
        at
      );
    }
  }
}

/** Raconteur follows the Tale's own boons and eligible note grant. */
function triggerRaconteur(context: MesmerRuntime, skill: MesmerSkill, at: number): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.RACONTEUR);
  if (!requireEffect(profile, 'boon', 'protection')) return;
  const proc = context.effects.emit({
    receipt: true,
    kind: 'announcement',
    log: true,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.RACONTEUR,
      actorType: 'effect',
      skillId: TRAIT.RACONTEUR,
      skillName: profile.name
    },
    announcement: { type: 'trait', name: profile.name, at, sourceSkill: skill.name, detail: '' }
  });
  emitTraitProfile(context, TRAIT.RACONTEUR, TRAIT.RACONTEUR, proc, {
    at,
    effect: { type: 'boon', name: 'protection' },
    skillId: TRAIT.RACONTEUR,
    skillName: profile.name,
    attribution: { actorType: 'player', audience: { recipients: 'party', maximumRecipients: 5 } },
    transform: (event) => ({ ...event, sourceSkill: skill.name })
  });
}

/** Resolves Syncopate from accepted Troubadour control events. */
function observeSyncopateEvent(context: MesmerRuntime, event: SimulationEvent): void {
  if (event.type !== 'control') return;

  if (!hasTrait(context, TRAIT.SYNCOPATE)) return;
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
      actorType: 'player',
      // A proc caused by a surviving delayed disable inherits that packet's interruption protection.
      persistsAfterInterrupt: event.persistsAfterInterrupt === true,
      weapon: 'utility',
      weaponStrengthProfileId: 'nonweapon.unequipped'
    },
    { source: 'Trait', sourceId: TRAIT.SYNCOPATE, actorType: 'player' }
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
    attribution: { source: 'Trait', sourceId: TRAIT.SYNCOPATE, actorType: 'effect' },
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
    attribution: { source: 'Trait', sourceId: TRAIT.SYNCOPATE, actorType: 'effect' },
    announcement: { type: 'trait', name: 'Syncopate', at: context.time, sourceSkill: 'Lesser Chaos Storm', detail: '' }
  });
}

/** Adds the delayed wave and its daze to player and afterimage Drum impacts when Syncopate is selected. */
function scheduleSyncopateDrumWave(
  context: MesmerRuntime,
  skill: MesmerSkill,
  instrument: MesmerInstrument,
  damageAt: number,
  source: string,
  actorType: 'player' | 'summon',
  delivery: EffectDelivery = {}
): void {
  if (instrument.instrument !== 'Drum') return;
  const syncopateProfile = requireBalanceProfileFromContext(context, TRAIT.SYNCOPATE);
  const delayedAt = damageAt + balanceProfileNumber(syncopateProfile, 'initialDelay');
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
        actorType,
        // The committed Drum owns this delayed projectile even after its animation is interrupted.
        persistsAfterInterrupt: true,
        weaponStrengthProfileId: 'nonweapon.unequipped'
      },
      {
        source: 'Trait',
        sourceId: TRAIT.SYNCOPATE,
        skillId: skill.id,
        actorType,
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
      source,
      sourceId: TRAIT.SYNCOPATE,
      actorType
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
    attribution: { source: 'Trait', sourceId: TRAIT.SYNCOPATE, actorType: 'effect' },
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
      attribution: { actorType: 'player', audience: { recipients: 'party', maximumRecipients: 5 } },
      transform: (event) => ({ ...event, sourceSkill: skill.name })
    });
}

/** altered chord consumes the captured Crescendo boundary after its strike. */
function resolveAlteredChord(
  context: MesmerRuntime,
  { skill, damageAt, delivery, lastInstrument }: TriggerPointInput<typeof troubadourCrescendoResolved>
): void {
  {
    if (lastInstrument === 'Lute') {
      const alteredChordProfile = requireBalanceProfileFromContext(context, TRAIT.ALTERED_CHORD);
      // The activation owns its status row without changing the status's post-strike priority.
      const proc = context.effects.emit({
        receipt: true,
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
      const condition = mesmerConditionFromProfile(context, TRAIT.ALTERED_CHORD, 'Confusion');
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
          attribution: { source: 'Trait', sourceId: TRAIT.ALTERED_CHORD, actorType: 'effect' },
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
          actorType: 'player'
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
        attribution: { source: 'Trait', sourceId: TRAIT.ALTERED_CHORD, actorType: 'effect' },
        announcement: { type: 'trait', name: 'Altered Chord', at: damageAt, sourceSkill: skill.name, detail: 'Drum' }
      });
    }
  }
}

/** fortissimo consumes the captured Crescendo boundary after its strike. */
function queueFortissimoNotes(
  context: MesmerRuntime,
  { at }: TriggerPointInput<typeof troubadourCrescendoResolved>
): void {
  {
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
}

/** Shredding owns its extra note while native afterimage packets remain with the instrument. */
function emitShredding(
  context: MesmerRuntime,
  { skill, data, damageAt, source, actorType, delivery }: TriggerPointInput<typeof troubadourInstrumentStrike>
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
      event: { ...packet, name: 'Shredding', procType: 'trait' },
      owner: mesmerPacketOwner(packet),
      priority: Number(packet.priority ?? 0)
    });
  });
}
