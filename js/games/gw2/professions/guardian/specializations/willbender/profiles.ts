import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { defineTraitProfile as trait } from '#gw2/platform/profession-definition/balance-profiles.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

export const WILLBENDER_BALANCE_PROFILE_IDS = Object.freeze({
  flames: 'guardian.willbender.flames',
  virtueWindows: 'guardian.willbender.virtue-windows',
  courageTrigger: 'guardian.willbender.courage-trigger',
  lethalTempo: TRAIT.LETHAL_TEMPO,
  tyrantsMomentum: TRAIT.TYRANTS_MOMENTUM,
  restorativeVirtues: TRAIT.RESTORATIVE_VIRTUES,
  phoenixProtocol: TRAIT.PHOENIX_PROTOCOL,
  searingPact: TRAIT.SEARING_PACT
});

export const WILLBENDER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: WILLBENDER_BALANCE_PROFILE_IDS.flames,
    name: 'Willbender Flames',
    profileKind: 'skill-variant',
    parentId: ID.WILLBENDER_FLAMES,
    maximumStacks: 5,
    pulseInterval: 1,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: (index + 1) * 1000, coefficient: 0.22 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  {
    id: WILLBENDER_BALANCE_PROFILE_IDS.virtueWindows,
    name: 'Willbender Virtue Windows',
    profileKind: 'mechanic',
    threshold: 5,
    effects: [
      { type: 'buff', kind: 'justice', stacks: 1, duration: 8 },
      { type: 'buff', kind: 'resolve', stacks: 1, duration: 6 },
      { type: 'buff', kind: 'courage', stacks: 1, duration: 6 }
    ]
  },
  {
    id: WILLBENDER_BALANCE_PROFILE_IDS.courageTrigger,
    name: 'Crashing Courage - Trigger',
    profileKind: 'skill-variant',
    parentId: ID.CRASHING_COURAGE,
    effects: [
      { type: 'boon', boon: 'aegis', stacks: 1, duration: 4 },
      { type: 'boon', boon: 'stability', stacks: 1, duration: 4 }
    ]
  },
  trait(WILLBENDER_BALANCE_PROFILE_IDS.lethalTempo, 'Lethal Tempo', {
    maximumStacks: 5,
    effects: [{ type: 'buff', kind: 'lethal-tempo', stacks: 1, duration: 6 }]
  }),
  trait(WILLBENDER_BALANCE_PROFILE_IDS.tyrantsMomentum, "Tyrant's Momentum", {
    effects: [
      { type: 'buff', kind: 'lethal-tempo', stacks: 1, duration: 4 },
      { type: 'buff', kind: 'justice', stacks: 1, duration: 10 }
    ]
  }),
  trait(WILLBENDER_BALANCE_PROFILE_IDS.restorativeVirtues, 'Restorative Virtues', {
    rechargeReduction: 0.25,
    effects: [{ type: 'boon', boon: 'vigor', stacks: 1, duration: 3 }]
  }),
  trait(WILLBENDER_BALANCE_PROFILE_IDS.phoenixProtocol, 'Phoenix Protocol', {
    effects: [
      { type: 'boon', boon: 'alacrity', stacks: 1, duration: 5 },
      {
        type: 'boon',
        boon: 'alacrity',
        stacks: 1,
        duration: 1,
        packetLabel: 'triggered'
      }
    ]
  }),
  trait(WILLBENDER_BALANCE_PROFILE_IDS.searingPact, 'Searing Pact', {
    effects: [{ type: 'condition', condition: 'Burning', stacks: 1, duration: 1 }]
  })
]);
