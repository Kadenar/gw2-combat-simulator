import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { illusionSource, timedStacks } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import { buildMesmerConditions, mesmerPacketOwner } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import { mesmerShatterCompleted } from '#gw2/professions/mesmer/core/mechanics/profession-actions.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerEventExtra, MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { createMesmerIllusionRewards } from '#gw2/professions/mesmer/family-resources.js';
import { executeMirageCloneAmbushPackets } from '#gw2/professions/mesmer/specializations/mirage/mechanics/cloak-and-ambushes.js';
import { createMirageMechanics } from '#gw2/professions/mesmer/specializations/mirage/mechanics/runtime.js';
import {
  mirageAmbushAccepted,
  mirageCastCommitted,
  mirageCloakGranted,
  mirageCloneAmbushRequested,
  mirageInitialized,
  mirageResourcesGained
} from '#gw2/professions/mesmer/specializations/mirage/mechanics/trait-boundaries.js';
import { mirageState } from '#gw2/professions/mesmer/specializations/mirage/state.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Nomad's Endurance owns tuning consumed at the ordered cloak, ambush, or shatter boundary. */
export const nomadsEndurance = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerShatterCompleted, {
      run: (runtime, input: TriggerPointInput<typeof mesmerShatterCompleted>) => grantNomadsEndurance(runtime, input)
    })
  ],
  id: TRAIT.NOMADS_ENDURANCE,
  name: "Nomad's Endurance",
  balance: {
    effects: [{ name: 'vigor', type: 'boon', boon: 'vigor', duration: 3, stacks: 1 }]
  },
  modifierRules: [
    {
      id: 'mesmer.nomads-endurance',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      parameters: {
        strikeBonus: 0.1,
        conditionBonus: 0.05
      },
      amount: (context, target, parameters) => {
        // Illusion strikes do not inherit personal strike bonuses, while their conditions remain owner-resolved.
        if (target === MODIFIER_TARGET.STRIKE_DAMAGE && illusionSource(context)) return 0;
        return target === MODIFIER_TARGET.STRIKE_DAMAGE ? parameters.strikeBonus : parameters.conditionBonus;
      },
      when: (context) => Boolean(context.timeline?.vigorActiveAt(context.time))
    }
  ]
});

/** Renewing Oasis owns tuning consumed at the ordered cloak, ambush, or shatter boundary. */
export const renewingOasis = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mirageCloakGranted, {
      run: (runtime, input: TriggerPointInput<typeof mirageCloakGranted>) => renewingOasisCloak(runtime, input)
    })
  ],
  id: TRAIT.RENEWING_OASIS,
  name: 'Renewing Oasis',
  balance: {
    effects: [{ name: 'regeneration', type: 'boon', boon: 'regeneration', duration: 4, stacks: 1 }]
  }
});

/** Riddle of Sand owns tuning consumed at the ordered cloak, ambush, or shatter boundary. */
export const riddleOfSand = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerShatterCompleted, {
      run: (runtime, input: TriggerPointInput<typeof mesmerShatterCompleted>) => primeRiddleAfterShatter(runtime, input)
    }),
    onTriggerPoint(mirageInitialized, {
      requiresSelection: false,
      run: (runtime, input: TriggerPointInput<typeof mirageInitialized>) => initializeRiddle(runtime, input)
    }),
    onTriggerPoint(mirageAmbushAccepted, {
      run: (runtime, input: TriggerPointInput<typeof mirageAmbushAccepted>) => riddleAmbush(runtime, input)
    })
  ],
  id: TRAIT.RIDDLE_OF_SAND,
  name: 'Riddle of Sand',
  balance: {
    effects: [{ name: 'Confusion', type: 'condition', condition: 'Confusion', duration: 4, stacks: 2 }]
  }
});

