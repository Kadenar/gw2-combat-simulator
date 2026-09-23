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
  holyReckoning: TRAIT.HOLY_RECKONING,
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
        name: 'Strike',
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
      { type: 'buff', name: 'justice', kind: 'justice', stacks: 1, duration: 8 },
      { type: 'buff', name: 'resolve', kind: 'resolve', stacks: 1, duration: 6 },
      { type: 'buff', name: 'courage', kind: 'courage', stacks: 1, duration: 6 }
    ]
  },
  {
    id: WILLBENDER_BALANCE_PROFILE_IDS.courageTrigger,
    name: 'Crashing Courage - Trigger',
    profileKind: 'skill-variant',
    parentId: ID.CRASHING_COURAGE,
    effects: [
      { type: 'boon', name: 'aegis', boon: 'aegis', stacks: 1, duration: 4 },
      { type: 'boon', name: 'stability', boon: 'stability', stacks: 1, duration: 4 }
    ]
  },
  trait(WILLBENDER_BALANCE_PROFILE_IDS.lethalTempo, 'Lethal Tempo', {
    maximumStacks: 5,
    effects: [{ type: 'buff', name: 'lethal-tempo', kind: 'lethal-tempo', stacks: 1, duration: 6 }]
  }),
  trait(WILLBENDER_BALANCE_PROFILE_IDS.tyrantsMomentum, "Tyrant's Momentum", {
    effects: [
      { type: 'buff', name: 'lethal-tempo', kind: 'lethal-tempo', stacks: 1, duration: 4 },
      { type: 'buff', name: 'justice', kind: 'justice', stacks: 1, duration: 10 }
    ]
  }),
  trait(WILLBENDER_BALANCE_PROFILE_IDS.restorativeVirtues, 'Restorative Virtues', {
    // Each virtue trigger advances active weapon recharge by 280ms before recharge-speed conversion.
    rechargeReduction: 0.28,
    effects: [{ type: 'boon', name: 'vigor', boon: 'vigor', stacks: 1, duration: 3 }]
  }),
  trait(WILLBENDER_BALANCE_PROFILE_IDS.holyReckoning, 'Holy Reckoning', {
    effects: [
      { type: 'boon', name: 'might', boon: 'might', stacks: 1, duration: 15, audience: { recipients: 'party' } },
      { type: 'boon', name: 'fury', boon: 'fury', stacks: 1, duration: 3, audience: { recipients: 'self' } }
    ]
  }),
  trait(WILLBENDER_BALANCE_PROFILE_IDS.phoenixProtocol, 'Phoenix Protocol', {
    effects: [
      { type: 'boon', name: 'alacrity', boon: 'alacrity', stacks: 1, duration: 5 },
      {
        type: 'boon',
        name: 'alacrity (triggered)',
        boon: 'alacrity',
        stacks: 1,
        duration: 1,
        packetLabel: 'triggered'
      }
    ]
  }),
  // Trait tuning is shared by build calculations, combat, and tooltips.
  trait(TRAIT.POWER_FOR_POWER, 'Power for Power', { attributeBonus: 120 }),
  trait(TRAIT.CONCEITED_CURATE, 'Conceited Curate', { attributeBonus: 180 }),
  trait(WILLBENDER_BALANCE_PROFILE_IDS.searingPact, 'Searing Pact', {
    attributeBonus: 120,
    effects: [{ type: 'condition', name: 'Burning', condition: 'Burning', stacks: 1, duration: 1 }]
  })
]);
