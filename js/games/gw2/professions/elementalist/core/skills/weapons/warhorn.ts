/**
 * Warhorn weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers the off-hand slot 4 and 5 skills across all four attunements. Most entries are
 * long-lived pulsing effects, so their strike and condition packets are authored as shared
 * offset tables and land well after the cast ends. Declarative data merged into the Core
 * skill catalog by `core/skills/index.ts`.
 */
import {
  boonKey,
  buffMatchesAudience,
  durationStackingBoonCapSeconds,
  remainingDurationStackSeconds
} from '#gw2/platform/combat/boons.js';
import {
  ACTOR,
  AURA,
  BOON,
  COMBO_FIELD,
  COMBO_FINISHER,
  CONDITION,
  CONTROL,
  RECIPIENT,
  STATUS,
  WEAPON
} from '#gw2/platform/constants.js';
import { conditionTimeline, impactEffects, strikeTimeline } from '#gw2/platform/effects/authoring.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { requireSkill } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import { withSmallHitboxCap } from '#gw2/professions/elementalist/core/skills/hitbox.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime, ElementalistSkill } from '#gw2/professions/elementalist/types.js';
import { isTimeInWindow } from '#kernel/core/clock.js';

// Layers keep same-time Vulnerability behind its matching Lightning Orb strike while retaining multi-tick effects.
const LIGHTNING_ORB_STRIKE_TICK_LAYERS = [
  [
    { atMs: 400, coefficient: 0.8 },
    { atMs: 680, coefficient: 0.72 },
    { atMs: 960, coefficient: 0.64 },
    { atMs: 1240, coefficient: 0.56 },
    { atMs: 1520, coefficient: 0.48 },
    { atMs: 1800, coefficient: 0.4 },
    { atMs: 2080, coefficient: 0.32 },
    { atMs: 2360, coefficient: 0.24 },
    { atMs: 2760, coefficient: 0.16 },
    { atMs: 3160, coefficient: 0.08 },
    { atMs: 3600, coefficient: 0.05 },
    { atMs: 4000, coefficient: 0.05 },
    { atMs: 4400, coefficient: 0.05 },
    { atMs: 4800, coefficient: 0.05 },
    { atMs: 5080, coefficient: 0.05 },
    { atMs: 5400, coefficient: 0.05 },
    { atMs: 5800, coefficient: 0.05 },
    { atMs: 6240, coefficient: 0.05 },
    { atMs: 6640, coefficient: 0.05 }
  ],
  [{ atMs: 4800, coefficient: 0.05 }]
] as const;

// Wildfire's two overlap pulses after its regular field pulses reach only large targets; strikes and Burning share them.
const WILDFIRE_OVERLAP_TICKS = [8560, 9560].map((atMs) => ({ atMs, metadata: { largeHitboxOnly: true } }));

// Dust Storm pulses eight times on roughly one-second intervals; strike, Bleeding, and blind
// applications all reuse these offsets.
const DUST_STORM_TICK_OFFSETS_MS = [1560, 2640, 3560, 4640, 5560, 6640, 7560, 8640] as const;