/** Desert Distortion owns tuning consumed at the ordered cloak, ambush, or shatter boundary. */
export const desertDistortion = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerShatterCompleted, {
      run: (runtime, input: TriggerPointInput<typeof mesmerShatterCompleted>) =>
        createDesertDistortionMirrors(runtime, input)
    })
  ],
  id: TRAIT.DESERT_DISTORTION,
  name: 'Desert Distortion',
  balance: {
    resourceGain: 1
  }
});

/** Mirage Mantle owns tuning consumed at the ordered cloak, ambush, or shatter boundary. */
export const mirageMantle = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mirageAmbushAccepted, {
      run: (runtime, input: TriggerPointInput<typeof mirageAmbushAccepted>) => mantleAmbush(runtime, input)
    })
  ],
  id: TRAIT.MIRAGE_MANTLE,
  name: 'Mirage Mantle',
  balance: {
    effects: [{ name: 'alacrity', type: 'boon', boon: 'alacrity', duration: 4, stacks: 1 }]
  }
});

/** Phantom Pain owns tuning consumed at the ordered cloak, ambush, or shatter boundary. */
export const phantomPain = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerShatterCompleted, {
      run: (runtime, input: TriggerPointInput<typeof mesmerShatterCompleted>) => grantPhantomPain(runtime, input)
    })
  ],
  id: TRAIT.PHANTOM_PAIN,
  name: 'Phantom Pain',
  balance: {
    maximumStacks: 4,
    durationMultiplier: 10
  },
  modifierRules: [
    {
      id: 'mesmer.phantom-pain',
      requiresSelection: false,
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      parameters: {
        duration: 10,
        maximumStacks: 4,
        strikePerStack: 0.0625,
        conditionPerStack: 0.05
      },
      amount: (context, target, parameters) => {
        // Phantom Pain joins other additive outgoing-damage bonuses; phantasm
        // conditions use owner modifiers, but phantasm strikes use summon ownership.
        if (target === MODIFIER_TARGET.STRIKE_DAMAGE && illusionSource(context)) return 0;
        return (
          timedStacks(context, 'phantom-pain', parameters.duration, parameters.maximumStacks) *
          (target === MODIFIER_TARGET.CONDITION_DAMAGE ? parameters.conditionPerStack : parameters.strikePerStack)
        );
      }
    }
  ]
});

/** Dune Cloak owns tuning consumed at the ordered cloak, ambush, or shatter boundary. */
export const duneCloak = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mesmerShatterCompleted, {
      run: (runtime, input: TriggerPointInput<typeof mesmerShatterCompleted>) => grantDuneCloak(runtime, input)
    }),
    onTriggerPoint(mirageCloakGranted, {
      run: (runtime, input: TriggerPointInput<typeof mirageCloakGranted>) =>
        reduceDuneCloakShatters(runtime, input.at, input.source, input.delivery)
    })
  ],
  id: TRAIT.DUNE_CLOAK,
  name: 'Dune Cloak',
  balance: {
    threshold: 3,
    rechargeReduction: 1,
    durationMultiplier: 1
  }
});

/** Clone ambush execution stays mechanical; its selection, lifetime, and gain reactions belong here. */
export const infiniteHorizon = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mirageResourcesGained, {
      run: (runtime, input: TriggerPointInput<typeof mirageResourcesGained>) => infiniteHorizonGain(runtime, input)
    }),
    onTriggerPoint(mirageCloneAmbushRequested, {
      run: (runtime, input: TriggerPointInput<typeof mirageCloneAmbushRequested>) =>
        infiniteHorizonAmbush(runtime, input)
    }),
    onTriggerPoint(mirageCloakGranted, {
      run: (runtime, input: TriggerPointInput<typeof mirageCloakGranted>) => infiniteHorizonCloak(runtime, input)
    })
  ],
  id: TRAIT.INFINITE_HORIZON,
  name: 'Infinite Horizon'
});

