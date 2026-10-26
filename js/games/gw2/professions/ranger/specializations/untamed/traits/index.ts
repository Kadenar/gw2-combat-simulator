import { ACTOR, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import {
  activeRefreshedStacks,
  grantRefreshedStacks,
  type RefreshedStacks
} from '#gw2/platform/combat/resources/refreshed-stacks.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  readProfessionCoreState,
  readProfessionSpecializationState
} from '#gw2/platform/profession-definition/state.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { WorkOwner } from '#gw2/platform/simulation/work-contract.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pet-attributes.js';
import { isPetStrike, isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import type { RangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { TRAITS } from '#gw2/professions/ranger/data/traits-data.js';
import { UNTAMED_AMBUSH_SKILL_IDS } from '#gw2/professions/ranger/data/untamed-ambushes.js';
import {
  BIORHYTHM,
  BIORHYTHM_OWNER,
  VOW_OF_THE_UNTAMED
} from '#gw2/professions/ranger/specializations/untamed/effect-state.js';
import {
  grantAmbush,
  untamedStrike,
  untamedUnleashed
} from '#gw2/professions/ranger/specializations/untamed/mechanics/unleash-effects.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import type { RangerResolverContext, RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

function untamedModifierState(context: Gw2ModifierContext): Partial<UntamedModifierState> {
  return readProfessionSpecializationState<UntamedModifierState>(context.runtime?.profession, 'Untamed') || {};
}

function rangerUnleashed(context: Gw2ModifierContext): boolean {
  return untamedModifierState(context).rangerUnleashed === true;
}

/** Owns Natural Fortitude's live tuning and trait behavior. */
const naturalFortitude = defineTrait({
  id: TRAIT.NATURAL_FORTITUDE,
  name: 'Natural Fortitude',
  balance: {
    attributeBonus: 240,
    // The unconditional ambush siphon keeps trait attribution and reads the active patch's damage payload.
    effects: [
      {
        type: 'strike',
        name: 'Natural Fortitude',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 3517,
        flatStrikePowerCoeff: 0.005,
        canCrit: false,
        damageKind: 'life-steal',
        damageBreakdownName: 'Life Siphon - Natural Fortitude',
        icon: String(TRAITS.find((trait) => trait.id === TRAIT.NATURAL_FORTITUDE)?.icon || '')
      }
    ]
  },
  lifetime: {
    eventHandlers: {
      'ranger.natural-fortitude'(runtime, event) {
        emitTraitProfile(runtime, TRAIT.NATURAL_FORTITUDE, TRAIT.NATURAL_FORTITUDE, event, {
          at: event.at,
          effect: { type: 'strike', name: 'Natural Fortitude' },
          attribution: { actorType: ACTOR.PLAYER, source: event.source, offTarget: event.offTarget }
        });
      }
    }
  },
  attributes: traitAttributeEffects(TRAIT.NATURAL_FORTITUDE, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: 'none' }
  ])
});

/** Owns Let Loose's live tuning and trait behavior. */
const letLoose = defineTrait({
  triggers: [
    {
      on: 'castCommit',
      run(runtime, cast) {
        const state = untamedState.from(runtime);

        if (
          cast.skill.id === SHARED_SKILL_IDS.SWAP_WEAPONS &&
          runtime.engagement.active &&
          runtime.procs.claim(TRAIT.LET_LOOSE, 'ranger.untamed.letLoose', runtime.time)
        ) {
          // An immediate swap ambush spends the refreshed grant's cooldown, preventing intervening toggles from rearming it.
          runtime.procs.setDeadline('ranger.untamed.unleashedPower', 0);

          if (
            state.rangerUnleashed &&
            runtime.procs.claim(TRAIT.UNLEASHED_POWER, 'ranger.untamed.unleashedPower', runtime.time)
          )
            grantAmbush(runtime);
        }
      }
    },

    onTriggerPoint(untamedStrike, {
      when: (_runtime, input: TriggerPointInput<typeof untamedStrike>) => input.event.actorType === ACTOR.PLAYER,
      run: (runtime, input: TriggerPointInput<typeof untamedStrike>) => triggerLetLoose(runtime, input.event)
    })
  ],
  id: TRAIT.LET_LOOSE,
  name: 'Let Loose',
  balance: {
    internalCooldown: 9,
    effects: [
      { name: boonKey(BOON.QUICKNESS), type: 'boon', boon: BOON.QUICKNESS, duration: 5, stacks: 1 },
      { name: boonKey(BOON.MIGHT), type: 'boon', boon: BOON.MIGHT, duration: 10, stacks: 5 }
    ]
  }
});

