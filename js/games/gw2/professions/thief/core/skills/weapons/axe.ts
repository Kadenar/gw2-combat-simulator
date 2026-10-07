/** Canonical Core thief skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Separate measured projectile impacts from aftercast so recall and condition applications follow the live axe generation.
export const THIEF_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.VENOMOUS_VOLLEY]: {
    // Throw ownership is independent of whether its outgoing strike can hit a target.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.ground-axe' } }],
    castTimeMs: 600,
    // Committed projectiles survive interruption while the next input can start immediately.
    interruptCommitMs: 440,
    cooldown: 0,
    initiativeCost: 3,
    // The fan lands three projectiles, each carrying one third of the total strike and its own poison.
    effects: impactEffects(
      { atMs: 480, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 1.2,
          hits: 3,
          name: 'Venomous Volley',
          actorType: 'player',
          comboFinishers: [
            { ownerId: 'thief', finisherType: 'Projectile', chance: 0.2, ambiguousFieldSelection: 'oldest' }
          ]
        },
        { type: 'condition', condition: 'Poisoned', stacks: 3, duration: 2, actorType: 'player' }
      ]
    )
  },
  [ID.SPINNING_AXE]: {
    // Throw ownership is independent of whether its outgoing strike can hit a target.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.ground-axe' } }],
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    // The slower axe releases before its aftercast; a launched projectile can still land after cancellation.
    castTimeMs: 760,
    interruptCommitMs: 480,
    cooldown: 0,
    initiativeCost: 0,
    effects: impactEffects(
      { atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.8,
          hits: 1,
          name: 'Spinning Axe',
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Bleeding',
          stacks: 1,
          duration: 3,
          actorType: 'player'
        }
      ]
    )
  },
  [ID.HARROWING_STORM]: {
    shadowstepSkill: true,
    movementSkill: true,
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castStart', do: { type: 'thief.recall-axes' } }],
    // Recall begins before aftercast finishes, so returning axes can overlap the next attack.
    castTimeMs: 560,
    interruptCommitMs: 440,
    cooldown: 0,
    initiativeCost: 4,
    // Return packets depend on the live axe pool and are emitted by the recall owner.
    effects: [],
    requiredMainHand: 'Axe',
    requiredOffHand: 'Dagger'
  },
  [ID.RECALL_AXES]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castStart', do: { type: 'thief.recall-axes' } }],
    castTimeMs: 360,
    cooldown: 0,
    initiativeCost: 4,
    // Return packets depend on the live axe pool and are emitted by the recall owner.
    effects: [],
    requiredMainHand: 'Axe',
    requiredOffHand: false
  },
  [ID.ORCHESTRATED_ASSAULT]: {
    // The skill owns this transition at successful commitment.
    sideEffects: [{ on: 'castStart', do: { type: 'thief.recall-axes' } }],
    castTimeMs: 560,
    // A committed recall survives interruption and keeps its remaining cast lockout.
    interruptCommitMs: 520,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 0,
    initiativeCost: 4,
    // Return packets depend on the live axe pool and are emitted by the recall owner.
    effects: [],
    requiredMainHand: 'Axe',
    requiredOffHand: 'Pistol'
  },
  [ID.SPINNING_AXE_ID_71967]: {
    // The fast opener and slow follow-up share one tile and alternate through the standard chain controller.
    nextChainId: ID.SPINNING_AXE,
    // Throw ownership is independent of whether its outgoing strike can hit a target.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.ground-axe' } }],
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 440,
    // This faster throw releases one action tick before its melee impact.
    interruptCommitMs: 360,
    cooldown: 0,
    initiativeCost: 0,
    effects: impactEffects(
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.8,
          hits: 1,
          name: 'Spinning Axe',
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Bleeding',
          stacks: 1,
          duration: 3,
          actorType: 'player'
        }
      ]
    )
  },
  [ID.CUNNING_SALVO]: {
    // Throw ownership is independent of whether its outgoing strike can hit a target.
    sideEffects: [{ on: 'castCommit', do: { type: 'thief.ground-axe' } }],
    // Salvo's impact precedes its aftercast; keep the projectile alive once it has been thrown.
    castTimeMs: 440,
    interruptCommitMs: 320,
    cooldown: 1,
    // The stealth attack's one-second reuse lockout is independent of Alacrity.
    rechargeIgnoresAlacrity: true,
    initiativeCost: 0,
    effects: impactEffects(
      { atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          reactions: [
            // Salvo refunds initiative only on a landed hit, including a returned axe.
            {
              on: 'damage.resolved',
              actor: 'player',
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
          actorType: 'player',
          comboFinishers: [
            {
              ownerId: 'thief',
              finisherType: 'Blast',
              ambiguousFieldSelection: 'oldest'
            }
          ],
          metadata: {}
        },
        {
          type: 'condition',
          condition: 'Bleeding',
          stacks: 2,
          duration: 8,
          actorType: 'player'
        },
        {
          type: 'condition',
          condition: 'Crippled',
          stacks: 1,
          duration: 4,
          actorType: 'player'
        }
      ]
    ),
    requiredMainHand: 'Axe',
    stealthAttack: true
  }
});