/** Self-Deception owns tuning consumed at the ordered cloak, ambush, or shatter boundary. */
export const selfDeception = defineTrait<MesmerSkill>({
  triggers: [
    onTriggerPoint(mirageCastCommitted, {
      run: (runtime, input: TriggerPointInput<typeof mirageCastCommitted>) => selfDeceptionCommitted(runtime, input)
    })
  ],
  id: TRAIT.SELF_DECEPTION,
  name: 'Self-Deception',
  balance: {
    resourceGain: 1
  }
});

/** Collect Mirage traits while retaining shared cloak, mirror, endurance, and ambush state. */
export const mirageTraits = [
  nomadsEndurance,
  selfDeception,
  renewingOasis,
  riddleOfSand,
  desertDistortion,
  mirageMantle,
  phantomPain,
  duneCloak,
  infiniteHorizon
];

/** Preserve renewing oasis at its accepted mechanic boundary. */
function renewingOasisCloak(
  state: MesmerRuntime,
  { at, source, delivery }: TriggerPointInput<typeof mirageCloakGranted>
): void {
  const profile = requireBalanceProfileFromContext(state, TRAIT.RENEWING_OASIS);
  if (!requireEffect(profile, 'boon', 'regeneration')) return;
  const proc = state.effects.emit({
    receipt: true,
    ...delivery,
    kind: 'announcement',
    log: true,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.RENEWING_OASIS,
      actorType: 'effect',
      skillId: TRAIT.RENEWING_OASIS,
      skillName: profile.name
    },
    announcement: { type: 'trait', name: profile.name, at: at, sourceSkill: source, detail: '' }
  });
  // Shared profile emission preserves the causal announcement and the authored boon payload.
  emitTraitProfile(state, TRAIT.RENEWING_OASIS, TRAIT.RENEWING_OASIS, proc, {
    ...delivery,
    at: at,
    effect: { type: 'boon', name: 'regeneration' },
    skillId: TRAIT.RENEWING_OASIS,
    skillName: profile.name,
    attribution: { actorType: 'player' },
    transform: (event) => ({ ...event, sourceSkill: source })
  });
}

/** Cloak rewards reduce the supported shatters through the shared cooldown controller. */
function reduceDuneCloakShatters(
  state: MesmerRuntime,
  at: number,
  source: string,
  delivery: EffectDelivery = {}
): void {
  for (const id of [ID.MIND_WRACK, ID.CRY_OF_FRUSTRATION]) {
    const shatter = state.helpers.skillsById.get(id);
    const readyAt = shatter ? state.cooldownController.readyAt(shatter.id) : null;
    if (shatter && readyAt != null) {
      const duneCloakProfile = requireBalanceProfileFromContext(state, TRAIT.DUNE_CLOAK);
      state.cooldownController.reduceSkillRecharge(
        shatter,
        balanceProfileNumber(duneCloakProfile, 'rechargeReduction'),
        at
      );
    }
  }

  state.effects.emit({
    ...delivery,
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.DUNE_CLOAK, actorType: 'effect' },
    announcement: {
      type: 'trait',
      name: 'Dune Cloak',
      at: at,
      sourceSkill: source,
      detail: 'Mind Wrack and Cry of Frustration recharge reduced by 1s'
    }
  });
}

/** Preserve infinite horizon at its accepted mechanic boundary. */
function infiniteHorizonCloak(
  state: MesmerRuntime,
  { at, duration, delivery }: TriggerPointInput<typeof mirageCloakGranted>
): void {
  {
    mirageState.from(state).cloneAmbushUntil = canonicalTime(at + duration);
    createMirageMechanics(state).executeCloneAmbushes(at, professionCoreState(state).clones, delivery);
  }
}