/** Owns Blinding Outburst's live tuning and trait behavior. */
const blindingOutburst = defineTrait({
  id: TRAIT.BLINDING_OUTBURST,
  name: 'Blinding Outburst',
  balance: {
    damageIncrease: 0.25,
    effects: [{ name: CONDITION.BLINDNESS, type: 'condition', condition: CONDITION.BLINDNESS, duration: 2, stacks: 1 }]
  },
  modifierRules: [
    {
      order: 101,
      id: 'ranger.blinding-outburst',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      // This skill-specific bonus multiplies the outgoing pool containing Symbiosis, Vow, and sigils.
      operation: 'multiply',
      factor: (context) => 1 + balanceNumberFromContext(context, TRAIT.BLINDING_OUTBURST, 'damageIncrease'),
      // Secondary spores retain their parent cast for attribution, but are not ambush strikes.
      when: (context) =>
        BLINDING_OUTBURST_SKILL_IDS.has(Number(context.event?.sourceId ?? context.event?.skillId ?? context.skillId))
    }
  ],
  triggers: [
    {
      on: 'damage.resolved',
      when: (_runtime, event) =>
        event.skillId === ID.VENOMOUS_OUTBURST &&
        Number(event.coefficient) > 0 &&
        (isPlayerStrike(event) || isPetStrike(event)),
      emit: TRAIT.BLINDING_OUTBURST,
      effects: (effect) => effect.type === 'condition' && effect.name === CONDITION.BLINDNESS,
      attribution: (_runtime, event) => ({
        ownerActorType: ACTOR.PLAYER,
        skillId: TRAIT.BLINDING_OUTBURST,
        skillName: 'Blinding Outburst',
        name: 'Blinding Outburst - Blindness',
        triggeredBy: event.skillName
      })
    }
  ]
});

/** Owns Ferocious Symbiosis's live tuning and trait behavior. */
const ferociousSymbiosis = defineTrait({
  triggers: [
    onTriggerPoint(untamedStrike, {
      run: (runtime, input: TriggerPointInput<typeof untamedStrike>) => triggerFerociousSymbiosis(runtime, input.event)
    })
  ],
  id: TRAIT.FEROCIOUS_SYMBIOSIS,
  name: 'Ferocious Symbiosis',
  balance: {
    damageIncreasePerStack: 0.05,
    maximumStacks: 5,
    duration: 5,
    internalCooldown: 0.5
  },
  modifierRules: [
    {
      order: 102,
      id: 'ranger.ferocious-symbiosis',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      // Symbiosis shares the outgoing additive pool with Vow and equipped sigils.
      operation: 'damage-additive',

      amount: (context) => {
        const state = untamedModifierState(context);
        const companion = readProfessionCoreState<RangerCoreState>(context.runtime?.profession).pet;
        const pet = context.event?.actorType === ACTOR.SUMMON && companion?.id === context.event.summonOwner;
        // Damage ownership selects the pool: Ranger-owned pet skills such as Poisonous Cloud use player stacks.
        const stacks = activeRefreshedStacks(
          pet ? companion?.ferociousSymbiosis : state.ferociousSymbiosisPlayer,
          context.time,
          'exclusive'
        );
        return (
          Math.min(balanceNumberFromContext(context, TRAIT.FEROCIOUS_SYMBIOSIS, 'maximumStacks'), stacks) *
          balanceNumberFromContext(context, TRAIT.FEROCIOUS_SYMBIOSIS, 'damageIncreasePerStack')
        );
      },
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) || isPetStrike(context.event)
    }
  ]
});

