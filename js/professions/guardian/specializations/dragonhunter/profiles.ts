import type { BalanceProfile } from '../../../../platform/engine/types.js';
import { defineTraitProfile as trait } from '../../../../platform/gw2/authoring/balance-profiles.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '../../data/ids.js';

export const DRAGONHUNTER_BALANCE_PROFILE_IDS = Object.freeze({
  tether: 'guardian.dragonhunter.spear-of-justice-tether',
  soaringDevastation: TRAIT.SOARING_DEVASTATION,
  bigGameHunter: TRAIT.BIG_GAME_HUNTER,
  huntersDetermination: TRAIT.HUNTERS_DETERMINATION,
  huntersPremonition: TRAIT.HUNTERS_PREMONITION,
  passiveCourage: 'guardian.dragonhunter.passive-courage',
  dulledSenses: TRAIT.DULLED_SENSES,
  heavyLight: TRAIT.HEAVY_LIGHT
});

export const DRAGONHUNTER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: DRAGONHUNTER_BALANCE_PROFILE_IDS.tether,
    name: 'Spear of Justice - Tether',
    profileKind: 'skill-variant',
    parentId: ID.SPEAR_OF_JUSTICE,
    pulseInterval: 1,
    effects: [
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 2,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 1.5,
        actorType: 'player',
        packetLabel: 'passive'
      }
    ]
  },
  trait(DRAGONHUNTER_BALANCE_PROFILE_IDS.soaringDevastation, 'Soaring Devastation', {
    effects: [
      { type: 'strike', coefficient: 1.5, hits: 1 },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 3
      }
    ]
  }),
  trait(DRAGONHUNTER_BALANCE_PROFILE_IDS.bigGameHunter, 'Big Game Hunter', {
    pulseInterval: 12,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10
      }
    ]
  }),
  trait(DRAGONHUNTER_BALANCE_PROFILE_IDS.huntersDetermination, "Hunter's Determination", { resourceGain: 100 }),
  trait(DRAGONHUNTER_BALANCE_PROFILE_IDS.huntersPremonition, "Hunter's Premonition", {
    effects: [{ type: 'boon', boon: 'aegis', stacks: 1, duration: 3 }]
  }),
  {
    id: DRAGONHUNTER_BALANCE_PROFILE_IDS.passiveCourage,
    name: 'Shield of Courage - Passive',
    profileKind: 'mechanic',
    pulseInterval: 40,
    effects: [{ type: 'boon', boon: 'aegis', stacks: 1, duration: 20 }]
  },
  trait(DRAGONHUNTER_BALANCE_PROFILE_IDS.dulledSenses, 'Dulled Senses', {
    effects: [
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ]
  }),
  trait(DRAGONHUNTER_BALANCE_PROFILE_IDS.heavyLight, 'Heavy Light', {
    internalCooldown: 1,
    effects: [{ type: 'boon', boon: 'stability', stacks: 1, duration: 6 }]
  })
]);
