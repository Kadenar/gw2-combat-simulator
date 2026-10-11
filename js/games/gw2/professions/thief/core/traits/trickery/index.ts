import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeStackCount, grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import {
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
} from '#gw2/professions/thief/core/mechanics/boundaries.js';
import {
  stealAccepted,
  stealCompleted,
  thiefCastCompleted,
  thiefDodgeStarted,
  thiefWeaponSwapped
} from '#gw2/professions/thief/core/mechanics/boundaries.js';
import { THIEF_MISC_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/misc-skills.js';
import { thiefRuntimeState } from '#gw2/professions/thief/core/state-queries.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Landed player attacks against defiant foes trigger Lesser Haste's self boons on one shared skill recharge. */
export const burstOfAgility = defineTrait({
  id: TRAIT.BURST_OF_AGILITY,
  name: 'Burst of Agility',
  balance: {
    // This produced skill recharges with the player's Alacrity; ordinary trait ICDs remain fixed.
    cooldownPolicy: 'playerRecharge',
    cooldown: THIEF_MISC_SKILL_MECHANICS[ID.LESSER_HASTE]!.cooldown,
    effects: THIEF_MISC_SKILL_MECHANICS[ID.LESSER_HASTE]!.effects
  },
  triggers: [
    {
      on: 'damage.resolved',
      emit: TRAIT.BURST_OF_AGILITY,
      cooldown: 'profile',
      when: (runtime, event) =>
        event.actorType === 'player' && Number(event.coefficient) > 0 && Boolean(runtime.config.target?.defiant),
      attribution: (runtime, event) => ({
        skillId: ID.LESSER_HASTE,
        skillName: 'Lesser Haste',
        name: 'Lesser Haste',
        icon: runtime.helpers.skillsById.get(ID.LESSER_HASTE)?.icon,
        triggeredBy: event.skillName,
        audience: { recipients: 'self' }
      })
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
      { type: 'boon', name: 'Vigor', boon: 'Vigor', stacks: 1, duration: 10 },
      { type: 'boon', name: 'Might', boon: 'Might', stacks: 5, duration: 10 }
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
      factor: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.DEADLY_AMBUSH),
          'conditionDamageMultiplier'
        ),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && context.event?.condition === 'Bleeding'
    }
  ],
  balance: {
    conditionDamageMultiplier: 1.25,
    effects: [{ type: 'condition', name: 'Bleeding', condition: 'Bleeding', stacks: 3, duration: 10 }]
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
  balance: { attributeBonus: 150 },
  attributes({ balanceContext }) {
    const preparednessProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.PREPAREDNESS);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Expertise',
          amount: balanceProfileNumber(preparednessProfile, 'attributeBonus'),
          feedsConversions: true
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
    onTriggerPoint(thiefWeaponSwapped, { when: (runtime) => runtime.combatStartedAt(), run: grantQuickPockets })
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
    effects: [{ type: 'control', name: 'daze', kind: 'daze' }]
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
      { type: 'boon', name: 'Fury', boon: 'Fury', stacks: 1, duration: 10 },
      { type: 'boon', name: 'Might', boon: 'Might', stacks: 5, duration: 10 },
      { type: 'boon', name: 'Swiftness', boon: 'Swiftness', stacks: 1, duration: 10 }
    ]
  }
});