/** Owns Debilitating Blows's live tuning and trait behavior. */
const debilitatingBlows = defineTrait({
  id: TRAIT.DEBILITATING_BLOWS,
  name: 'Debilitating Blows',
  balance: {
    internalCooldown: 1,
    effects: [
      { name: CONDITION.POISONED, type: 'condition', condition: CONDITION.POISONED, duration: 5, stacks: 2 },
      { name: CONDITION.SLOW, type: 'condition', condition: CONDITION.SLOW, duration: 2, stacks: 2 }
    ]
  },
  triggers: [
    {
      emit: TRAIT.DEBILITATING_BLOWS,
      on: 'control.resolved',
      cooldown: 'profile',
      when: (runtime, event) =>
        (isPlayerStrike(event) || isPetStrike(event)) &&
        untamedState.from(runtime).rangerUnleashed &&
        Boolean(
          requireEffect(
            requireBalanceProfileFromContext(runtime, TRAIT.DEBILITATING_BLOWS),
            'condition',
            CONDITION.POISONED
          )
        ),
      effects: (effect) => effect.type === 'condition' && effect.name === CONDITION.POISONED,
      attribution: (_runtime, event) => ({
        skillId: TRAIT.DEBILITATING_BLOWS,
        skillName: 'Debilitating Blows',
        name: `Debilitating Blows - Poisoned`,
        ownerActorType: ACTOR.PLAYER,
        triggeredBy: event.skillName
      })
    },
    {
      emit: TRAIT.DEBILITATING_BLOWS,
      on: 'control.resolved',
      cooldown: 'profile',
      when: (runtime, event) =>
        (isPlayerStrike(event) || isPetStrike(event)) &&
        !untamedState.from(runtime).rangerUnleashed &&
        Boolean(
          requireEffect(
            requireBalanceProfileFromContext(runtime, TRAIT.DEBILITATING_BLOWS),
            'condition',
            CONDITION.SLOW
          )
        ),
      effects: (effect) => effect.type === 'condition' && effect.name === CONDITION.SLOW,
      attribution: (_runtime, event) => ({
        skillId: TRAIT.DEBILITATING_BLOWS,
        skillName: 'Debilitating Blows',
        name: `Debilitating Blows - Slow`,
        ownerActorType: ACTOR.PLAYER,
        triggeredBy: event.skillName
      })
    }
  ]
});

/** Owns Enhancing Impact's live tuning and trait behavior. */
const enhancingImpact = defineTrait({
  id: TRAIT.ENHANCING_IMPACT,
  name: 'Enhancing Impact',
  balance: {
    internalCooldown: 1,
    effects: [
      { name: boonKey(BOON.QUICKNESS), type: 'boon', boon: BOON.QUICKNESS, duration: 3, stacks: 1 },
      { name: boonKey(BOON.STABILITY), type: 'boon', boon: BOON.STABILITY, duration: 3, stacks: 1 }
    ]
  },
  triggers: [
    {
      emit: TRAIT.ENHANCING_IMPACT,
      on: 'control.resolved',
      cooldown: 'profile',
      when: (runtime, event) =>
        (isPlayerStrike(event) || isPetStrike(event)) &&
        untamedState.from(runtime).rangerUnleashed &&
        Boolean(
          requireEffect(
            requireBalanceProfileFromContext(runtime, TRAIT.ENHANCING_IMPACT),
            'boon',
            boonKey(BOON.QUICKNESS)
          )
        ),
      effects: (effect) => effect.type === 'boon' && effect.name === boonKey(BOON.QUICKNESS),
      attribution: (_runtime, event) => ({
        skillId: TRAIT.ENHANCING_IMPACT,
        skillName: 'Enhancing Impact',
        name: `Enhancing Impact - quickness`,

        triggeredBy: event.skillName
      })
    },
    {
      emit: TRAIT.ENHANCING_IMPACT,
      on: 'control.resolved',
      cooldown: 'profile',
      when: (runtime, event) =>
        (isPlayerStrike(event) || isPetStrike(event)) &&
        !untamedState.from(runtime).rangerUnleashed &&
        Boolean(
          requireEffect(
            requireBalanceProfileFromContext(runtime, TRAIT.ENHANCING_IMPACT),
            'boon',
            boonKey(BOON.STABILITY)
          )
        ),
      effects: (effect) => effect.type === 'boon' && effect.name === boonKey(BOON.STABILITY),
      attribution: (_runtime, event) => ({
        skillId: TRAIT.ENHANCING_IMPACT,
        skillName: 'Enhancing Impact',
        name: `Enhancing Impact - stability`,

        triggeredBy: event.skillName
      })
    }
  ]
});

