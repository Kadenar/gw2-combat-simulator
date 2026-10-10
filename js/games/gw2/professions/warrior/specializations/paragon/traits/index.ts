import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import {
  chantActivated,
  motivationSpent,
  paragonCastCompleted,
  paragonCombatStarted
} from '#gw2/professions/warrior/specializations/paragon/hooks.js';
import { startRefrain } from '#gw2/professions/warrior/specializations/paragon/mechanics/refrains.js';
import { paragonState, type ParagonState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Owns this trait's tuning and selected contributions. */
export const inspiringImplements = defineTrait({
  triggers: [
    onTriggerPoint(paragonCastCompleted, {
      run: (runtime, input: TriggerPointInput<typeof paragonCastCompleted>) =>
        applyInspiringImplements(runtime, input.cast)
    })
  ],
  id: TRAIT.INSPIRING_IMPLEMENTS,
  name: 'Inspiring Implements',
  balance: {
    attributeBonus: 180,
    internalCooldown: 4,
    resourceGain: 5,
    minimumStacks: 2
  },
  attributes(context) {
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Concentration',
          amount: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.INSPIRING_IMPLEMENTS),
            'attributeBonus'
          ),
          feedsConversions: false,
          enabled: true
        }
      ]
    };
  }
});

/** Owns this trait's tuning and selected contributions. */
export const invigoratingTempo = defineTrait({
  triggers: [
    onTriggerPoint(motivationSpent, {
      run: (runtime, input: TriggerPointInput<typeof motivationSpent>) => applyInvigoratingTempo(runtime, input.spent)
    })
  ],
  id: TRAIT.INVIGORATING_TEMPO,
  name: 'Invigorating Tempo',
  balance: {
    resourceGain: 1
  }
});

/** Owns this trait's tuning and selected contributions. */
export const enduringRefrain = defineTrait({
  id: TRAIT.ENDURING_REFRAIN,
  name: 'Enduring Refrain',
  balance: {
    stackMultiplier: 2,
    resourceGain: 1
  }
});

/** Owns this trait's tuning and selected contributions. */
export const feverishPulse = defineTrait({
  id: TRAIT.FEVERISH_PULSE,
  name: 'Feverish Pulse',
  balance: {
    rechargeReduction: 2,
    effects: [{ name: 'alacrity', type: 'boon', boon: 'alacrity', stacks: 1, duration: 6 }]
  },
  triggers: [
    onTriggerPoint(chantActivated, {
      run: (runtime, input: TriggerPointInput<typeof chantActivated>) => applyFeverishPulse(runtime, input.cast)
    }),
    {
      order: 0,

      emit: TRAIT.FEVERISH_PULSE,
      on: 'castCommit',
      when: (_runtime, cast) => Boolean(cast.skill.categories?.includes('Chant')),
      effects: (effect) => effect.type === 'boon' && effect.boon === 'alacrity',
      attribution: (_runtime, cast) => ({
        source: 'Paragon',
        sourceId: cast.skill.id,
        actorType: 'player',
        name: `${cast.skill.name} — alacrity`,
        audience: { recipients: 'party' }
      })
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const callToAction = defineTrait({
  id: TRAIT.CALL_TO_ACTION,
  name: 'Call to Action',
  triggers: [
    onTriggerPoint(paragonCombatStarted, {
      run(runtime) {
        const state = paragonState.from(runtime);
        if (state.callToActionActivated) return;
        state.callToActionActivated = true;
        runtime.resourceController.grant(
          'motivation',
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.CALL_TO_ACTION), 'resourceGain')
        );
        if (state.activeRefrainId == null) {
          state.activeRefrainId = ID.CHANT_OF_ACTION;
          startRefrain(runtime);
        }
      }
    })
  ],
  balance: {
    resourceGain: 4
  }
});

/** Owns this trait's tuning and selected contributions. */
export const rallyTheValiant = defineTrait({
  id: TRAIT.RALLY_THE_VALIANT,
  name: 'Rally the Valiant',
  triggers: [
    {
      on: 'castStart',
      run(runtime, cast) {
        if (cast.cancelled) return;
        if (
          cast.skill.burst &&
          !cast.skill.categories?.includes('Chant') &&
          hasTrait(runtime, TRAIT.RALLY_THE_VALIANT) &&
          paragonState.from(runtime).activeRefrainId != null
        )
          runtime.resourceController.grant(
            'motivation',
            balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.RALLY_THE_VALIANT), 'resourceGain')
          );
      }
    }
  ],
  balance: {
    resourceGain: 4
  }
});

/** Owns this trait's tuning and selected contributions. */
export const reverberation = defineTrait({
  id: TRAIT.REVERBERATION,
  name: 'Reverberation',
  balance: {
    maximumStacks: 2
  }
});