/** Preserve riddle of sand at its accepted mechanic boundary. */
function riddleAmbush(
  state: MesmerRuntime,
  { ambush, impactAt, delivery }: TriggerPointInput<typeof mirageAmbushAccepted>
): void {
  const riddleOfSand = mirageState.from(state).riddleOfSandReady
    ? requireEffect(requireBalanceProfileFromContext(state, TRAIT.RIDDLE_OF_SAND), 'condition', 'Confusion')
    : undefined;
  if (riddleOfSand) {
    buildMesmerConditions(state, ambush.name, impactAt, riddleOfSand, 'Player', `${ambush.name} — Riddle of Sand`, {
      skillId: ambush.id
    }).forEach((packet) => {
      state.effects.emit({
        ...delivery,
        kind: 'packet',
        event: packet,
        owner: mesmerPacketOwner(packet),
        priority: Number(packet.priority ?? 0)
      });
    });
    state.effects.emit({
      ...delivery,
      kind: 'announcement',
      log: true,
      attribution: { source: 'Trait', sourceId: TRAIT.RIDDLE_OF_SAND, actorType: 'effect' },
      announcement: {
        type: 'trait',
        name: 'Riddle of Sand',
        at: impactAt,
        sourceSkill: ambush.name,
        detail: '2 confusion'
      }
    });
    mirageState.from(state).riddleOfSandReady = false;
  }
}

/** Preserve mirage mantle at its accepted mechanic boundary. */
function mantleAmbush(
  state: MesmerRuntime,
  { ambush, impactAt, delivery }: TriggerPointInput<typeof mirageAmbushAccepted>
): void {
  const profile = requireBalanceProfileFromContext(state, TRAIT.MIRAGE_MANTLE);
  if (!requireEffect(profile, 'boon', 'alacrity')) return;
  const proc = state.effects.emit({
    receipt: true,
    ...delivery,
    kind: 'announcement',
    log: true,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.MIRAGE_MANTLE,
      actorType: 'effect',
      skillId: TRAIT.MIRAGE_MANTLE,
      skillName: profile.name
    },
    announcement: { type: 'trait', name: profile.name, at: impactAt, sourceSkill: ambush.name, detail: '' }
  });
  // Shared profile emission preserves the causal announcement and the authored boon payload.
  emitTraitProfile(state, TRAIT.MIRAGE_MANTLE, TRAIT.MIRAGE_MANTLE, proc, {
    ...delivery,
    at: impactAt,
    effect: { type: 'boon', name: 'alacrity' },
    skillId: TRAIT.MIRAGE_MANTLE,
    skillName: profile.name,
    attribution: { actorType: 'player', audience: { recipients: 'party', maximumRecipients: 5 } },
    transform: (event) => ({ ...event, sourceSkill: ambush.name })
  });
}

/** Preserve infinite horizon at its accepted mechanic boundary. */
function infiniteHorizonAmbush(
  state: MesmerRuntime,
  input: TriggerPointInput<typeof mirageCloneAmbushRequested>
): void {
  const { at, weapon, delivery, clones } = input;
  const count = clones.length;
  if (!count) return;
  state.effects.emit({
    ...delivery,
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.INFINITE_HORIZON, actorType: 'effect' },
    announcement: {
      type: 'trait',
      name: 'Infinite Horizon',
      at: at,
      sourceSkill: weapon,
      detail: `${count} clone${count === 1 ? '' : 's'}`
    }
  });
  executeMirageCloneAmbushPackets(state, input);
}

/** Preserve infinite horizon at its accepted mechanic boundary. */
function infiniteHorizonGain(state: MesmerRuntime, { gain }: TriggerPointInput<typeof mirageResourcesGained>): void {
  const { at, cause, createdClones } = gain;
  const traitId = Number(cause.traitId);
  const triggersCloneAmbush =
    traitId === TRAIT.DECEPTIVE_EVASION ||
    (traitId === TRAIT.SELF_DECEPTION && cause.sourceSkillId === ID.ILLUSIONARY_AMBUSH);
  // Preserve the inclusive clone-gain deadline, but never treat the zero sentinel as an active cloak.
  const cloneAmbushUntil = mirageState.from(state).cloneAmbushUntil;
  if (triggersCloneAmbush && cloneAmbushUntil > 0 && at <= cloneAmbushUntil) {
    createMirageMechanics(state).executeCloneAmbushes(at, createdClones);
  }
}

