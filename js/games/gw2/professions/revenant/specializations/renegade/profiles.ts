import type { BalanceProfile, SkillId } from '#gw2/platform/skills/types.js';

export const RENEGADE_PROFILE_IDS = Object.freeze({
  bandTogether: 'revenant.renegade.band-together',
  kallasFervor: 'revenant.renegade.kallas-fervor',
  kallasFervorLastingLegacy: 'revenant.renegade.kallas-fervor-lasting-legacy',
  heroicCommandLastingLegacy: 'revenant.renegade.heroic-command-lasting-legacy',
  ordersFromAboveRighteousRebel: 'revenant.renegade.orders-from-above-righteous-rebel',
  razorclawsRageProc: 'revenant.renegade.razorclaws-rage-proc',
  soulcleavesSummitProc: 'revenant.renegade.soulcleaves-summit-proc',
  ashenDemeanor: 'revenant.renegade.ashen-demeanor',
  boldReversalRighteousRebel: 'revenant.renegade.bold-reversal-righteous-rebel',
  endlessEnmity: 'revenant.renegade.endless-enmity',
  bloodFury: 'revenant.renegade.blood-fury',
  brutalMomentum: 'revenant.renegade.brutal-momentum',
  allForOne: 'revenant.renegade.all-for-one',
  vindication: 'revenant.renegade.vindication'
});

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
    id: RENEGADE_PROFILE_IDS.bandTogether,
    name: 'Band Together',
    description: 'After using a Legendary Renegade skill, the next one is instant and enhanced.',
    effects: [
      {
        name: 'band-together',
        type: 'buff',
        kind: 'band-together',
        duration: 4,
        stacks: 1,
        actorType: 'player'
      }
    ]
  })
]);
