/**
 * Raw Core skill mechanics. Generated once from the characterized
 * pre-migration table; this file is now the runtime source owner.
 */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type { Skill, SkillFragment, SkillId } from '#gw2/platform/engine/types.js';

import { MESMER_PROFESSION_SKILLS_SKILL_MECHANICS } from '#gw2/content/professions/mesmer/core/skills/profession-skills.js';
import { MESMER_SLOT_SKILLS_SKILL_MECHANICS } from '#gw2/content/professions/mesmer/core/skills/slot-skills.js';
import { MESMER_WEAPONS_AXE_SKILL_MECHANICS } from '#gw2/content/professions/mesmer/core/skills/weapons/axe.js';
import { MESMER_WEAPONS_DAGGER_SKILL_MECHANICS } from '#gw2/content/professions/mesmer/core/skills/weapons/dagger.js';
import { MESMER_WEAPONS_FOCUS_SKILL_MECHANICS } from '#gw2/content/professions/mesmer/core/skills/weapons/focus.js';
import { MESMER_WEAPONS_GREATSWORD_SKILL_MECHANICS } from '#gw2/content/professions/mesmer/core/skills/weapons/greatsword.js';
import { MESMER_WEAPONS_PISTOL_SKILL_MECHANICS } from '#gw2/content/professions/mesmer/core/skills/weapons/pistol.js';
import { MESMER_WEAPONS_RIFLE_SKILL_MECHANICS } from '#gw2/content/professions/mesmer/core/skills/weapons/rifle.js';
import { MESMER_WEAPONS_SCEPTER_SKILL_MECHANICS } from '#gw2/content/professions/mesmer/core/skills/weapons/scepter.js';
import { MESMER_WEAPONS_SHIELD_SKILL_MECHANICS } from '#gw2/content/professions/mesmer/core/skills/weapons/shield.js';
import { MESMER_WEAPONS_SPEAR_SKILL_MECHANICS } from '#gw2/content/professions/mesmer/core/skills/weapons/spear.js';
import { MESMER_WEAPONS_STAFF_SKILL_MECHANICS } from '#gw2/content/professions/mesmer/core/skills/weapons/staff.js';
import { MESMER_WEAPONS_SWORD_SKILL_MECHANICS } from '#gw2/content/professions/mesmer/core/skills/weapons/sword.js';
import { MESMER_WEAPONS_TORCH_SKILL_MECHANICS } from '#gw2/content/professions/mesmer/core/skills/weapons/torch.js';

import type { MesmerSkill } from '#gw2/content/professions/mesmer/data/types.js';

export const MESMER_CORE_SKILL_MECHANICS: Readonly<Record<SkillId, SkillFragment>> = Object.freeze({
  ...MESMER_PROFESSION_SKILLS_SKILL_MECHANICS,
  ...MESMER_SLOT_SKILLS_SKILL_MECHANICS,
  ...MESMER_WEAPONS_AXE_SKILL_MECHANICS,
  ...MESMER_WEAPONS_DAGGER_SKILL_MECHANICS,
  ...MESMER_WEAPONS_FOCUS_SKILL_MECHANICS,
  ...MESMER_WEAPONS_GREATSWORD_SKILL_MECHANICS,
  ...MESMER_WEAPONS_PISTOL_SKILL_MECHANICS,
  ...MESMER_WEAPONS_RIFLE_SKILL_MECHANICS,
  ...MESMER_WEAPONS_SCEPTER_SKILL_MECHANICS,
  ...MESMER_WEAPONS_SHIELD_SKILL_MECHANICS,
  ...MESMER_WEAPONS_SPEAR_SKILL_MECHANICS,
  ...MESMER_WEAPONS_STAFF_SKILL_MECHANICS,
  ...MESMER_WEAPONS_SWORD_SKILL_MECHANICS,
  ...MESMER_WEAPONS_TORCH_SKILL_MECHANICS
});

export const MESMER_CORE_SUPPLEMENTAL_SKILL_MECHANICS: Readonly<Record<SkillId, SkillFragment>> = Object.freeze({
  [ID.POWER_SPIKE]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 10,
    ammo: 2,
    armedAtStart: true,
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.33,
        hits: 1,
        name: 'Damage',
        actorType: 'player'
      },
      // Apply the live debuff with the instant strike so reconstructed Mantra casts update target state.
      {
        type: 'condition',
        condition: 'Vulnerability',
        duration: 8,
        stacks: 5
      }
    ]
  },
  [ID.COUNTERSPELL]: {
    castTimeMs: 900,
    // The projectile and clone commit on the 360 ms Quickness frame, but weapon-swap cancellation retains the full cast lane.
    interruptCommitMs: 360,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 0,
    resource: {
      mode: 'add',
      count: 1,
      timingAnchor: 'castStart',
      atMs: 360
    },
    flipDuration: 2,
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 322, coefficient: 0.1 }],
        name: 'Projectile',
        actorType: 'player',
        weapon: 'scepter',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        // Confusion lands with the committed projectile so a weapon-swap cancellation does not discard it.
        ticks: [{ atMs: 322, condition: 'Confusion', stacks: 5, duration: 7 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SWAP]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 0,
    flipDuration: 5,
    flipDelay: 0,
    implemented: true,
    effects: []
  },
  [ID.COUNTER_BLADE]: {
    castTimeMs: 1020,
    cooldown: 0,
    flipDuration: 3,
    flipDelay: 0,
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 484, coefficient: 0.1 }],
        name: 'Damage',
        actorType: 'player',
        weapon: 'sword',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.INTO_THE_VOID]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 0,
    flipDuration: 5,
    flipDelay: 1,
    implemented: true,
    effects: []
  },
  [ID.DIMENSIONAL_APERTURE]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 0,
    flipDuration: 3,
    flipDelay: 0,
    parentCooldownIncrease: 0.5,
    implemented: true,
    effects: []
  },
  [ID.ABSTRACTION]: {
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 0,
    flipDuration: 2,
    flipDelay: 0,
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Detonation',
        actorType: 'player',
        weapon: 'rifle'
      }
    ]
  }
});

export const MESMER_CORE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.SWAP_WEAPONS,
    name: 'Swap Weapons',
    description: 'Swap between weapon sets. The swap has a 10-second recharge.',
    icon: 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    type: 'Action',
    slot: 'Action',
    castTimeMs: 0,
    rechargeAnchor: 'castStart',
    cooldown: 10,
    implemented: true,
    effects: []
  }
] satisfies readonly MesmerSkill[]);