/** Preserve riddle of sand at its accepted mechanic boundary. */
function initializeRiddle(state: MesmerRuntime, _input: TriggerPointInput<typeof mirageInitialized>): void {
  // Riddle of Sand starts armed only for the active Mirage runtime and is re-armed by Mirage shatters.
  mirageState.from(state).riddleOfSandReady =
    hasTrait(state, TRAIT.RIDDLE_OF_SAND) &&
    Boolean(requireEffect(requireBalanceProfileFromContext(state, TRAIT.RIDDLE_OF_SAND), 'condition', 'Confusion'));
}

/** Preserve self deception at its accepted mechanic boundary. */
function selfDeceptionCommitted(
  state: MesmerRuntime,
  { cast, at, currentResource, weapon }: TriggerPointInput<typeof mirageCastCommitted>
): void {
  const skill = cast.skill;
  if (skill.categories?.includes('Deception') && currentResource > 0) {
    const selfDeceptionProfile = requireBalanceProfileFromContext(state, TRAIT.SELF_DECEPTION);
    createMesmerIllusionRewards(state).queueResources(
      at,
      balanceProfileNumber(selfDeceptionProfile, 'resourceGain'),
      weapon,
      `Self-Deception: ${skill.name}`,
      {
        traitId: TRAIT.SELF_DECEPTION,
        traitName: 'Self-Deception',
        sourceSkillId: skill.id
      }
    );
  }
}

/** Preserve riddle of sand at its accepted mechanic boundary. */
function primeRiddleAfterShatter(
  state: MesmerRuntime,
  { resolution }: TriggerPointInput<typeof mesmerShatterCompleted>
): void {
  if (state.config.specialization !== 'Mirage') return;
  const { skill, at, delivery } = resolution;

  if (requireEffect(requireBalanceProfileFromContext(state, TRAIT.RIDDLE_OF_SAND), 'condition', 'Confusion')) {
    mirageState.from(state).riddleOfSandReady = true;
    state.effects.emit({
      ...delivery,
      kind: 'announcement',
      log: true,
      attribution: { source: 'Trait', sourceId: TRAIT.RIDDLE_OF_SAND, actorType: 'effect' },
      announcement: { type: 'trait', name: 'Riddle of Sand', at: at, sourceSkill: skill.name, detail: 'ambush primed' }
    });
  }
}

/** Preserve nomads endurance at its accepted mechanic boundary. */
function grantNomadsEndurance(
  state: MesmerRuntime,
  { resolution }: TriggerPointInput<typeof mesmerShatterCompleted>
): void {
  if (state.config.specialization !== 'Mirage') return;
  const { skill, at, delivery } = resolution;
  const profile = requireBalanceProfileFromContext(state, TRAIT.NOMADS_ENDURANCE);
  if (!requireEffect(profile, 'boon', 'vigor')) return;
  const proc = state.effects.emit({
    receipt: true,
    ...delivery,
    kind: 'announcement',
    log: true,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.NOMADS_ENDURANCE,
      actorType: 'effect',
      skillId: TRAIT.NOMADS_ENDURANCE,
      skillName: profile.name
    },
    announcement: { type: 'trait', name: profile.name, at: at, sourceSkill: skill.name, detail: '' }
  });
  // Shared profile emission preserves the causal announcement and the authored boon payload.
  emitTraitProfile(state, TRAIT.NOMADS_ENDURANCE, TRAIT.NOMADS_ENDURANCE, proc, {
    ...delivery,
    at: at,
    effect: { type: 'boon', name: 'vigor' },
    skillId: TRAIT.NOMADS_ENDURANCE,
    skillName: profile.name,
    attribution: { actorType: 'player' },
    transform: (event) => ({ ...event, sourceSkill: skill.name })
  });
}

