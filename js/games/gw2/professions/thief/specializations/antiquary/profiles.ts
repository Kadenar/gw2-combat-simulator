import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { ANTIQUARY_THIEVES_GUILD_PROFILE } from '#gw2/professions/thief/specializations/antiquary/mechanics/thieves-guild.js';

import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

export const ANTIQUARY_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'thief.antiquary.resources',
  scuffle: 'thief.antiquary.scuffle',
  artifactWindows: 'thief.antiquary.artifact-windows',
  forgedSurfer: 'thief.antiquary.forged-surfer',
  forgedSurferMeticulous: 'thief.antiquary.forged-surfer-meticulous',
  cannonSuccess: 'thief.antiquary.cannon-success',
  cannonBackfire: 'thief.antiquary.cannon-backfire',
  mistburnProc: 'thief.antiquary.mistburn-proc',
  sunCrystalMeticulous: 'thief.antiquary.sun-crystal-meticulous'
});

export const ANTIQUARY_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  ANTIQUARY_THIEVES_GUILD_PROFILE,
  // Base artifact windows are intrinsic; Meticulous Custodian owns only their improvements.
  {
    id: ANTIQUARY_BALANCE_PROFILE_IDS.artifactWindows,
    name: 'Antiquary Artifact Windows',
    profileKind: 'mechanic',
    durationMultiplier: 10,
    minimumStacks: 8,
    playerStacks: 5,
    resourceGain: 3,
    chakRefundMaximum: 4,
    rechargeMultiplier: 0.2,
    effects: []
  },
  {
    id: ANTIQUARY_BALANCE_PROFILE_IDS.resources,
    name: 'Antiquary Artifact Resources',
    profileKind: 'mechanic',
    maximumStacks: 1,
    effects: []
  },
  {
    id: ANTIQUARY_BALANCE_PROFILE_IDS.scuffle,
    name: 'Skritt Scuffle',
    profileKind: 'skill-variant',
    parentId: ID.SKRITT_SCUFFLE,
    durationMultiplier: 15,
    pulseInterval: 3,
    effects: []
  },
  {
    id: ANTIQUARY_BALANCE_PROFILE_IDS.forgedSurfer,
    name: 'Forged Surfer Dash',
    profileKind: 'skill-variant',
    parentId: ID.FORGED_SURFER_DASH,
    initialDelay: 1,
    pulseInterval: 3,
    // Recasts add the selected buff duration, but never bank more than thirteen seconds of bomb drops.
    durationMultiplier: 10,
    maximumDuration: 13,
    effects: [
      { type: 'strike', name: 'Dash', coefficient: 2.4, hits: 1 },
      { type: 'condition', name: 'Dash', condition: 'Burning', stacks: 1, duration: 6 },
      { type: 'strike', name: 'Bomb', coefficient: 1.2, hits: 1 },
      { type: 'condition', name: 'Bomb', condition: 'Burning', stacks: 1, duration: 3.5 }
    ]
  },
  {
    id: ANTIQUARY_BALANCE_PROFILE_IDS.cannonSuccess,
    name: 'Stone Summit Cannon - Success',
    profileKind: 'skill-variant',
    parentId: ID.STONE_SUMMIT_CANNON,
    effects: [
      {
        type: 'strike',
        name: 'Stone Summit Cannon - Success',
        ticks: [
          { atMs: 440, coefficient: 1 },
          { atMs: 720, coefficient: 1 },
          { atMs: 1000, coefficient: 1 }
        ]
      },
      // Burning owns its application timing so deleting the strike does not delete this packet.
      {
        type: 'condition',
        name: 'Burning',
        condition: 'Burning',
        stacks: 1,
        duration: 3,
        applications: 3,
        atMs: 440,
        intervalMs: 280,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  {
    id: ANTIQUARY_BALANCE_PROFILE_IDS.cannonBackfire,
    name: 'Stone Summit Cannon - Backfire',
    profileKind: 'skill-variant',
    parentId: ID.STONE_SUMMIT_CANNON,
    initialDelay: 2,
    effects: [
      { type: 'strike', name: 'Stone Summit Cannon - Backfire', coefficient: 3, hits: 1 },
      {
        type: 'condition',
        name: 'Burning',
        condition: 'Burning',
        // Backfire applies the total at one impact; resolution expands its stacks.
        stacks: 3,
        duration: 4
      }
    ]
  },
  {
    id: ANTIQUARY_BALANCE_PROFILE_IDS.mistburnProc,
    name: 'Mistburn Mortar - Charged Strike',
    profileKind: 'skill-variant',
    parentId: ID.MISTBURN_MORTAR,
    effects: [{ type: 'condition', name: 'Burning', condition: 'Burning', stacks: 1, duration: 1 }]
  }
]);
