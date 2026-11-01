/** Canonical Core revenant skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { consumeSkillFlip, skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Skill, SkillDefinition } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

export const REVENANT_WEAPONS_GREATSWORD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.MIST_SWING]: {
    name: 'Mist Swing',
    description: 'Swing at enemies with your greatsword.',
    icon: 'https://render.guildwars2.com/file/026F28C66841AB712101E7CF5F455AA763FDA59D/2491614.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 400,
    // Recorded 365 ms casts land their strike and advance to Mist Slash on the 360 ms action frame.
    interruptCommitMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1,
        name: 'Mist Swing',
        actorType: ACTOR.PLAYER,
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.MIST_SLASH]: {
    name: 'Mist Slash',
    description: 'Swing your greatsword again, inflicting vulnerability.',
    icon: 'https://render.guildwars2.com/file/B804E1B5A7DBE19128CFE837143DDD49EC76532E/2491613.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 600,
    // The strike survives a committed aftercast cancel without shortening the normal auto chain.
    interruptCommitMs: 520,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Mist Slash',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 1,
        duration: 10,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.ARCING_MISTS]: {
    name: 'Arcing Mists',
    description: 'Cleave your foes, inflicting vulnerability and chilling them.',
    icon: 'https://render.guildwars2.com/file/97D0026DECBA06EB2C9E7042C30D613DBAA71E9E/2491606.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 680,
    // A committed cancel retains the strike and conditions during the remaining aftercast.
    interruptCommitMs: 480,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Arcing Mists',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 2,
        duration: 10,
        actorType: ACTOR.PLAYER
      }
    ])
  },
  [ID.MIST_UNLEASHED]: {
    name: 'Mist Unleashed',
    description: 'Hurl forces from the Mists in front of you, rendering foes vulnerable.',
    icon: 'https://render.guildwars2.com/file/CB669AA4946F5402D592EF7EE4C7D66069FE0108/2491615.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_2',
    cooldown: 3,
    energyCost: 5,
    castTimeMs: 520,
    // Commit the attack at 480 ms while reserving the remaining skill lockout.
    interruptCommitMs: 440,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1.6 }],
        name: 'Mist Unleashed',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 3,
        duration: 10,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.PHANTOMS_ONSLAUGHT]: {
    name: "Phantom's Onslaught",
    description: 'Rush toward your opponent, cleaving the area.',
    icon: 'https://render.guildwars2.com/file/59BA7946071713ECA0490726710D29E26FEB62FA/2491617.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_3',
    cooldown: 8,
    rechargeAnchor: 'castStart',
    // Recharge begins when the dash completes, while the follow-up strike is still casting.
    rechargeOffsetMs: 40,
    energyCost: 8,
    // Keep the 40 ms dash and the 600/400 ms follow-up on 40 ms action frames.

    castTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1,
        name: "Phantom's Onslaught",
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        boon: BOON.FURY,
        duration: 3,
        stacks: 1
      }
    ]
  },
  // The log's hit identity is not a second player input; import resolves it to the Greatsword activation.
  [ID.PHANTOMS_ONSLAUGHT_ID_62713]: {
    name: "Phantom's Onslaught",
    description: 'Rush towards your opponent, cleaving the area.',
    icon: 'https://render.guildwars2.com/file/59BA7946071713ECA0490726710D29E26FEB62FA/2491617.png',
    type: 'Proc',
    weapon: 'Greatsword',
    simulatorExcluded: true,
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 0,
    effects: []
  },
  [ID.IMPERIAL_GUARD]: {
    name: 'Imperial Guard',
    description:
      'Block incoming attacks for a prolonged duration, and ready a counterattack that deals increased damage based on the attacks blocked.',
    icon: 'https://render.guildwars2.com/file/4DC60B7DDD12C72BDAC25F18A064C2ABE54645ED/2491612.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_4',
    cooldown: 12,
    energyCost: 10,
    castTimeMs: 2000,
    defaultInterruptMs: 80,
    effects: [],
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [{ on: 'castStart', do: { type: 'revenant.imperial-guard' } }]
  },
  [ID.TRUE_STRIKE]: {
    name: 'True Strike',
    description:
      'Strike your foes with empowered energy. Deals increased damage based on attacks blocked by Imperial Guard.',
    icon: 'https://render.guildwars2.com/file/D5A565D79131641339353276C1FA6DEDDABEFA0D/2491624.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_4',
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'True Strike (vindicator) — Packet 1',
        actorType: ACTOR.PLAYER
      }
    ],
    // This declaration opens the channel-owned True Strike window below.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.TRUE_STRIKE } }]
  },
  [ID.ETERNITYS_REQUIEM]: {
    name: "Eternity's Requiem",
    description:
      'Whirl your greatsword, opening holes in the Mists that deal damage.\n\nDamage is reduced per target each time they are struck by this skill.',
    icon: 'https://render.guildwars2.com/file/A2BDB3281AA72F05D80A3855032C1807D059167E/2491611.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_5',
    cooldown: 15,
    energyCost: 10,
    castTimeMs: 840,
    // Preserve the impacts when the cast is interrupted after committing at 800 ms.
    interruptCommitMs: 800,
    effects: [
      {
        type: 'strike',
        name: "Eternity's Requiem",
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        // Committed impacts continue landing after the cast is interrupted.
        persistsAfterInterrupt: true,
        ticks: [
          // Median packet positions by hit rank, snapped independently to 40 ms action ticks.
          // Individual uses vary from six to ten target hits.
          { atMs: 320, coefficient: 1 },
          { atMs: 400, coefficient: 0.9 },
          { atMs: 520, coefficient: 0.8 },
          { atMs: 600, coefficient: 0.7 },
          { atMs: 640, coefficient: 0.6 },
          { atMs: 720, coefficient: 0.5 },
          { atMs: 840, coefficient: 0.4 },
          { atMs: 920, coefficient: 0.3 }
        ]
      },
      {
        type: 'strike',
        name: "Eternity's Requiem - Large Target",
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        // Target size is selected from the active target at acceptance, before any impact is queued.
        when: (runtime) => runtime.combat.targetHitboxSize() === 'large',
        ticks: [
          // Large targets overlap all nine random and five guaranteed impact areas.
          { atMs: 1000, coefficient: 0.3, name: "Eternity's Requiem" },
          { atMs: 1080, coefficient: 0.3, name: "Eternity's Requiem" },
          { atMs: 1160, coefficient: 0.3, name: "Eternity's Requiem" },
          { atMs: 1240, coefficient: 0.3, name: "Eternity's Requiem" },
          { atMs: 1320, coefficient: 0.3, name: "Eternity's Requiem" },
          { atMs: 1400, coefficient: 0.3, name: "Eternity's Requiem" }
        ]
      }
    ]
  }
});

/** Imperial Guard blocks from acceptance; its True Strike follow-up belongs to this exact channel. */
function startRevenantImperialGuard(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  // The follow-up window belongs to this channel; a later channel's rearm survives this deadline.
  runtime.armFlip(ID.TRUE_STRIKE, {
    availableAt: cast.start,
    expiresAt: canonicalTime(cast.effectiveEnd + 4),
    identity: cast.id,
    expiryPriority: 0
  });
  runtime.effects.emit({
    kind: 'packet',
    event: {
      ...{
        type: 'buff',
        at: cast.start,
        source: 'revenant',
        sourceId: cast.skill.id,
        actorType: ACTOR.PLAYER,
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        activationId: cast.id,
        name: 'Imperial Guard — Blocking',
        kind: 'blocking',
        duration: Math.max(0, cast.effectiveEnd - cast.start),
        stacks: 1
      },
      fixedDuration: true
    }
  });
}

