import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive, playerHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import {
  energyMeldCompleted,
  energyMeldEnduranceGranted,
  vindicatorLanded
} from '#gw2/professions/revenant/specializations/vindicator/mechanics/boundaries.js';
import { vindicatorState } from '#gw2/professions/revenant/specializations/vindicator/state.js';
import { enduranceNotFull } from '#gw2/professions/revenant/specializations/vindicator/traits/behavior.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Owns Angsiyan's Trust tuning and behavior at its established execution boundaries. */
export const angsiyansTrust = defineTrait({
  triggers: [onTriggerPoint(energyMeldCompleted, { run: grantAngsiyansTrustEnergy })],
  id: TRAIT.ANGSIYANS_TRUST,
  name: "Angsiyan's Trust",
  balance: { resourceGain: 25, effects: [] }
});

/** Owns Empire Divided tuning and behavior at its established execution boundaries. */
export const empireDivided = defineTrait({
  attributes: (context) => {
    const profile = requireBalanceProfileFromContext(context.balanceContext, TRAIT.EMPIRE_DIVIDED);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: balanceProfileNumber(profile, 'attributeBonus'),
          feedsConversions: false,
          enabled: playerHealthFraction(context) > balanceProfileNumber(profile, 'threshold')
        }
      ]
    };
  },
  id: TRAIT.EMPIRE_DIVIDED,
  name: 'Empire Divided',
  balance: { attributeBonus: 240, threshold: 0.5 }
});

/** Owns Forerunner of Death tuning and behavior at its established execution boundaries. */
export const forerunnerOfDeath = defineTrait({
  triggers: [
    onTriggerPoint(vindicatorLanded, {
      run: (runtime, input: TriggerPointInput<typeof vindicatorLanded>) =>
        renewForerunnerOfDeath(runtime, input.profile, input.activationId)
    })
  ],
  id: TRAIT.FORERUNNER_OF_DEATH,
  name: 'Forerunner of Death',
  balance: {
    damageIncrease: 0.25,
    effects: [
      {
        name: 'forerunner-of-death',
        type: 'buff',
        kind: 'forerunner-of-death',
        duration: 10,
        stacks: 1,
        actorType: 'player'
      }
    ]
  },
  modifierRules: [
    {
      id: 'revenant.forerunner-of-death',
      order: 101,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      // "damage-additive" goes into the GW2 shared outgoing-damage bucket alongside other % modifiers.
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FORERUNNER_OF_DEATH), 'damageIncrease'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        // Prefer the event-baked flag when present; fall back to runtime state for non-dodge strikes.
        (context.event?.forerunnerOfDeathActive != null
          ? Boolean(context.event.forerunnerOfDeathActive)
          : buffActive(context, 'forerunner-of-death'))
    }
  ]
});

/** Owns Leviathan Strength tuning and behavior at its established execution boundaries. */
export const leviathanStrength = defineTrait({
  id: TRAIT.LEVIATHAN_STRENGTH,
  name: 'Leviathan Strength',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.1 },
  modifierRules: [
    {
      id: 'revenant.leviathan-strength',
      order: 100,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      // "multiply" runs after the damage-additive bucket, so Leviathan compounds on top of Forerunner.
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LEVIATHAN_STRENGTH), 'damageMultiplier'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && enduranceNotFull(context)
    }
  ]
});

/** Owns Reaver's Curse tuning and behavior at its established execution boundaries. */
export const reaversCurse = defineTrait({
  triggers: [onTriggerPoint(energyMeldCompleted, { run: armReaversCurse })],
  id: TRAIT.REAVERS_CURSE,
  name: "Reaver's Curse",
  balance: {
    rechargeMultiplier: 0.5,
    damageMultiplier: 2,
    effects: [
      {
        name: 'reavers-curse',
        type: 'buff',
        kind: 'reavers-curse',
        duration: 6,
        stacks: 1,
        actorType: 'player'
      }
    ]
  },
  rechargeRules: [
    {
      when: (_runtime, skill) => ENERGY_MELD_IDS.has(skill.id),
      multiplier: { profile: TRAIT.REAVERS_CURSE, field: 'rechargeMultiplier' }
    }
  ]
});

const ENERGY_MELD_IDS = new Set<SkillId>([ID.ENERGY_MELD, ID.ENERGY_MELD_ID_72058]);