/**
 * Each unleash replaces the Biorhythm cycle: it spends an armed Vow, removes live and pending stacks, then starts a
 * new series of independently expiring stacks. Reaching the threshold arms the next unleash even after stacks decay.
 */
const biorhythm = defineTrait({
  id: TRAIT.BIORHYTHM,
  name: 'Biorhythm',
  balance: {
    stackThreshold: 5,
    effects: [
      // One stack on unleash, then one per second for four seconds; stacks never refresh each other.
      { name: BIORHYTHM, type: 'buff', kind: BIORHYTHM, duration: 6, stacks: 1, applications: 5, intervalMs: 1000 },
      { name: VOW_OF_THE_UNTAMED, type: 'buff', kind: VOW_OF_THE_UNTAMED, duration: 10, stacks: 1 }
    ]
  },
  triggers: [
    onTriggerPoint(untamedUnleashed, {
      run(runtime, input: TriggerPointInput<typeof untamedUnleashed>) {
        const state = untamedState.from(runtime);
        // Owned pending stacks are cancelled and live stacks end now, so an early unleash cannot inherit progress.
        runtime.cancelOwner(BIORHYTHM_OWNER);
        runtime.combat.reviseBuffExpiry(
          BIORHYTHM,
          () => true,
          (expiresAt) => Math.min(expiresAt, runtime.time)
        );

        if (state.biorhythmArmed) emitBiorhythmEffect(runtime, VOW_OF_THE_UNTAMED, 'Vow of the Untamed', input.skill);

        state.biorhythmArmed = false;
        emitBiorhythmEffect(runtime, BIORHYTHM, 'Biorhythm', input.skill, BIORHYTHM_OWNER);
      }
    }),
    {
      on: 'buff.applied',
      when: (_runtime, event) => event.kind === BIORHYTHM && Boolean(event.resolvedAudience?.includesSelf),
      // The threshold reads live stacks, so a cycle whose stacks expire before reaching it never arms Vow.
      run(runtime: RangerRuntime) {
        if (
          runtime.combat.activeBuffStacks(BIORHYTHM, runtime.time) >=
          balanceNumberFromContext(runtime, TRAIT.BIORHYTHM, 'stackThreshold')
        )
          untamedState.from(runtime).biorhythmArmed = true;
      }
    }
  ]
});

/** Biorhythm grants its own self effects; an owner lets the next unleash cancel stacks that have not landed. */
function emitBiorhythmEffect(
  runtime: RangerRuntime,
  kind: string,
  name: string,
  trigger: RangerSkill,
  owner?: WorkOwner
): void {
  emitTraitProfile(runtime, TRAIT.BIORHYTHM, TRAIT.BIORHYTHM, undefined, {
    at: runtime.time,
    owner,
    effect: { type: 'buff', name: kind },
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.BIORHYTHM,
      actorType: ACTOR.EFFECT,
      skillId: TRAIT.BIORHYTHM,
      skillName: 'Biorhythm',
      triggeredBy: trigger.name,
      name
    }
  });
}

/** Owns Vow of the Untamed's live tuning and trait behavior. */
const vowOfTheUntamed = defineTrait({
  id: TRAIT.VOW_OF_THE_UNTAMED,
  name: 'Vow of the Untamed',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageIncrease: 0.25 },
  modifierRules: [
    {
      order: 100,
      id: 'ranger.vow-of-the-untamed',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, TRAIT.VOW_OF_THE_UNTAMED, 'damageIncrease'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        // Pet strikes don't benefit from Vow even when Ranger is unleashed.
        !isPetStrike(context.event) &&
        // Biorhythm's Vow effect grants the same bonus in either unleash state; the two never stack.
        (rangerUnleashed(context) || buffActive(context, VOW_OF_THE_UNTAMED))
    }
  ]
});

