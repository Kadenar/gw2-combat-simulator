import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { MODIFIER_TARGET, type Gw2ModifierContext, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { RechargeRule } from '#gw2/platform/profession-definition/trigger-rules.js';
import { MECHANIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/mechanist/profiles.js';
import {
  forceSignetDamage,
  ordinaryOverclockEligible,
  signetPassiveAvailable,
  superconductingSignetDamage
} from '#gw2/professions/engineer/specializations/mechanist/traits/behavior.js';
import type { EngineerRuntime, EngineerRuntimeState, EngineerSkill } from '#gw2/professions/engineer/types.js';
/**
 * Owns Mechanist signet skill fragments.
 * Mech commands and autonomous attack identities live in their named catalogs.
 */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

/** Supplies Mechanist signet fragments to specialization composition. */
export const MECHANIST_SIGNET_SKILL_MECHANICS: Readonly<Record<string, Partial<Skill>>> = Object.freeze({
  [ID.RECTIFIER_SIGNET]: {
    castTimeMs: 520,
    cooldown: 30,
    effects: []
  },
  [ID.OVERCLOCK_SIGNET]: {
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.overclock-signet' } }],
    // Orders the active mech to channel Jade Buster Cannon; see `mechanist/mechanics/mech.ts`.

    castTimeMs: 0,
    cooldown: 90,
    effects: []
  },
  [ID.SHIFT_SIGNET]: {
    castTimeMs: 0,
    cooldown: 25,
    effects: []
  },
  [ID.SUPERCONDUCTING_SIGNET]: {
    castTimeMs: 880,
    interruptCommitMs: 560,
    cooldown: 30,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: Array.from({ length: 6 }, (_, index) => ({ atMs: 560 + index * 1000, coefficient: 2.4 / 6 })),
        intervalTimingScale: 'fixed',
        comboFields: [{ ownerId: 'engineer', fieldType: 'Lightning', duration: 5, startAnchor: 'event' }],
        name: 'Superconducting Signet',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        atMs: 560,
        applications: 6,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        atMs: 560,
        applications: 6,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        atMs: 560,
        applications: 6,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ])
  },
  [ID.FORCE_SIGNET]: {
    castTimeMs: 520,
    cooldown: 30,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Force Signet',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'knockback'
      }
    ]
  },
  [ID.BARRIER_SIGNET]: {
    castTimeMs: 360,
    cooldown: 30,
    effects: []
  }
});

/** Checks the normalized active loadout for a named Mechanist signet. */
export function selectedSignet(context: Gw2ModifierContext, id: number): boolean {
  return selectedSkillIdSet(context.config?.selectedSkillIds).has(id);
}

/** J-Drive keeps Shift's boon copying available while the signet recharges. */
export function shiftSignetPassive(context: EngineerRuntime, at: number): boolean {
  return (
    selectedSkillIdSet(context.config.selectedSkillIds).has(ID.SHIFT_SIGNET) &&
    signetPassiveAvailable(context.config, (context.cooldowns.get(ID.SHIFT_SIGNET) || 0) <= at)
  );
}

/** Passive modifiers respond to selection and recharge without requiring an activation. */
export const signetModifierRules: readonly Gw2ModifierRule[] = [
  {
    id: 'engineer.force-signet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: forceSignetDamage,
    when: (context) =>
      selectedSignet(context, ID.FORCE_SIGNET) &&
      signetPassiveAvailable(context, !context.timeline?.skillOnCooldownAt(ID.FORCE_SIGNET, context.time))
  },
  {
    id: 'engineer.superconducting-signet',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    // Ordinary signets lose their passive on recharge; J-Drive retains and improves it.
    amount: superconductingSignetDamage,
    when: (context) =>
      selectedSignet(context, ID.SUPERCONDUCTING_SIGNET) &&
      signetPassiveAvailable(context, !context.timeline?.skillOnCooldownAt(ID.SUPERCONDUCTING_SIGNET, context.time))
  }
];
/** Overclock's selected passive affects other signets; trait precedence is applied by the recharge owner. */
export function overclockSignetApplies(context: EngineerRuntime, skill: EngineerSkill): boolean {
  return (
    skill.id !== ID.OVERCLOCK_SIGNET &&
    Boolean(skill.categories?.some((category) => category.toLowerCase() === 'signet')) &&
    selectedSkillIdSet(context.config.selectedSkillIds).has(ID.OVERCLOCK_SIGNET)
  );
}

/** The skill owns ordinary Overclock availability; traits independently supply their stronger recharge rules. */
export const overclockRechargeRules: readonly RechargeRule<EngineerRuntimeState>[] = [
  {
    when: (context, skill) =>
      ordinaryOverclockEligible(context, skill) &&
      overclockSignetApplies(context, skill) &&
      (context.cooldowns.get(ID.OVERCLOCK_SIGNET) || 0) <= context.time,
    multiplier: { profile: PROFILE.overclock, field: 'rechargeMultiplier' }
  }
];
