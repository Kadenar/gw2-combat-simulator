import type { BalanceProfile } from '#gw2/platform/skills/types.js';

export const PARAGON_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'warrior.paragon.motivation',
  refrain: 'warrior.paragon.refrain',
  chants: 'warrior.paragon.chants',
  commands: 'warrior.paragon.command-echoes',
  findTheirWeaknessEcho: 'warrior.paragon.find-their-weakness-echo',
  onYourKneesEcho: 'warrior.paragon.on-your-knees-echo',
  weShallReturnEcho: 'warrior.paragon.we-shall-return-echo'
});

export const PARAGON_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: PARAGON_BALANCE_PROFILE_IDS.refrain,
    name: 'Paragon Refrains',
    profileKind: 'mechanic',
    effects: [
      { name: 'might', type: 'boon', boon: 'might', stacks: 1, duration: 8 },
      { name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 5 },
      { name: 'regeneration', type: 'boon', boon: 'regeneration', stacks: 1, duration: 3 },
      { name: 'swiftness', type: 'boon', boon: 'swiftness', stacks: 1, duration: 3 },
      { name: 'resolution', type: 'boon', boon: 'resolution', stacks: 1, duration: 3 },
      { name: 'protection', type: 'boon', boon: 'protection', stacks: 1, duration: 3 }
    ]
  },
  {
    id: PARAGON_BALANCE_PROFILE_IDS.resources,
    name: 'Paragon Motivation',
    profileKind: 'mechanic',
    maximumStacks: 10,
    minimumStacks: 4,
    threshold: 7,
    pulseInterval: 3,
    effects: []
  },
  {
    id: PARAGON_BALANCE_PROFILE_IDS.chants,
    name: 'Paragon Chant Entry',
    profileKind: 'mechanic',
    resourceGain: 4,
    effects: [
      { name: 'might', type: 'boon', boon: 'might', stacks: 5, duration: 8 },
      { name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 5 },
      { name: 'vigor', type: 'boon', boon: 'vigor', stacks: 1, duration: 5 },
      { name: 'stability', type: 'boon', boon: 'stability', stacks: 1, duration: 3 }
    ]
  },
  {
    id: PARAGON_BALANCE_PROFILE_IDS.findTheirWeaknessEcho,
    name: 'Find Their Weakness - Echo',
    profileKind: 'mechanic',
    resourceGain: 3,
    effects: [{ type: 'boon', name: 'might', boon: 'might', duration: 10, stacks: 7 }]
  },
  {
    id: PARAGON_BALANCE_PROFILE_IDS.onYourKneesEcho,
    name: 'On Your Knees - Echo',
    profileKind: 'mechanic',
    resourceGain: 0,
    effects: [
      { type: 'strike', name: 'Echo Damage', coefficient: 1.5, hits: 1 },
      { type: 'condition', name: 'Echo Immobilized', condition: 'Immobilized', duration: 2, stacks: 1 }
    ]
  },
  {
    id: PARAGON_BALANCE_PROFILE_IDS.weShallReturnEcho,
    name: 'We Shall Return - Echo',
    profileKind: 'mechanic',
    resourceGain: 10,
    effects: []
  },
  {
    id: PARAGON_BALANCE_PROFILE_IDS.commands,
    name: 'Paragon Command Echoes',
    profileKind: 'mechanic',
    pulseInterval: 3,
    effects: []
  }
]);
