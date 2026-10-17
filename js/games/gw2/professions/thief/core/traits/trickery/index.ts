import { ACTOR, CONTROL, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeStackCount, grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { buildThiefBuff, buildThiefControl } from '#gw2/professions/thief/core/events.js';
import type {
  StealAcceptance,
  ThiefCastCompletion,
  ThiefDodge
} from '#gw2/professions/thief/core/mechanics/trigger-points.js';
import {
  stealAccepted,
  stealCompleted,
  thiefCastCompleted,
  thiefDodgeStarted,
  thiefWeaponSwapped
} from '#gw2/professions/thief/core/mechanics/trigger-points.js';
import { thiefRuntimeState } from '#gw2/professions/thief/core/state-queries.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Landed player attacks against defiant foes trigger Lesser Haste's self boons on one shared skill recharge. */
export const burstOfAgility = defineTrait({
  id: TRAIT.BURST_OF_AGILITY,
  name: 'Burst of Agility',
  triggers: [
    {
      on: 'damage.resolved',
      // Invoke the selected skill so patches govern both its boons and player recharge.
      invoke: ID.LESSER_HASTE,
      cooldown: 'skill',
      when: (runtime, event) =>
        event.actorType === ACTOR.PLAYER && Number(event.coefficient) > 0 && Boolean(runtime.config.target?.defiant)
    }
  ]
});

/** Owns Bountiful Theft tuning and behavior at the existing execution boundaries. */
export const bountifulTheft = defineTrait({
  id: TRAIT.BOUNTIFUL_THEFT,
  name: 'Bountiful Theft',
  triggers: [onTriggerPoint(stealAccepted, { run: applyBountifulTheft })],
  balance: {
    effects: [
      { type: 'boon', name: BOON.VIGOR, boon: BOON.VIGOR, stacks: 1, duration: 10 },
      { type: 'boon', name: BOON.MIGHT, boon: BOON.MIGHT, stacks: 5, duration: 10 }
    ]
  }
});

/** Owns Deadly Ambush tuning and behavior at the existing execution boundaries. */
export const deadlyAmbush = defineTrait({
  id: TRAIT.DEADLY_AMBUSH,
  name: 'Deadly Ambush',
  triggers: [onTriggerPoint(stealAccepted, { run: applyDeadlyAmbush })],
  modifierRules: [
    {
      order: 11,
      id: 'thief.deadly-ambush-bleeding',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.DEADLY_AMBUSH, 'conditionDamageMultiplier'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && context.event?.condition === CONDITION.BLEEDING
    }
  ],
  balance: {
    conditionDamageMultiplier: 1.25,
    effects: [{ type: 'condition', name: CONDITION.BLEEDING, condition: CONDITION.BLEEDING, stacks: 3, duration: 10 }]
  }
});

/** Owns Kleptomaniac tuning and behavior at the existing execution boundaries. */
export const kleptomaniac = defineTrait({
  id: TRAIT.KLEPTOMANIAC,
  name: 'Kleptomaniac',
  triggers: [onTriggerPoint(stealCompleted, { run: applyKleptomaniac })],
  balance: {
    resourceGain: 2
  }
});

/** Owns Lead Attacks tuning and behavior at the existing execution boundaries. */
export const leadAttacks = defineTrait({
  id: TRAIT.LEAD_ATTACKS,
  name: 'Lead Attacks',
  triggers: [onTriggerPoint(thiefCastCompleted, { run: grantLeadAttacks })],
  modifierRules: [
    {
      order: 7,
      id: 'thief.lead-attacks',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      // Grants, damage and siphons share selected tuning; each packet counts its own live stacks.
      amount: (context) => {
        const profile = requireBalanceProfileFromContext(context, TRAIT.LEAD_ATTACKS);
        return (
          Math.min(
            balanceProfileNumber(profile, 'maximumStacks'),
            activeStackCount(thiefRuntimeState(context).leadAttackExpirations || [], context.time)
          ) * balanceProfileNumber(profile, 'damageIncreasePerStack')
        );
      },
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ],
  balance: {
    maximumStacks: 15,
    durationMultiplier: 10,
    damageIncreasePerStack: 0.01,
    rechargeMultiplier: 0.85
  },
  rechargeRules: [
    {
      when: (_runtime, skill) => Boolean(skill.stealTraitSkill) && skill.stealRechargeMode !== 'additive',
      multiplier: { profile: TRAIT.LEAD_ATTACKS, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Preparedness tuning and behavior at the existing execution boundaries. */
export const preparedness = defineTrait({
  id: TRAIT.PREPAREDNESS,
  name: 'Preparedness',
  balance: { attributeBonus: 150, maximumStacks: 15 },
  attributes({ balanceContext }) {
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Expertise',
          amount: balanceNumberFromContext(balanceContext, TRAIT.PREPAREDNESS, 'attributeBonus'),
          feedsConversions: 'all'
        }
      ]
    };
  }
});

/** Owns Quick Pockets tuning and behavior at the existing execution boundaries. */
export const quickPockets = defineTrait({
  id: TRAIT.QUICK_POCKETS,
  name: 'Quick Pockets',
  triggers: [
    onTriggerPoint(thiefWeaponSwapped, {
      when: (runtime) => runtime.engagement.combatMechanicsAllowed(),
      run: grantQuickPockets
    })
  ],
  balance: {
    internalCooldown: 8,
    resourceGain: 3
  }
});

/** Owns Sleight of Hand tuning and behavior at the existing execution boundaries. */
export const sleightOfHand = defineTrait({
  id: TRAIT.SLEIGHT_OF_HAND,
  name: 'Sleight of Hand',
  triggers: [onTriggerPoint(stealAccepted, { run: applySleightOfHand })],
  balance: {
    rechargeMultiplier: 0.8,
    effects: [{ type: 'control', name: CONTROL.DAZE, kind: CONTROL.DAZE }]
  },
  rechargeRules: [
    {
      when: (_runtime, skill) => Boolean(skill.stealTraitSkill) && skill.stealRechargeMode !== 'additive',
      multiplier: { profile: TRAIT.SLEIGHT_OF_HAND, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Thrill of the Crime tuning and behavior at the existing execution boundaries. */
export const thrillOfTheCrime = defineTrait({
  id: TRAIT.THRILL_OF_THE_CRIME,
  name: 'Thrill of the Crime',
  triggers: [onTriggerPoint(stealAccepted, { run: applyThrillOfTheCrime })],
  balance: {
    effects: [
      { type: 'boon', name: BOON.FURY, boon: BOON.FURY, stacks: 1, duration: 10 },
      { type: 'boon', name: BOON.MIGHT, boon: BOON.MIGHT, stacks: 5, duration: 10 },
      { type: 'boon', name: BOON.SWIFTNESS, boon: BOON.SWIFTNESS, stacks: 1, duration: 10 }
    ]
  }
});

/** Owns Uncatchable tuning and behavior at the existing execution boundaries. */
export const uncatchable = defineTrait({
  id: TRAIT.UNCATCHABLE,
  name: 'Uncatchable',
  triggers: [onTriggerPoint(thiefDodgeStarted, { run: startUncatchable })]
});
/** Selected steal boons retain skill lineage while shared profile delivery owns their packets. */
function applyBountifulTheft(runtime: ThiefRuntime, { cast }: StealAcceptance): void {
  for (const name of [BOON.VIGOR, BOON.MIGHT]) {
    emitTraitProfile(runtime, TRAIT.BOUNTIFUL_THEFT, TRAIT.BOUNTIFUL_THEFT, undefined, {
      effect: { type: 'boon', name },
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      attribution: { source: 'Trait', sourceId: TRAIT.BOUNTIFUL_THEFT, actorType: ACTOR.PLAYER },
      transform: (event, effect) => ({
        ...event,
        name: 'Steal \u2014 ' + String(effect.boon),
        kind: String(effect.boon).toLowerCase(),
        boon: String(effect.boon),
        fixedDuration: false,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      })
    });
  }
}

function applyDeadlyAmbush(runtime: ThiefRuntime, { cast }: StealAcceptance): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.DEADLY_AMBUSH);
  const bleeding = requireEffect(profile, 'condition', CONDITION.BLEEDING);

  if (!bleeding) return;

  emitTraitProfile(runtime, TRAIT.DEADLY_AMBUSH, TRAIT.DEADLY_AMBUSH, undefined, {
    at: runtime.time,
    fullEnd: runtime.time,
    effect: { type: 'condition', name: CONDITION.BLEEDING },
    attribution: {
      source: 'Trait',
      skillId: TRAIT.DEADLY_AMBUSH,
      skillName: 'Deadly Ambush',
      triggeredBy: cast.skill.name,
      activationId: cast.id,
      name: 'Deadly Ambush — Bleeding',
      actorType: ACTOR.PLAYER,
      sourceId: TRAIT.DEADLY_AMBUSH
    }
  });
}

/** Applies Kleptomaniac at its established mechanical boundary. */
function applyKleptomaniac(runtime: ThiefRuntime): void {
  const initiativeGain = balanceNumberFromContext(runtime, TRAIT.KLEPTOMANIAC, 'resourceGain');

  if (initiativeGain > 0) runtime.resourceController.grant('initiative', initiativeGain);
}

function applySleightOfHand(runtime: ThiefRuntime, { cast }: StealAcceptance): void {
  const control = requireEffect(
    requireBalanceProfileFromContext(runtime, TRAIT.SLEIGHT_OF_HAND),
    'control',
    CONTROL.DAZE
  );

  if (!control) return;

  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefControl(cast.skill, {
      at: runtime.time,
      source: 'Trait',
      sourceId: TRAIT.SLEIGHT_OF_HAND,
      activationId: cast.id,
      name: 'Sleight of Hand - Daze',
      controlKind: String(control.kind)
    })
  });
}

/** Selected steal boons retain skill lineage while shared profile delivery owns their packets. */
function applyThrillOfTheCrime(runtime: ThiefRuntime, { cast }: StealAcceptance): void {
  emitTraitProfile(runtime, TRAIT.THRILL_OF_THE_CRIME, TRAIT.THRILL_OF_THE_CRIME, undefined, {
    effects: (effect) => effect.type === 'boon',
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id,
    attribution: { source: 'Trait', sourceId: TRAIT.THRILL_OF_THE_CRIME, actorType: ACTOR.PLAYER },
    transform: (event, effect) => ({
      ...event,
      name: 'Steal \u2014 ' + String(effect.boon),
      kind: String(effect.boon).toLowerCase(),
      boon: String(effect.boon),
      fixedDuration: false,
      audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
    })
  });
}

/** Initiative spent grants Lead Attacks stacks at completion, replacing the oldest at the cap. */
function grantLeadAttacks(runtime: ThiefRuntime, { cast, initiativeCost: cost }: ThiefCastCompletion): void {
  const skill = cast.skill;

  if (cost <= 0) return;

  const core = runtime.profession.core;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.LEAD_ATTACKS);
  const maximumStacks = balanceProfileNumber(profile, 'maximumStacks');
  const duration = balanceProfileNumber(profile, 'durationMultiplier');
  // A patched fractional cost grants a whole stack for its remainder, so round up before the integer boundary.
  core.leadAttackExpirations = grantTimedStacks(core.leadAttackExpirations, {
    at: runtime.time,
    expiresAt: runtime.time + duration,
    count: Math.ceil(cost),
    maximumStacks,
    retain: 'newest-grant'
  });
  runtime.effects.emit({
    kind: 'packet',
    event: buildThiefBuff(skill, {
      at: runtime.time,
      source: 'Trait',
      sourceId: TRAIT.LEAD_ATTACKS,
      activationId: cast.id,
      kind: 'lead-attacks',
      duration,
      stacks: Math.min(cost, maximumStacks)
    })
  });
}

/** Quick Pockets grants in-combat initiative once per its cooldown. */
function grantQuickPockets(runtime: ThiefRuntime): void {
  if (!runtime.procs.claim(TRAIT.QUICK_POCKETS, 'thief.core.quickPockets', runtime.time)) return;

  const initiativeGain = balanceNumberFromContext(runtime, TRAIT.QUICK_POCKETS, 'resourceGain');

  if (initiativeGain > 0) runtime.resourceController.grant('initiative', initiativeGain);
}

/** Uncatchable's caltrop pulses are queued from the dodge's takeoff; the runtime has already paid its endurance. */
function startUncatchable(runtime: ThiefRuntime, { cast }: ThiefDodge): void {
  // The invoked skill owns each pulse and condition; removing one leaves its sibling intact.
  const caltrops = runtime.helpers.skillsById.get(ID.LESSER_CALTROPS)!;
  runtime.effects.emit({
    kind: 'profile',
    profile: caltrops,
    effects: caltrops.effects,
    at: cast.start,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.UNCATCHABLE,
      actorType: ACTOR.PLAYER,
      skillId: caltrops.id,
      skillName: caltrops.name,
      triggeredBy: cast.skill.name,
      activationId: cast.id
    },
    transform: (event) => ({ ...event, icon: caltrops.icon, name: 'Uncatchable \u2014 Lesser Caltrops' })
  });
}
