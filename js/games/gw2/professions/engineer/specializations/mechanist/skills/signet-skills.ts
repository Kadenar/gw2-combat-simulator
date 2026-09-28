import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { MODIFIER_TARGET, type Gw2ModifierRule, type Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MECHANIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/mechanist/profiles.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';
/**
 * Owns Mechanist signet skill fragments.
 * Mech commands and autonomous attack identities live in their named catalogs.
 */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

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
export function selectedSignet(context: Gw2ModifierContext, name: string): boolean {
  return selectedSkillNameSet(context.config?.selectedSkills).has(name);
}

/** J-Drive keeps Shift's boon copying available while the signet recharges. */
export function shiftSignetPassive(context: EngineerRuntime, at: number): boolean {
  return (
    selectedSkillNameSet(context.config.selectedSkills).has('Shift Signet') &&
    (hasTrait(context.config, TRAIT.MECH_CORE_J_DRIVE) || (context.cooldowns.get(ID.SHIFT_SIGNET) || 0) <= at)
  );
}

/** Passive modifiers respond to selection and recharge without requiring an activation. */
export const signetModifierRules: readonly Gw2ModifierRule[] = [
  {
    id: 'engineer.force-signet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: (context) => {
      const forceSignetProfile = requireBalanceProfileFromContext(context, PROFILE.forceSignet);
      return hasTrait(context, TRAIT.MECH_CORE_J_DRIVE)
        ? balanceProfileNumber(forceSignetProfile, 'activeDamageIncrease')
        : balanceProfileNumber(forceSignetProfile, 'damageIncrease');
    },
    when: (context) =>
      selectedSignet(context, 'Force Signet') &&
      (hasTrait(context, TRAIT.MECH_CORE_J_DRIVE) ||
        !context.timeline?.skillOnCooldownAt(ID.FORCE_SIGNET, context.time))
  },
  {
    id: 'engineer.superconducting-signet',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    // Ordinary signets lose their passive on recharge; J-Drive retains and improves it.
    amount: (context) => (hasTrait(context, TRAIT.MECH_CORE_J_DRIVE) ? 0.12 : 0.1),
    when: (context) =>
      selectedSignet(context, 'Superconducting Signet') &&
      (hasTrait(context, TRAIT.MECH_CORE_J_DRIVE) ||
        !context.timeline?.skillOnCooldownAt(ID.SUPERCONDUCTING_SIGNET, context.time))
  }
];
/** Overclock's selected passive affects other signets; trait precedence is applied by the recharge owner. */
export function overclockSignetApplies(context: EngineerRuntime, skill: EngineerSkill): boolean {
  return (
    skill.id !== ID.OVERCLOCK_SIGNET &&
    Boolean(skill.categories?.some((category) => category.toLowerCase() === 'signet')) &&
    selectedSkillNameSet(context.config.selectedSkills).has('Overclock Signet')
  );
}