/** Preserve phantom pain at its accepted mechanic boundary. */
function grantPhantomPain(
  state: MesmerRuntime,
  { resolution }: TriggerPointInput<typeof mesmerShatterCompleted>
): void {
  if (state.config.specialization !== 'Mirage') return;
  const { skill, at, spent, delivery } = resolution;

  {
    const phantomPainProfile = requireBalanceProfileFromContext(state, TRAIT.PHANTOM_PAIN);
    {
      const grants: readonly MesmerEventExtra[] = [
        {
          // Phantom Pain starts after the same-time shatter packets resolve.
          priority: 5,
          kind: 'phantom-pain',
          stacks: Math.min(balanceProfileNumber(phantomPainProfile, 'maximumStacks'), spent + 1),
          duration: balanceProfileNumber(phantomPainProfile, 'durationMultiplier')
        }
      ];
      const traitProfile = requireBalanceProfileFromContext(state, TRAIT.PHANTOM_PAIN);
      const traitSource = {
        source: 'Trait',
        sourceId: TRAIT.PHANTOM_PAIN,
        actorType: 'player' as const,
        skillId: TRAIT.PHANTOM_PAIN,
        skillName: traitProfile.name
      };
      {
        const proc = state.effects.emit({
          receipt: true,
          ...delivery,
          kind: 'announcement',
          log: true,
          attribution: { ...traitSource, actorType: 'effect' },
          announcement: { type: 'trait', name: traitProfile.name, at: at, sourceSkill: skill.name, detail: '' }
        });
        for (const grant of grants)
          state.effects.emit({
            ...delivery,
            kind: 'packet',
            cause: proc,
            event: { ...grant, ...traitSource, type: 'buff', at: at, name: traitProfile.name, sourceSkill: skill.name }
          });
      }
    }
  }
}

/** Preserve desert distortion at its accepted mechanic boundary. */
function createDesertDistortionMirrors(
  state: MesmerRuntime,
  { resolution }: TriggerPointInput<typeof mesmerShatterCompleted>
): void {
  if (state.config.specialization !== 'Mirage') return;
  const { skill, at, spent, delivery } = resolution;
  const { grantAmbushWindow, createMirrors } = createMirageMechanics(state);

  if (skill.id === ID.DISTORTION) {
    grantAmbushWindow(at, 'Desert Distortion', undefined, delivery);
    const desertDistortionProfile = requireBalanceProfileFromContext(state, TRAIT.DESERT_DISTORTION);
    createMirrors(at, spent * balanceProfileNumber(desertDistortionProfile, 'resourceGain'));
    state.effects.emit({
      ...delivery,
      kind: 'announcement',
      log: true,
      attribution: { source: 'Trait', sourceId: TRAIT.DESERT_DISTORTION, actorType: 'effect' },
      announcement: {
        type: 'trait',
        name: 'Desert Distortion',
        at: at,
        sourceSkill: skill.name,
        detail: `${spent} Mirage Mirror${spent === 1 ? '' : 's'} created`
      }
    });
  }
}

/** Preserve dune cloak at its accepted mechanic boundary. */
function grantDuneCloak(state: MesmerRuntime, { resolution }: TriggerPointInput<typeof mesmerShatterCompleted>): void {
  if (state.config.specialization !== 'Mirage') return;
  const { at, spent, delivery } = resolution;
  const { grantMirageCloak } = createMirageMechanics(state);

  if (spent >= balanceProfileNumber(requireBalanceProfileFromContext(state, TRAIT.DUNE_CLOAK), 'threshold')) {
    const duneCloakProfile = requireBalanceProfileFromContext(state, TRAIT.DUNE_CLOAK);
    grantMirageCloak(
      at,
      'Dune Cloak',
      {
        duration: balanceProfileNumber(duneCloakProfile, 'durationMultiplier')
      },
      delivery
    );
  }
}
