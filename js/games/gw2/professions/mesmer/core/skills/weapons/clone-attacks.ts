import { CONDITION, WEAPON } from '#gw2/platform/constants.js';
import type { MesmerCloneAttack } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { axeCloneAttack } from '#gw2/professions/mesmer/core/skills/weapons/axe-clone.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

/** Dagger clones retain their own attack strength, payloads, and cadence independently of player attacks. */
const daggerCloneAttack = {
  id: ID.FLYING_CUTTER,
  name: 'Clone: Flying Cutter',
  coefficient: 0.5,
  hits: 1,
  // Include the clone's startup and projectile travel before its first impact.
  firstAttackDelay: 1.56,
  interval: 1.6,
  weaponStrength: 26.5
} satisfies MesmerCloneAttack;

/** Greatsword clones retain their own attack strength, payloads, and cadence independently of player attacks. */
const greatswordCloneAttack = {
  id: ID.SPATIAL_SURGE,
  firstAttackDelay: 1.14,
  ticks: [
    { atMs: 520, coefficient: 0.8 / 3 },
    { atMs: 760, coefficient: 0.8 / 3 },
    { atMs: 1000, coefficient: 0.8 / 3 }
  ],
  interval: 3.44,
  weaponStrength: 26.5
} satisfies MesmerCloneAttack;

/** Rifle clones retain their own attack strength, payloads, and cadence independently of player attacks. */
const rifleCloneAttack = {
  id: ID.FRIENDLY_FIRE,
  coefficient: 0.5,
  hits: 1,
  interval: 1.2,
  weaponStrength: 26.5
} satisfies MesmerCloneAttack;

/** Scepter clones retain their own attack strength, payloads, and cadence independently of player attacks. */
const scepterCloneAttack = {
  id: ID.ETHER_BOLT,
  name: 'Clone: Ether Bolt',
  coefficient: 0.5,
  hits: 1,
  interval: 2,
  weaponStrength: 34,
  conditions: [
    {
      type: 'condition',
      condition: CONDITION.TORMENT,
      duration: 4,
      stacks: 1
    }
  ]
} satisfies MesmerCloneAttack;

/** Spear clones retain their own attack strength, payloads, and cadence independently of player attacks. */
const spearCloneAttack = {
  weaponStrength: 26.3,
  // Clone startup and the pause before restarting the chain prevent excess Sharper Images procs.
  firstAttackDelay: 1.68,
  sequence: [
    {
      id: ID.PSYCUT,
      name: 'Clone: Psycut',
      coefficient: 1,
      hits: 1,
      interval: 1.64
    },
    {
      id: ID.PSYSTRIKE,
      name: 'Clone: Psystrike',
      coefficient: 1,
      hits: 1,
      interval: 0.64
    },
    {
      id: ID.MIND_PIERCE,
      name: 'Clone: Mind Pierce',
      // The clone finisher retains the clone's basic strike strength, unlike the player's finisher.
      coefficient: 1,
      hits: 1,
      interval: 0.92
    }
  ]
} satisfies MesmerCloneAttack;

/** Staff clones retain their own attack strength, payloads, and cadence independently of player attacks. */
const staffCloneAttack = {
  id: ID.WINDS_OF_CHAOS,
  name: 'Clone: Winds of Chaos',
  coefficient: 0.49,
  hits: 2,
  atMs: 0,
  // Delay the first impact to include clone startup and projectile travel observed in combat logs.
  firstAttackDelay: 1.96,
  interval: 2.24,
  weaponStrength: 26,
  conditions: [
    {
      type: 'condition',
      condition: CONDITION.TORMENT,
      duration: 2,
      stacks: 1
    },
    {
      type: 'condition',
      condition: CONDITION.CONFUSION,
      duration: 2,
      stacks: 1
    }
  ]
} satisfies MesmerCloneAttack;

/** Sword clones retain their own attack strength, payloads, and cadence independently of player attacks. */
const swordCloneAttack = {
  weaponStrength: 20.5,
  firstAttackDelay: 2.48,
  sequence: [
    {
      id: ID.MIND_SLASH,
      name: 'Clone: Mind Slash',
      coefficient: 0.75,
      hits: 1,
      interval: 0.8266666666666667
    },
    {
      id: ID.MIND_GASH,
      name: 'Clone: Mind Gash',
      coefficient: 0.75,
      hits: 1,
      interval: 0.8266666666666667
    },
    {
      id: ID.MIND_STAB,
      name: 'Clone: Mind Stab',
      coefficient: 0.12,
      hits: 1,
      interval: 0.8266666666666667
    }
  ]
} satisfies MesmerCloneAttack;

/** Shared clone execution selects weapon-owned data without importing weapon execution modules. */
export const MESMER_CORE_CLONE_ATTACKS: Readonly<Record<string, MesmerCloneAttack>> = Object.freeze({
  [WEAPON.AXE]: axeCloneAttack,
  [WEAPON.DAGGER]: daggerCloneAttack,
  [WEAPON.GREATSWORD]: greatswordCloneAttack,
  [WEAPON.RIFLE]: rifleCloneAttack,
  [WEAPON.SCEPTER]: scepterCloneAttack,
  [WEAPON.SPEAR]: spearCloneAttack,
  [WEAPON.STAFF]: staffCloneAttack,
  [WEAPON.SWORD]: swordCloneAttack
});