/**
 * Complete warhorn declarations own presentation, cast timelines, emitted packets, and combo participation.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_WARHORN_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ElementalistSkill>>> = {
  [ID.HEAT_SYNC]: {
    name: 'Heat Sync',
    icon: 'https://render.guildwars2.com/file/6B4C0B3DFDB4FDDCB22552719D980D9E4AE2C9D1/1029998.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.WARHORN,
    attunement: 'Fire',

    cooldown: 30,
    skillFamily: 'Weapon skill',
    castTimeMs: 840,
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'boon', boon: BOON.FURY, stacks: 1, duration: 10 },
      { type: 'boon', boon: BOON.MIGHT, stacks: 3, duration: 10 }
    ])
  },
  // Lays an 8s fire field and burns through seven packets, plus two packets on large targets.
  [ID.WILDFIRE]: {
    name: 'Wildfire',
    icon: 'https://render.guildwars2.com/file/9E33D36DB142E4F9C7C21CA9CD06D76B000FE506/1029999.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.WARHORN,
    attunement: 'Fire',

    cooldown: 30,
    skillFamily: 'Weapon skill',
    castTimeMs: 840,
    // Commit the field before the remaining cast animation ends.
    interruptCommitMs: 720,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.FIRE,
        duration: 8,
        startAnchor: 'castEnd'
      }
    ],
    // Committed field pulses survive interruption. The regular pulses repeat once per second; the calibrated
    // large-target overlap pulses are a separate timeline that field extensions do not lengthen.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
      { type: 'strike', coefficient: 0.44, damageKind: 'field-tick', atMs: 1560, applications: 7, intervalMs: 1000 },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 3,
        atMs: 1560,
        applications: 7,
        intervalMs: 1000
      },
      strikeTimeline(
        WILDFIRE_OVERLAP_TICKS.map((tick) => ({
          ...tick,
          coefficient: 0.44,
          damageKind: 'field-tick'
        }))
      ),
      conditionTimeline(
        WILDFIRE_OVERLAP_TICKS.map((tick) => ({
          ...tick,
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 3
        })),
        {}
      )
    ])
  },
  [ID.TIDAL_SURGE]: {
    name: 'Tidal Surge',
    icon: 'https://render.guildwars2.com/file/466520602A5AFD1D46454AAED74B5849C40F6FBA/1030000.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.WARHORN,
    attunement: 'Water',

    cooldown: 30,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    effects: impactEffects({ atMs: 920, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.BLAST
          }
        ],

        canCrit: true
      },
      { type: 'control', applications: 1, controlKind: CONTROL.KNOCKBACK }
    ])
  },
  // Contributes only a water combo field; no strike or condition packets are modelled.
  [ID.WATER_GLOBE]: {
    name: 'Water Globe',
    icon: 'https://render.guildwars2.com/file/5CFE011C13BB571BB2735FF729A1FB0F6A31BAD7/1030001.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.WARHORN,
    attunement: 'Water',

    cooldown: 30,
    skillFamily: 'Weapon skill',
    castTimeMs: 840,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.WATER,
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    effects: []
  },
  [ID.CYCLONE]: {
    name: 'Cyclone',
    icon: 'https://render.guildwars2.com/file/3B78057FC723254A0BCDAEAC0D9D49E290F6F9D8/1029994.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.WARHORN,
    attunement: 'Air',

    cooldown: 25,
    skillFamily: 'Weapon skill',
    castTimeMs: 800,
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.9, canCrit: true },
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        // Share this support boon with affected allies within its recipient cap.
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 3 },
        stacks: 1,
        duration: 10
      },
      { type: 'buff', kind: STATUS.SUPERSPEED, stacks: 1, duration: 2.5 },
      { type: 'control', applications: 1, controlKind: CONTROL.PULL }
    ])
  },
  // Travelling orb whose damage decays over nineteen hits down to a 0.05 floor; each hit also
  // applies one Vulnerability stack, and the second layer adds the extra simultaneous 4800ms hit.
  [ID.LIGHTNING_ORB]: withSmallHitboxCap(
    {
      name: 'Lightning Orb',
      icon: 'https://render.guildwars2.com/file/F94EF9AA5A3B073807426D499F6353C91F7BC09F/1029995.png',

      type: 'Weapon',
      slot: 'Weapon_5',
      weapon: WEAPON.WARHORN,
      attunement: 'Air',

      cooldown: 25,
      skillFamily: 'Weapon skill',
      castTimeMs: 440,
      effects: LIGHTNING_ORB_STRIKE_TICK_LAYERS.flatMap((ticks) => [
        strikeTimeline(ticks, { timingAnchor: 'castStart', timingScale: 'cast' }),
        conditionTimeline(
          ticks.map(({ atMs }) => ({
            atMs,
            condition: CONDITION.VULNERABILITY,
            stacks: 1,
            duration: 10
          })),
          { timingAnchor: 'castStart', timingScale: 'cast' }
        )
      ])
    },
    11
  ),
  // Grants Magnetic Aura for 4s alongside Protection; the aura is what other skills transmute.
  [ID.SAND_SQUALL]: {
    name: 'Sand Squall',
    icon: 'https://render.guildwars2.com/file/7B047DE80C026DCF420E43DD16D80409E8C679A4/1029996.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.WARHORN,
    attunement: 'Earth',

    cooldown: 30,
    skillFamily: 'Weapon skill',
    castTimeMs: 840,
    comboFinishers: [
      {
        ownerId: 'elementalist',
        finisherType: COMBO_FINISHER.BLAST
      }
    ],
    effects: [
      { type: 'aura', aura: AURA.MAGNETIC, duration: 4 },
      {
        type: 'boon',
        boon: BOON.PROTECTION,
        // Share this support boon with affected allies within its recipient cap.
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        stacks: 1,
        duration: 2,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Eight pulses that each strike, bleed, and blind, with Resistance granted on the first pulse.
  [ID.DUST_STORM]: withSmallHitboxCap(
    {
      name: 'Dust Storm',
      icon: 'https://render.guildwars2.com/file/210E23C1C2BE30F21C1C98C6FF4B053DFFC9BA1C/1029997.png',

      type: 'Weapon',
      slot: 'Weapon_5',
      weapon: WEAPON.WARHORN,
      attunement: 'Earth',

      cooldown: 30,
      skillFamily: 'Weapon skill',
      castTimeMs: 840,
      // Share pulse timing without changing the hitbox pairing or the independent Resistance grant.
      effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
        strikeTimeline(
          DUST_STORM_TICK_OFFSETS_MS.map((atMs) => ({
            atMs,
            coefficient: 0.3
          }))
        ),
        conditionTimeline(
          DUST_STORM_TICK_OFFSETS_MS.map((atMs) => ({
            atMs,
            condition: CONDITION.BLEEDING,
            stacks: 2,
            duration: 10
          })),
          {}
        ),
        ...DUST_STORM_TICK_OFFSETS_MS.map((atMs) => ({
          type: 'condition' as const,
          condition: CONDITION.BLINDNESS,
          stacks: 1,
          duration: 2,
          atMs,
          applications: 1
        })),
        {
          type: 'boon',
          boon: BOON.RESISTANCE,
          // Share this support boon with affected allies within its recipient cap.
          audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
          stacks: 1,
          duration: 4,
          atMs: 1560
        }
      ])
    },
    6
  )
};

/** Copy each boon after its self grant, preserving live durations without console assumptions or another self grant. */
export function shareHeatSyncBoon(runtime: ElementalistRuntime, event: Gw2ResolverEvent): void {
  // The self grant is already recorded when this reaction runs; ally copies cannot trigger another share.
  if (
    event.skillId !== ID.HEAT_SYNC ||
    event.actorType !== ACTOR.PLAYER ||
    !event.resolvedAudience?.includesSelf ||
    (event.kind !== boonKey(BOON.MIGHT) && event.kind !== boonKey(BOON.FURY))
  )
    return;

  const kind = event.kind;
  // Read accepted grants to exclude console assumptions and retain each Might application's expiry.
  // boonSnapshot includes configured boons and collapses Might to one duration, so it cannot preserve this copy.
  const applications = runtime.combat
    .boonApplications(kind)
    // SELF checks includesSelf, retaining party grants received by the player.
    .filter((application) => buffMatchesAudience(application, RECIPIENT.SELF));

  // Fury adds durations into one capped pool; Might stacks retain their individual remaining lifetimes.
  const copies =
    kind === boonKey(BOON.FURY)
      ? [
          {
            stacks: 1,
            duration: remainingDurationStackSeconds(applications, event.at, {
              maximum: durationStackingBoonCapSeconds(kind),
              ordered: true
            })
          }
        ]
      : applications
          .filter((application) => isTimeInWindow(event.at, application.at, application.expiresAt))
          .map((application) => ({ stacks: application.stacks, duration: application.expiresAt - event.at }))
          .sort((left, right) => right.duration - left.duration);

  // At the Might cap, copy the longest-lived stacks rather than extending shorter stacks to match them.
  let remainingStacks = kind === boonKey(BOON.MIGHT) ? 25 : 1;
  for (const copy of copies) {
    const stacks = Math.min(remainingStacks, copy.stacks);

    if (!(stacks > 0 && copy.duration > 0)) continue;

    remainingStacks -= stacks;
    // Computed copies use the same profile path while preserving their remaining duration.
    runtime.effects.emit(
      elementalistBuffRequest({
        skill: requireSkill(runtime.helpers, ID.HEAT_SYNC),
        at: event.at,
        source: event.source,
        sourceId: ID.HEAT_SYNC,
        actorType: ACTOR.PLAYER,
        skillId: ID.HEAT_SYNC,
        skillName: event.skillName,
        activationId: event.activationId,
        kind,
        stacks,
        duration: copy.duration,
        // Remaining durations already include boon-duration bonuses; sharing must not scale them again.
        fixedDuration: true,
        // The player received the original grant and must not receive the copied boons too.
        audience: { recipients: RECIPIENT.PARTY, affectsSelf: false, maximumRecipients: 5 }
      })
    );
  }
}