interface UntamedModifierState {
  readonly rangerUnleashed?: boolean;
  readonly ferociousSymbiosisPlayer?: RefreshedStacks;
}

// The ambush damage bonus follows the same supported identities as availability and Let Loose.
const BLINDING_OUTBURST_SKILL_IDS = new Set<number>([ID.VENOMOUS_OUTBURST, ...UNTAMED_AMBUSH_SKILL_IDS]);

/** Register authored owners in a fixed order; runtime boundaries stay explicit. */
/** The unlocking minor owns baseline specialization policy even when omitted from explicit selections. */
const intrinsicPolicy = defineTrait({
  id: TRAIT.UNLEASHED_POWER,
  name: 'Unleashed Power',
  balance: { duration: 4, internalCooldown: 9 }
});

export const untamedTraits = [
  intrinsicPolicy,
  naturalFortitude,
  letLoose,
  blindingOutburst,
  ferociousSymbiosis,
  debilitatingBlows,
  enhancingImpact,
  biorhythm,
  vowOfTheUntamed
];

function triggerFerociousSymbiosis(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = untamedState.from(context);
  const profile = requireBalanceProfileFromContext(context, TRAIT.FEROCIOUS_SYMBIOSIS);
  const maximumStacks = balanceProfileNumber(profile, 'maximumStacks');
  const duration = balanceProfileNumber(profile, 'duration');
  const pet = context.profession.core.pet;

  if (!pet) return;

  if (isPlayerStrike(event)) {
    if (!context.procs.claim(TRAIT.FEROCIOUS_SYMBIOSIS, 'ranger.untamed.ferociousSymbiosisPet', event.at)) return;

    // A player hit builds Pet stacks (cross-buff: player hits power the pet).
    pet.ferociousSymbiosis = grantRefreshedStacks(
      pet.ferociousSymbiosis,
      1,
      event.at,
      event.at + duration,
      maximumStacks,
      'exclusive'
    );
  } else if (isPetStrike(event) && event.actorType === ACTOR.SUMMON && event.summonOwner === pet.id) {
    if (!context.procs.claim(TRAIT.FEROCIOUS_SYMBIOSIS, 'ranger.untamed.ferociousSymbiosisPlayer', event.at)) return;

    // A pet hit builds Player stacks (cross-buff: pet hits power the player).
    state.ferociousSymbiosisPlayer = grantRefreshedStacks(
      state.ferociousSymbiosisPlayer,
      1,
      event.at,
      event.at + duration,
      maximumStacks,
      'exclusive'
    );
  }
}

function triggerLetLoose(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (
    // Every supported weapon ambush can grant Let Loose on its first landed strike.
    !AMBUSH_SKILL_IDS.has(Number(event.skillId)) ||
    // activationId is absent on synthetic events; guard prevents double-counting.
    !event.activationId
  ) {
    return;
  }

  // Each ambush activation grants boons exactly once even if the skill hits multiple times.
  if (!claimActivation(untamedState.from(context).untamedActivationClaims, 'ranger.let-loose', event.activationId))
    return;

  // Expand each surviving boon once per accepted ambush, preserving the party audience.
  emitTraitProfile(context, TRAIT.LET_LOOSE, TRAIT.LET_LOOSE, undefined, {
    at: event.at,
    durationContext: event,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.LET_LOOSE,
      actorType: ACTOR.EFFECT,
      skillId: TRAIT.LET_LOOSE,
      skillName: 'Let Loose',
      triggeredBy: event.skillName
    },
    transform: (packet) => ({
      ...packet,
      name: 'Let Loose - ' + packet.kind,
      audience: {
        recipients: RECIPIENT.PARTY,
        maximumRecipients: 5,
        eligibleCompanionIds: context.profession.core.pet ? [rangerPetCompanionId(context)] : []
      }
    }),
    preserveName: true,
    effects: (effect) => effect.type === 'boon'
  });
}

const AMBUSH_SKILL_IDS = new Set<number>(UNTAMED_AMBUSH_SKILL_IDS);
