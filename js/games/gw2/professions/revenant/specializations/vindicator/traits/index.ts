import { boonKey } from '#gw2/platform/combat/boons.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive, playerHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, BOON, RECIPIENT } from '#gw2/platform/constants.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceNumber,
  balanceProfileNumber,
  effectNumber,
  ownerAttributeBonusNumber,
  requireBalanceProfile,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import {
  energyMeldCompleted,
  energyMeldEnduranceGranted,
  vindicatorLanded
} from '#gw2/professions/revenant/specializations/vindicator/mechanics/trigger-points.js';
import { vindicatorState } from '#gw2/professions/revenant/specializations/vindicator/state.js';
import { enduranceNotFull } from '#gw2/professions/revenant/specializations/vindicator/traits/behavior.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

const angsiyansTrust = defineTrait({
  id: TRAIT.ANGSIYANS_TRUST,
  balance: { resourceGain: 25, effects: [] },
  triggers: [onTriggerPoint(energyMeldCompleted, { run: grantAngsiyansTrustEnergy })]
});

const empireDivided = defineTrait({
  id: TRAIT.EMPIRE_DIVIDED,
  balance: { attributeBonuses: { power: 240 }, threshold: 0.5 },
  attributes: (context) => {
    const profile = requireBalanceProfile(context.balanceContext.catalog, TRAIT.EMPIRE_DIVIDED);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: ownerAttributeBonusNumber(profile, 'power'),
          // The full-health Power grant participates in utility and profession conversions.
          feedsConversions: 'all',
          enabled: playerHealthFraction(context) > balanceProfileNumber(profile, 'threshold')
        }
      ]
    };
  }
});

const forerunnerOfDeath = defineTrait({
  id: TRAIT.FORERUNNER_OF_DEATH,
  balance: {
    damageIncrease: 0.25,
    effects: [
      {
        name: 'forerunner-of-death',
        type: 'buff',
        kind: 'forerunner-of-death',
        duration: 10,
        stacks: 1,
        actorType: ACTOR.PLAYER
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
      amount: (context) => balanceNumber(context.catalog, TRAIT.FORERUNNER_OF_DEATH, 'damageIncrease'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        // Use the flag captured on the event when present. Read runtime state for non-dodge strikes.
        (context.event?.forerunnerOfDeathActive != null
          ? Boolean(context.event.forerunnerOfDeathActive)
          : buffActive(context, 'forerunner-of-death'))
    }
  ],
  triggers: [
    onTriggerPoint(vindicatorLanded, {
      run: (runtime, input: TriggerPointInput<typeof vindicatorLanded>) =>
        renewForerunnerOfDeath(runtime, input.profile, input.activationId)
    })
  ]
});

const leviathanStrength = defineTrait({
  id: TRAIT.LEVIATHAN_STRENGTH,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.1 },
  modifierRules: [
    {
      id: 'revenant.leviathan-strength',
      order: 100,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      // "multiply" runs after the damage-additive bucket, so Leviathan compounds on top of Forerunner.
      operation: 'multiply',
      factor: (context) => balanceNumber(context.catalog, TRAIT.LEVIATHAN_STRENGTH, 'damageMultiplier'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && enduranceNotFull(context)
    }
  ]
});

const reaversCurse = defineTrait({
  id: TRAIT.REAVERS_CURSE,
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
        actorType: ACTOR.PLAYER
      }
    ]
  },
  // Consumed charges belong to the landing packet; later state cannot grant the bonus to another dodge.
  modifierRules: [
    {
      id: 'revenant.reavers-curse',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      requiresSelection: false,
      factor: (context) => Number(context.event?.reaversCurseDamageFactor),
      when: (context) => context.event?.actorType === ACTOR.PLAYER && context.event.reaversCurseDamageFactor != null
    }
  ],
  rechargeRules: [
    {
      when: (_runtime, skill) => ENERGY_MELD_IDS.has(skill.id),
      multiplier: { profile: TRAIT.REAVERS_CURSE, field: 'rechargeMultiplier' }
    }
  ],
  triggers: [onTriggerPoint(energyMeldCompleted, { run: armReaversCurse })]
});

const ENERGY_MELD_IDS = new Set<SkillId>([ID.ENERGY_MELD, ID.ENERGY_MELD_ID_72058]);

const saintOfZuHeltzer = defineTrait({ id: TRAIT.SAINT_OF_ZU_HELTZER });

const songOfArboreum = defineTrait({
  id: TRAIT.SONG_OF_ARBOREUM,
  balance: {
    resourceGain: 40,
    effects: [
      {
        name: boonKey(BOON.VIGOR),
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.VIGOR,
        duration: 9,
        stacks: 1,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  triggers: [
    onTriggerPoint(energyMeldEnduranceGranted, {
      run(runtime) {
        runtime.endurance.grant(balanceNumber(runtime.helpers, TRAIT.SONG_OF_ARBOREUM, 'resourceGain'));
      }
    }),
    {
      emit: TRAIT.SONG_OF_ARBOREUM,
      on: 'castCommit',
      when: (_runtime, cast) => ENERGY_MELD_IDS.has(cast.skill.id),
      effects: (effect) => effect.type === 'boon' && effect.name === boonKey(BOON.VIGOR),
      attribution: (_runtime, cast) => ({
        source: 'revenant',
        actorType: ACTOR.PLAYER,
        name: `${cast.skill.name} - vigor`
      })
    }
  ]
});

const vassalsOfTheEmpire = defineTrait({ id: TRAIT.VASSALS_OF_THE_EMPIRE });

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
  if (runtime.engagement.combatMechanicsAllowed())
    runtime.resourceController.grant(
      'energy',
      Math.max(0, balanceNumber(runtime.helpers, TRAIT.ANGSIYANS_TRUST, 'resourceGain'))
    );
}

/** Applies the trait at the mechanic's existing execution boundary. */
function armReaversCurse(runtime: RevenantRuntime): void {
  const state = vindicatorState.from(runtime.profession);
  {
    const curse = requireBalanceProfile(runtime.helpers, TRAIT.REAVERS_CURSE);
    const effect = requireEffect(curse, 'buff', 'reavers-curse');

    // The armed window is the buff, so a removed buff arms nothing.
    if (effect)
      state.reaversCurseUntil = gw2EffectExpiresAt(runtime.time, Math.max(0, effectNumber(curse, effect, 'duration')));
  }
}

/** Applies the trait at the mechanic's existing execution boundary. */
function renewForerunnerOfDeath(runtime: RevenantRuntime, profile: RevenantSkill, activationId: string): void {
  if (profile.id === ID.DEATH_DROP) {
    const forerunner = requireBalanceProfile(runtime.helpers, TRAIT.FORERUNNER_OF_DEATH);
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
            actorType: ACTOR.PLAYER,
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
