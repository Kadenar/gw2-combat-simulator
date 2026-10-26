import { ACTOR, COMBO_FINISHER, WEAPON, CONDITION } from '#gw2/platform/constants.js';
/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Separate measured projectile impacts from aftercast so recall and condition applications follow the live axe generation.
export const THIEF_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SPINNING_AXE_ID_71967]: {
    // The fast opener and slow follow-up share one tile and alternate through the standard chain controller.
    nextChainId: ID.SPINNING_AXE,
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
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
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
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