/** Owns this trait's tuning and selected contributions. */
export const strengtheningStanzas = defineTrait({
  id: TRAIT.STRENGTHENING_STANZAS,
  name: 'Strengthening Stanzas',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { strikeBonus: 0.15, conditionBonus: 0.1 },
  modifierRules: [
    {
      order: 11,
      id: 'warrior.strengthening-stanzas',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',

      amount: (context, target) =>
        target === MODIFIER_TARGET.CONDITION_DAMAGE
          ? balanceProfileNumber(
              requireBalanceProfileFromContext(context, TRAIT.STRENGTHENING_STANZAS),
              'conditionBonus'
            )
          : balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.STRENGTHENING_STANZAS), 'strikeBonus'),
      when: (context) => paragonRuntimeState(context).activeRefrainId === ID.CHANT_OF_ACTION
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const briskPacing = defineTrait({
  id: TRAIT.BRISK_PACING,
  name: 'Brisk Pacing',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: {
    middleThreshold: 4,
    highThreshold: 7,
    strikeLow: 0.1,
    strikeMiddle: 0.2,
    strikeHigh: 0.3,
    conditionLow: 0.05,
    conditionMiddle: 0.15,
    conditionHigh: 0.25
  },
  modifierRules: [
    {
      order: 12,
      id: 'warrior.brisk-pacing',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',

      amount: briskPacingAmount,
      when: (context) => motivation(context) > 0
    }
  ]
});

function paragonRuntimeState(context: Gw2ModifierContext): Partial<ParagonState> {
  return readProfessionSpecializationState<ParagonState>(context.runtime?.profession, 'Paragon') || {};
}

/** Damage queries read the canonical zero-rate clock without reconstructing rewards from reports. */
function motivation(context: Gw2ModifierContext): number {
  return paragonRuntimeState(context).motivation?.value ?? 0;
}

// Resolve Brisk Pacing's modifier amount from live Motivation and refrain state
// at the queried event timestamp.
function briskPacingAmount(context: Gw2ModifierContext, target: string): number {
  const profile = requireBalanceProfileFromContext(context, TRAIT.BRISK_PACING);
  const current = motivation(context);
  if (current <= 0) return 0;
  const strike =
    current >= balanceProfileNumber(profile, 'highThreshold')
      ? balanceProfileNumber(profile, 'strikeHigh')
      : current >= balanceProfileNumber(profile, 'middleThreshold')
        ? balanceProfileNumber(profile, 'strikeMiddle')
        : balanceProfileNumber(profile, 'strikeLow');
  const condition =
    current >= balanceProfileNumber(profile, 'highThreshold')
      ? balanceProfileNumber(profile, 'conditionHigh')
      : current >= balanceProfileNumber(profile, 'middleThreshold')
        ? balanceProfileNumber(profile, 'conditionMiddle')
        : balanceProfileNumber(profile, 'conditionLow');
  return target === MODIFIER_TARGET.CONDITION_DAMAGE ? condition : strike;
}

/** Register native owners once in declaration order. */
export const warriorParagonTraits = [
  inspiringImplements,
  invigoratingTempo,
  enduringRefrain,
  feverishPulse,
  callToAction,
  rallyTheValiant,
  reverberation,
  strengtheningStanzas,
  briskPacing
] as const;

/** Only Motivation actually spent earns adrenaline. */
function applyInvigoratingTempo(runtime: Runtime, spent: number): void {
  runtime.resourceController.grant(
    'adrenaline',
    spent * balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.INVIGORATING_TEMPO), 'resourceGain')
  );
}

/** Chant entry reduces the other chants only after opening packets and refrain scheduling. */
function applyFeverishPulse(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): void {
  const feverish = requireBalanceProfileFromContext(runtime, TRAIT.FEVERISH_PULSE);
  for (const id of CHANTS) {
    const skill = runtime.helpers.skillsById.get(id);
    if (skill && id !== cast.skill.id)
      runtime.cooldownController.reduceSkillRecharge(
        skill,
        balanceProfileNumber(feverish, 'rechargeReduction'),
        runtime.time
      );
  }
}

/** Swaps reward resources only after committed bursts consume pending echoes. */
function applyInspiringImplements(runtime: Runtime, cast: RuntimeCast<WarriorSkill>): void {
  if (
    cast.skill.inputCategory === 'weapon-swap' &&
    runtime.procs.claim(TRAIT.INSPIRING_IMPLEMENTS, 'warrior.paragon.inspiringImplements', runtime.time)
  ) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.INSPIRING_IMPLEMENTS);
    runtime.resourceController.grant('adrenaline', balanceProfileNumber(profile, 'resourceGain'));
    runtime.resourceController.grant('motivation', balanceProfileNumber(profile, 'minimumStacks'));
  }
}

const CHANTS = [ID.CHANT_OF_ACTION, ID.CHANT_OF_RECUPERATION, ID.CHANT_OF_FREEDOM];

type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;
