/** Canonical Core thief skill definitions grouped by their GW2 owner. */
import { ACTOR, COMBO_FINISHER, CONDITION, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

// Separate measured projectile impacts from aftercast so recall and condition applications follow the live axe generation.
export const THIEF_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.SPINNING_AXE_ID_71967]: {
    name: 'Spinning Axe',
    description: 'Throw an axe that bleeds enemies and leaves a spinning axe on the ground.',
    icon: 'https://render.guildwars2.com/file/A00600C596C0A71A3776DF1D9E2AC2BE5F2E1229/3256391.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    // The fast opener and slow follow-up share one tile and alternate through the standard chain controller.
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    initiativeCost: 0,
    castTimeMs: 440,
    // This faster throw releases one action tick before its melee impact.
    interruptCommitMs: 360,
    effects: impactEffects(
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.8,
          hits: 1,
          name: 'Spinning Axe',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 3,
          actorType: ACTOR.PLAYER
        }
      ]
    ),
    // Throw ownership is independent of whether its outgoing strike can hit a target.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.ground-axe' } }]
  },
  [ID.SPINNING_AXE]: {
    name: 'Spinning Axe',
    description: 'Throw an axe that bleeds enemies and leaves a spinning axe on the ground.',
    icon: 'https://render.guildwars2.com/file/A00600C596C0A71A3776DF1D9E2AC2BE5F2E1229/3256391.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_1',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    initiativeCost: 0,
    // The slower axe releases before its aftercast; a launched projectile can still land after cancellation.
    castTimeMs: 760,
    interruptCommitMs: 480,
    effects: impactEffects(
      { atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.8,
          hits: 1,
          name: 'Spinning Axe',
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 3,
          actorType: ACTOR.PLAYER
        }
      ]
    ),
    // Throw ownership is independent of whether its outgoing strike can hit a target.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.ground-axe' } }]
  },
  [ID.CUNNING_SALVO]: {
    name: 'Cunning Salvo',
    description:
      'Throw an axe that explodes when it hits a target, crippling nearby enemies. Gain initiative if you strike an enemy.',
    icon: 'https://render.guildwars2.com/file/74E8A2686C3BBBC6E572C42A7824EC070C98F25E/3256393.png',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Axe',

    cooldown: 1,
    // The stealth attack's one-second reuse lockout is independent of Alacrity.
    rechargeIgnoresAlacrity: true,
    initiativeCost: 0,
    requiredMainHand: WEAPON.AXE,
    stealthAttack: true,
    // Salvo's impact precedes its aftercast; keep the projectile alive once it has been thrown.
    castTimeMs: 440,
    interruptCommitMs: 320,
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          reactions: [
            // Salvo refunds initiative only on a landed hit, including a returned axe.
            {
              on: 'damage.resolved',
              actor: ACTOR.PLAYER,
              packets: 'first',
              // Keep the impact refund independently editable without changing its hit requirement.
              do: {
                type: 'resourceGrant',
                id: 'initiative-refunded',
                label: 'Initiative refunded',
                resource: 'initiative',
                amount: 2
              }
            }
          ],
          coefficient: 1.5,
          hits: 1,
          name: 'Cunning Salvo',
          actorType: ACTOR.PLAYER,
          comboFinishers: [
            {
              ownerId: 'thief',
              finisherType: COMBO_FINISHER.BLAST
            }
          ]
        },
        {
          type: 'condition',
          condition: CONDITION.BLEEDING,
          stacks: 2,
          duration: 8,
          actorType: ACTOR.PLAYER
        },
        {
          type: 'condition',
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 4,
          actorType: ACTOR.PLAYER
        }
      ]
    ),
    // Throw ownership is independent of whether its outgoing strike can hit a target.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.ground-axe' } }]
  },
  [ID.VENOMOUS_VOLLEY]: {
    name: 'Venomous Volley',
    description: 'Throw a fan of poisonous axes that leaves spinning axes on the ground.',
    icon: 'https://render.guildwars2.com/file/9F1A55D17C0CDD42675FC758B797BBCFE610D4A7/3256394.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_2',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },

    cooldown: 0,
    initiativeCost: 3,
    castTimeMs: 600,
    // Committed projectiles survive interruption while the next input can start immediately.
    interruptCommitMs: 440,
    // The fan lands three projectiles, each carrying one third of the total strike and its own poison.
    effects: impactEffects(
      { atMs: 480, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 1.2,
          hits: 3,
          name: 'Venomous Volley',
          actorType: ACTOR.PLAYER,
          comboFinishers: [
            {
              ownerId: 'thief',
              finisherType: COMBO_FINISHER.PROJECTILE,
              chance: 0.2
            }
          ]
        },
        { type: 'condition', condition: CONDITION.POISONED, stacks: 3, duration: 2, actorType: ACTOR.PLAYER }
      ]
    ),
    // Throw ownership is independent of whether its outgoing strike can hit a target.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.ground-axe' } }]
  },
  [ID.HARROWING_STORM]: {
    dualWieldAttack: true,
    name: 'Harrowing Storm',
    description:
      'Teleport behind your target and drag any spinning axes back at your target. Returning axes also inflict torment, and enemies struck by a number of axes will be immobilized.',
    icon: 'https://render.guildwars2.com/file/7D952046DA4101E9C5B21F5FCC19040B2B08AD3B/3256389.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_3',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },

    shadowstepSkill: true,
    movementSkill: true,
    cooldown: 0,
    initiativeCost: 4,
    requiredMainHand: WEAPON.AXE,
    requiredOffHand: WEAPON.DAGGER,
    // Recall begins before aftercast finishes, so returning axes can overlap the next attack.
    castTimeMs: 560,
    interruptCommitMs: 440,
    // Return packets depend on the live axe pool and are emitted by the recall owner.
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castStart', do: { type: 'thief.recall-axes' } }]
  },
  [ID.RECALL_AXES]: {
    name: 'Recall Axes',
    description:
      'Pull spinning axes to your target. Axes deal increased strike damage, and enemies struck by a number of axes will be immobilized.',
    icon: 'https://render.guildwars2.com/file/36E32348F31BDE22EF2DB81209D204A81976C2F1/3256395.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_3',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },

    cooldown: 0,
    initiativeCost: 4,
    requiredMainHand: WEAPON.AXE,
    requiredOffHand: false,
    castTimeMs: 360,
    // Return packets depend on the live axe pool and are emitted by the recall owner.
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castStart', do: { type: 'thief.recall-axes' } }]
  },
  [ID.ORCHESTRATED_ASSAULT]: {
    dualWieldAttack: true,
    name: 'Orchestrated Assault',
    description:
      'Pull spinning axes to your target. Axes deal increased strike damage, and enemies struck by a number of axes will be immobilized.',
    icon: 'https://render.guildwars2.com/file/EDAA6A645279109A6FD7064A4439ECE3DDBE05F4/3256390.png',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_3',
    cost: {
      resource: 'initiative',
      skillAmount: 'initiativeCost',
      spendOn: 'castStart'
    },

    cooldown: 0,
    initiativeCost: 4,
    requiredMainHand: WEAPON.AXE,
    requiredOffHand: WEAPON.PISTOL,
    castTimeMs: 560,
    // A committed recall survives interruption and keeps its remaining cast lockout.
    interruptCommitMs: 520,
    retainsCastLockoutAfterInterrupt: true,
    // Return packets depend on the live axe pool and are emitted by the recall owner.
    effects: [],
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castStart', do: { type: 'thief.recall-axes' } }]
  }
});