/** A cancelled True Strike still consumes the window its Imperial Guard channel opened. */
function completeRevenantImperialGuard(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  if (cast.skill.id === ID.TRUE_STRIKE) consumeSkillFlip(runtime.profession.core.availableFlips, ID.TRUE_STRIKE);
}

/** Answer channel-specific gates before shared weapon-flip checks choose a generic denial. */
export function imperialGuardAvailability(
  runtime: MechanicQueriesOf<RevenantRuntime>,
  skill: Skill
): AvailabilityResult | undefined {
  const flips = runtime.profession.core.availableFlips;
  const now = runtime.time;

  if (skill.id === ID.TRUE_STRIKE && !skillFlipReady(flips[ID.TRUE_STRIKE], now))
    return denySkillCast(skill, 'revenant.imperial-guard-inactive', 'channel Imperial Guard first.');

  if (skill.id === ID.IMPERIAL_GUARD && skillFlipReady(flips[ID.TRUE_STRIKE], now))
    return denySkillCast(skill, 'revenant.true-strike-ready', 'use or let True Strike expire first.');
}

/** Imperial Guard owns activation and cancellation of the follow-up opened by its channel. */
export const greatswordLifecycle = {
  sideEffectHandlers: {
    'revenant.imperial-guard'(runtime, context) {
      if (context.kind === 'cast') startRevenantImperialGuard(runtime, context.cast);
    }
  },
  onCastCancel: completeRevenantImperialGuard
} satisfies RuntimeHooks<RevenantRuntimeState, RevenantSkill>;
