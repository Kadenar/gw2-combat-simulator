import type { BalanceProfile } from '#gw2/platform/skills/types.js';

export const ENGINEER_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'engineer.core.resources',
  lightningRod: 'engineer.core.lightning-rod',
  focusedLightningRod: 'engineer.core.focused-lightning-rod',
  conduitSurge: 'engineer.core.conduit-surge',
  electricArtillery: 'engineer.core.electric-artillery',
  focusedElectricArtillery: 'engineer.core.focused-electric-artillery'
});

export const ENGINEER_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  // Resolver-owned spear packets share their selected declarations with presentation.
  {
    id: ENGINEER_CORE_BALANCE_PROFILE_IDS.lightningRod,
    name: 'Lightning Rod Pulse',
    profileKind: 'skill-variant',
    effects: [
      { name: 'Lightning Rod Pulse', type: 'strike', coefficient: 0.17, hits: 1 },
      { name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 8 }
    ]
  },
  {
    id: ENGINEER_CORE_BALANCE_PROFILE_IDS.focusedLightningRod,
    name: 'Focused Lightning Rod Pulse',
    profileKind: 'skill-variant',
    effects: [
      { name: 'Focused Lightning Rod Pulse', type: 'strike', coefficient: 0.3, hits: 1 },
      { name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 2, duration: 8 }
    ]
  },
  {
    id: ENGINEER_CORE_BALANCE_PROFILE_IDS.conduitSurge,
    name: 'Conduit Surge',
    profileKind: 'skill-variant',
    durationMultiplier: 10,
    effects: [
      { name: 'Conduit Surge', type: 'strike', coefficient: 1.2, hits: 1 },
      { name: 'Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 7 }
    ]
  },
  {
    id: ENGINEER_CORE_BALANCE_PROFILE_IDS.electricArtillery,
    name: 'Electric Artillery',
    profileKind: 'skill-variant',
    maximumStacks: 12,
    chargesPerVulnerability: 2,
    burningDurationPerCharge: 0.25,
    effects: [
      { name: 'Electric Artillery', type: 'strike', coefficient: 1, hits: 1 },
      { name: 'Immobilized', type: 'condition', condition: 'Immobilized', stacks: 1, duration: 2 },
      { name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 8 },
      { name: 'Burning', type: 'condition', condition: 'Burning', stacks: 2, duration: 3 }
    ]
  },
  {
    id: ENGINEER_CORE_BALANCE_PROFILE_IDS.focusedElectricArtillery,
    name: 'Focused Electric Artillery',
    profileKind: 'skill-variant',
    maximumStacks: 12,
    chargesPerVulnerability: 1,
    burningDurationPerCharge: 0.5,
    effects: [
      { name: 'Focused Electric Artillery', type: 'strike', coefficient: 1.5, hits: 1 },
      { name: 'Immobilized', type: 'condition', condition: 'Immobilized', stacks: 1, duration: 2 },
      { name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 8 },
      { name: 'Burning', type: 'condition', condition: 'Burning', stacks: 2, duration: 3 }
    ]
  },
  {
    id: ENGINEER_CORE_BALANCE_PROFILE_IDS.resources,
    name: 'Engineer Endurance',
    profileKind: 'mechanic',
    maximumStacks: 100,
    resourceCost: 50,
    enduranceRegenerationPerSecond: 5,
    vigorRegenerationMultiplier: 1.5,
    coefficientMultiplier: 1.25,
    effects: []
  }
]);