/** Owns Uncatchable tuning and behavior at the existing execution boundaries. */
export const uncatchable = defineTrait({
  id: TRAIT.UNCATCHABLE,
  name: 'Uncatchable',
  triggers: [onTriggerPoint(thiefDodgeStarted, { run: startUncatchable })],
  balance: {
    // Effect timelines own pulse timing for simulation, patch authoring, and tooltips.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'condition',
        name: 'Bleeding',
        condition: 'Bleeding',
        stacks: 1,
        duration: 5,
        applications: 3,
        atMs: 800,
        intervalMs: 1000
      },
      {
        type: 'condition',
        name: 'Crippled',
        condition: 'Crippled',
        stacks: 1,
        duration: 1,
        applications: 3,
        atMs: 800,
        intervalMs: 1000
      }
    ])
  }
});
/** Selected steal boons retain skill lineage while shared profile delivery owns their packets. */
function applyBountifulTheft(runtime: ThiefRuntime, { cast }: StealAcceptance): void {
  for (const name of ['Vigor', 'Might']) {
    emitTraitProfile(runtime, TRAIT.BOUNTIFUL_THEFT, TRAIT.BOUNTIFUL_THEFT, undefined, {
      effect: { type: 'boon', name },
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      attribution: { source: 'Trait', sourceId: TRAIT.BOUNTIFUL_THEFT, actorType: 'player' },
      transform: (event, effect) => ({
        ...event,
        name: 'Steal \u2014 ' + String(effect.boon),
        kind: String(effect.boon),
        boon: String(effect.boon),
        fixedDuration: false,
        audience: undefined
      })
    });
  }
}

function applyDeadlyAmbush(runtime: ThiefRuntime, { cast }: StealAcceptance): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.DEADLY_AMBUSH);
  const bleeding = requireEffect(profile, 'condition', 'Bleeding');
  if (!bleeding) return;
  emitTraitProfile(runtime, TRAIT.DEADLY_AMBUSH, TRAIT.DEADLY_AMBUSH, undefined, {
    at: runtime.time,
    fullEnd: runtime.time,
    effect: { type: 'condition', name: 'Bleeding' },
    attribution: {
      source: 'Trait',
      skillId: TRAIT.DEADLY_AMBUSH,
      skillName: 'Deadly Ambush',
      triggeredBy: cast.skill.name,
      activationId: cast.id,
      name: 'Deadly Ambush — Bleeding',
      actorType: 'player',
      sourceId: TRAIT.DEADLY_AMBUSH
    }
  });
}

/** Applies Kleptomaniac at its established mechanical boundary. */
function applyKleptomaniac(runtime: ThiefRuntime): void {
  const initiativeGain = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, TRAIT.KLEPTOMANIAC),
    'resourceGain'
  );
  if (initiativeGain > 0) runtime.resourceController.grant('initiative', initiativeGain);
}

function applySleightOfHand(runtime: ThiefRuntime, { cast }: StealAcceptance): void {
  const control = requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.SLEIGHT_OF_HAND), 'control', 'daze');
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
    attribution: { source: 'Trait', sourceId: TRAIT.THRILL_OF_THE_CRIME, actorType: 'player' },
    transform: (event, effect) => ({
      ...event,
      name: 'Steal \u2014 ' + String(effect.boon),
      kind: String(effect.boon),
      boon: String(effect.boon),
      fixedDuration: false,
      audience: undefined
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
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.QUICK_POCKETS);
  const initiativeGain = balanceProfileNumber(profile, 'resourceGain');
  if (initiativeGain > 0) runtime.resourceController.grant('initiative', initiativeGain);
}

/** Uncatchable's caltrop pulses are queued from the dodge's takeoff; the runtime has already paid its endurance. */
function startUncatchable(runtime: ThiefRuntime, { cast }: ThiefDodge): void {
  // Each condition's authored timing is authoritative; removing one component leaves its sibling's pulses intact.
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.UNCATCHABLE);
  const caltrops = runtime.helpers.skillsById.get(ID.LESSER_CALTROPS);
  emitTraitProfile(runtime, TRAIT.UNCATCHABLE, profile.id, undefined, {
    preserveName: true,
    effects: (effect) =>
      (
        profile.effects?.filter(
          (effect) => effect.type === 'condition' && ['Bleeding', 'Crippled'].includes(String(effect.name))
        ) ?? []
      ).includes(effect),
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.UNCATCHABLE,
      actorType: 'player',
      skillId: ID.LESSER_CALTROPS,
      skillName: 'Lesser Caltrops',
      triggeredBy: cast.skill.name,
      activationId: cast.id
    },
    transform: (event) => ({ ...event, icon: caltrops?.icon, name: 'Uncatchable \u2014 Lesser Caltrops' })
  });
}
