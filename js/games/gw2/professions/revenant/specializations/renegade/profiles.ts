/** Owns patchable Renegade mechanic, skill-variant, and trait balance profiles. */
import type { BalanceProfile, SkillId } from '#gw2/platform/engine/skills/types.js';

export const RENEGADE_PROFILE_IDS = Object.freeze({
  spiritBoon: 'revenant.renegade.spirit-boon-renegade',
  bandTogether: 'revenant.renegade.band-together',
  kallasFervor: 'revenant.renegade.kallas-fervor',
  kallasFervorLastingLegacy: 'revenant.renegade.kallas-fervor-lasting-legacy',
  heroicCommandLastingLegacy: 'revenant.renegade.heroic-command-lasting-legacy',
  ordersFromAboveRighteousRebel: 'revenant.renegade.orders-from-above-righteous-rebel',
  razorclawsRageProc: 'revenant.renegade.razorclaws-rage-proc',
  soulcleavesSummitProc: 'revenant.renegade.soulcleaves-summit-proc',
  endlessEnmity: 'revenant.renegade.endless-enmity',
  bloodFury: 'revenant.renegade.blood-fury',
  allForOne: 'revenant.renegade.all-for-one',
  vindication: 'revenant.renegade.vindication'
});

export const RENEGADE_SPIRIT_BOON_PROFILE_ID = RENEGADE_PROFILE_IDS.spiritBoon;

function renegadeBalanceProfile(profile: {
  readonly id: SkillId;
  readonly name: string;
  readonly profileKind?: BalanceProfile['profileKind'];
  readonly effects?: BalanceProfile['effects'];
  readonly [field: string]: unknown;
}): BalanceProfile {
  return {
    profileKind: 'mechanic',
    effects: [],
    ...profile
  };
}

export const RENEGADE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.spiritBoon,
    name: 'Spirit Boon (Renegade)',
    profileKind: 'trait',
    description: 'Invoking Legendary Renegade grants resolution to nearby allies.',
    icon: 'https://render.guildwars2.com/file/62279406A52F47A00CE7BFFB43D405907A67A60F/1012681.png',
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        type: 'boon',
        boon: 'resolution',
        duration: 4,
        stacks: 1,
        actorType: 'player'
      }
    ]
  }),
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.bandTogether,
    name: 'Band Together',
    description: 'After using a Legendary Renegade skill, the next one is instant and enhanced.',
    effects: [
      {
        type: 'buff',
        kind: 'band-together',
        duration: 4,
        stacks: 1,
        actorType: 'player'
      }
    ]
  }),
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.kallasFervor,
    name: "Kalla's Fervor",
    maximumStacks: 5,
    lifeSiphonDamagePerStack: 0.02,
    effects: [
      {
        type: 'buff',
        kind: 'kallas-fervor',
        duration: 8,
        stacks: 1,
        actorType: 'player'
      }
    ]
  }),
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.kallasFervorLastingLegacy,
    name: "Kalla's Fervor (Lasting Legacy)",
    profileKind: 'trait',
    variantBadge: 'Lasting Legacy',
    maximumStacks: 5,
    lifeSiphonDamagePerStack: 0.03,
    effects: [
      {
        type: 'buff',
        kind: 'kallas-fervor',
        duration: 12,
        stacks: 1,
        actorType: 'player'
      }
    ]
  }),
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.heroicCommandLastingLegacy,
    name: 'Heroic Command (Lasting Legacy)',
    profileKind: 'skill-variant',
    variantBadge: 'Lasting Legacy',
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 3,
        actorType: 'player'
      }
    ]
  }),
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.ordersFromAboveRighteousRebel,
    name: 'Orders from Above (Righteous Rebel)',
    profileKind: 'skill-variant',
    variantBadge: 'Righteous Rebel',
    effects: [
      {
        type: 'boon',
        boon: 'alacrity',
        duration: 2,
        stacks: 1,
        applications: 6,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  }),
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.endlessEnmity,
    name: 'Endless Enmity',
    profileKind: 'trait',
    icon: 'https://render.guildwars2.com/file/A4D16BE749A19FE8A8B5783EE2BD1DF899156D47/1769999.png',
    categories: ['Trait'],
    skillFamily: 'Trait',
    cooldown: 8,
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 4,
        stacks: 1,
        audience: { recipients: 'party' as const },
        actorType: 'player'
      }
    ]
  }),
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.bloodFury,
    name: 'Blood Fury',
    profileKind: 'trait',
    icon: 'https://render.guildwars2.com/file/10FA58BEA8CF9AAB3F7841B154DC26E95A4FC705/1769989.png',
    categories: ['Trait'],
    skillFamily: 'Trait',
    cooldown: 3
  }),
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.allForOne,
    name: 'All for One',
    profileKind: 'trait',
    icon: 'https://render.guildwars2.com/file/9398D8F8E764A23596E17EDAA35B99961D62F061/1769993.png',
    categories: ['Trait'],
    skillFamily: 'Trait',
    resourceGain: 10,
    rechargeMultiplier: 0.5
  }),
  renegadeBalanceProfile({
    id: RENEGADE_PROFILE_IDS.vindication,
    name: 'Vindication',
    profileKind: 'trait',
    icon: 'https://render.guildwars2.com/file/3453B30240026E36661AACD3FA94FB0DBFC8246C/1769995.png',
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        type: 'control',
        duration: 1,
        actorType: 'player',
        controlKind: 'daze',
        breakbar: 100
      }
    ]
  })
]);
