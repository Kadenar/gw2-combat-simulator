import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { startRefrain } from '#gw2/professions/warrior/specializations/paragon/mechanics/refrains.js';
import { paragonState, type ParagonState } from '#gw2/professions/warrior/specializations/paragon/state.js';

/** Owns this trait's tuning and selected contributions. */
export const inspiringImplements = defineTrait({
  id: TRAIT.INSPIRING_IMPLEMENTS,
  name: 'Inspiring Implements',
  balance: {
    attributeBonus: 180,
    internalCooldown: 4,
    resourceGain: 5,
    minimumStacks: 2
  },
  buildAttributes(_common, context) {
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
  hooks: {
    onCombatStart(runtime) {
      const state = paragonState.from(runtime);
      if (state.callToActionActivated || !hasTrait(runtime, TRAIT.CALL_TO_ACTION)) return;
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
  },
  balance: {
    resourceGain: 4
  }
});

/** Owns this trait's tuning and selected contributions. */
export const rallyTheValiant = defineTrait({
  id: TRAIT.RALLY_THE_VALIANT,
  name: 'Rally the Valiant',
  hooks: {
    onCastStart(runtime, cast) {
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
  },
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
  modifierRules: [
    {
      order: 11,
      id: 'warrior.strengthening-stanzas',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      parameters: {
        strikeBonus: 0.15,
        conditionBonus: 0.1
      },
      amount: (_context, target, parameters) =>
        target === MODIFIER_TARGET.CONDITION_DAMAGE ? parameters.conditionBonus : parameters.strikeBonus,
      when: (context) => paragonRuntimeState(context).activeRefrainId === ID.CHANT_OF_ACTION
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const briskPacing = defineTrait({
  id: TRAIT.BRISK_PACING,
  name: 'Brisk Pacing',
  modifierRules: [
    {
      order: 12,
      id: 'warrior.brisk-pacing',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      parameters: {
        middleThreshold: 4,
        highThreshold: 7,
        strikeLow: 0.1,
        strikeMiddle: 0.2,
        strikeHigh: 0.3,
        conditionLow: 0.05,
        conditionMiddle: 0.15,
        conditionHigh: 0.25
      },
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
function briskPacingAmount(
  context: Gw2ModifierContext,
  target: string,
  parameters: Readonly<Record<string, number>>
): number {
  const current = motivation(context);
  if (current <= 0) return 0;
  const strike =
    current >= parameters.highThreshold
      ? parameters.strikeHigh
      : current >= parameters.middleThreshold
        ? parameters.strikeMiddle
        : parameters.strikeLow;
  const condition =
    current >= parameters.highThreshold
      ? parameters.conditionHigh
      : current >= parameters.middleThreshold
        ? parameters.conditionMiddle
        : parameters.conditionLow;
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
