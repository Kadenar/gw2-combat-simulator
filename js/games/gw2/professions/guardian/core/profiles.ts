import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const GUARDIAN_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  justice: 'guardian.core.justice',
  spearHelioRush: 'guardian.core.spear.helio-rush-illuminated',
  spearGleamingDisc: 'guardian.core.spear.gleaming-disc-illuminated',
  spearSolarStorm: 'guardian.core.spear.solar-storm-illuminated',
  spearLuminance: 'guardian.core.spear.symbol-of-luminance',
  symbolOfIgnition: 'guardian.core.symbol-of-ignition-field',
  signetOfWrath: 'guardian.core.signet-of-wrath-passive'
});

export const GUARDIAN_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: GUARDIAN_CORE_BALANCE_PROFILE_IDS.justice,
    name: 'Virtue of Justice',
    profileKind: 'mechanic',
    threshold: 5,
    effects: [
      {
        type: 'condition',
        name: 'Burning (active)',
        condition: 'Burning',
        stacks: 1,
        duration: 2,
        actorType: 'player',
        packetLabel: 'active'
      },
      {
        type: 'condition',
        name: 'Burning (passive)',
        condition: 'Burning',
        stacks: 1,
        duration: 1.2,
        actorType: 'player',
        packetLabel: 'passive'
      }
    ]
  },
  {
    id: GUARDIAN_CORE_BALANCE_PROFILE_IDS.spearHelioRush,
    name: 'Helio Rush - Illuminated',
    profileKind: 'skill-variant',
    parentId: ID.HELIO_RUSH,
    damageMultiplier: 1.5,
    effects: []
  },
  {
    id: GUARDIAN_CORE_BALANCE_PROFILE_IDS.spearGleamingDisc,
    name: 'Gleaming Disc - Illuminated',
    profileKind: 'skill-variant',
    parentId: ID.GLEAMING_DISC,
    damageMultiplier: 1.25,
    effects: []
  },
  {
    id: GUARDIAN_CORE_BALANCE_PROFILE_IDS.spearSolarStorm,
    name: 'Solar Storm - Illuminated',
    profileKind: 'skill-variant',
    parentId: ID.SOLAR_STORM,
    damageMultiplier: 1.25,
    effects: [
      {
        type: 'strike',
        name: 'Fourth projectile',
        coefficient: 0.6,
        hits: 1,
        // Illuminated shards continue the same delayed volley at 200 ms intervals.
        atMs: 1720,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'strike',
        name: 'Fifth projectile',
        coefficient: 0.3,
        hits: 1,
        atMs: 1920,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  {
    id: GUARDIAN_CORE_BALANCE_PROFILE_IDS.spearLuminance,
    name: 'Symbol of Luminance - Illumination',
    profileKind: 'skill-variant',
    parentId: ID.SYMBOL_OF_LUMINANCE,
    effects: [
      // The single-use charge and symbol window can be patched independently.
      { type: 'buff', name: 'illuminated', kind: 'illuminated', stacks: 1, duration: 5 },
      {
        type: 'buff',
        name: 'guardian-spear-luminance',
        kind: 'guardian-spear-luminance',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  {
    id: GUARDIAN_CORE_BALANCE_PROFILE_IDS.symbolOfIgnition,
    name: 'Symbol of Ignition - Field',
    profileKind: 'skill-variant',
    parentId: ID.SYMBOL_OF_IGNITION,
    internalCooldown: 0.24,
    effects: [
      {
        type: 'condition',
        name: 'Burning',
        condition: 'Burning',
        stacks: 1,
        duration: 1,
        actorType: 'player'
      },
      {
        type: 'buff',
        name: 'guardian-symbol-of-ignition-field',
        kind: 'guardian-symbol-of-ignition-field',
        stacks: 1,
        duration: 4,
        actorType: 'effect'
      }
    ]
  },
  {
    id: GUARDIAN_CORE_BALANCE_PROFILE_IDS.signetOfWrath,
    name: 'Signet of Wrath - Passive',
    profileKind: 'skill-variant',
    parentId: ID.SIGNET_OF_WRATH,
    attributeBonus: 180,
    effects: []
  },
  {
    id: 'guardian.core.bane-signet-passive',
    name: 'Bane Signet - Passive',
    profileKind: 'skill-variant',
    parentId: ID.BANE_SIGNET,
    attributeBonus: 180,
    effects: []
  }
]);