/** Owns Saint of zu Heltzer tuning and behavior at its established execution boundaries. */
export const saintOfZuHeltzer = defineTrait({ id: TRAIT.SAINT_OF_ZU_HELTZER, name: 'Saint of zu Heltzer' });

/** Owns Song of Arboreum tuning and behavior at its established execution boundaries. */
export const songOfArboreum = defineTrait({
  id: TRAIT.SONG_OF_ARBOREUM,
  name: 'Song of Arboreum',
  balance: {
    resourceGain: 40,
    effects: [
      {
        name: 'vigor',
        type: 'boon',
        boon: 'vigor',
        duration: 9,
        stacks: 1,
        actorType: 'player'
      }
    ]
  },
  triggers: [
    onTriggerPoint(energyMeldEnduranceGranted, {
      run(runtime) {
        runtime.endurance.grant(
          balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SONG_OF_ARBOREUM), 'resourceGain')
        );
      }
    }),
    {
      emit: TRAIT.SONG_OF_ARBOREUM,
      on: 'castCommit',
      when: (_runtime, cast) => ENERGY_MELD_IDS.has(cast.skill.id),
      effects: (effect) => effect.type === 'boon' && effect.name === 'vigor',
      attribution: (_runtime, cast) => ({
        source: 'revenant',
        actorType: 'player',
        name: `${cast.skill.name} — vigor`
      })
    }
  ]
});

/** Owns Vassals of the Empire tuning and behavior at its established execution boundaries. */
export const vassalsOfTheEmpire = defineTrait({ id: TRAIT.VASSALS_OF_THE_EMPIRE, name: 'Vassals of the Empire' });

export const traitDefinitions = [
  songOfArboreum,
  reaversCurse,
  angsiyansTrust,
  empireDivided,
  forerunnerOfDeath,
  leviathanStrength,
  saintOfZuHeltzer,
  vassalsOfTheEmpire
];

/** Applies the trait at the mechanic's existing execution boundary. */
function grantAngsiyansTrustEnergy(runtime: RevenantRuntime): void {
  if (runtime.combatStartedAt())
    runtime.resourceController.grant(
      'energy',
      Math.max(
        0,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.ANGSIYANS_TRUST), 'resourceGain')
      )
    );
}

/** Applies the trait at the mechanic's existing execution boundary. */
function armReaversCurse(runtime: RevenantRuntime): void {
  const state = vindicatorState.from(runtime);
  {
    const curse = requireBalanceProfileFromContext(runtime, TRAIT.REAVERS_CURSE);
    const effect = requireEffect(curse, 'buff', 'reavers-curse');
    // The armed window is the buff, so a removed buff arms nothing.
    if (effect)
      state.reaversCurseUntil = gw2EffectExpiresAt(runtime.time, Math.max(0, effectNumber(curse, effect, 'duration')));
  }
}

/** Applies the trait at the mechanic's existing execution boundary. */
function renewForerunnerOfDeath(runtime: RevenantRuntime, profile: RevenantSkill, activationId: string): void {
  if (profile.id === ID.DEATH_DROP) {
    const forerunner = requireBalanceProfileFromContext(runtime, TRAIT.FORERUNNER_OF_DEATH);
    const window = requireEffect(forerunner, 'buff', 'forerunner-of-death');
    // The damage window is the buff, so a removed buff opens no window.
    if (window) {
      const duration = Math.max(0, effectNumber(forerunner, window, 'duration'));
      // Renewal replaces the previous bonus even if the selected profile grants a shorter window.
      runtime.combat.reviseBuffExpiry(
        'forerunner-of-death',
        (application) => application.at <= runtime.time && application.expiresAt > runtime.time,
        () => runtime.time
      );
      runtime.effects.emit({
        kind: 'packet',
        settlement: 'reaction',
        event: {
          ...{
            type: 'buff',
            at: runtime.time,
            source: 'revenant',
            sourceId: TRAIT.FORERUNNER_OF_DEATH,
            actorType: 'player',
            skillId: TRAIT.FORERUNNER_OF_DEATH,
            skillName: 'Forerunner of Death',
            activationId,
            name: 'Forerunner of Death',
            kind: String(window.kind),
            duration,
            stacks: effectNumber(forerunner, window, 'stacks')
          },
          fixedDuration: true
        }
      });
    }
  }
}
