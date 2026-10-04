import type { BalanceProfile } from '#gw2/platform/skills/types.js';

export const CONDUIT_BALANCE_PROFILE_IDS = Object.freeze({
  affinity: 'revenant.conduit.affinity',
  beguilingHazeMainCastExtension: 'revenant.conduit.beguiling-haze-main-cast-extension',
  beguilingHazeFollowUp: 'revenant.conduit.beguiling-haze-follow-up',
  lingeringDetermination: 'revenant.conduit.lingering-determination',
  enhancedEmbodiment: 'revenant.conduit.enhanced-embodiment',
  expandedConsciousness: 'revenant.conduit.expanded-consciousness',
  sharedWisdom: 'revenant.conduit.shared-wisdom',
  numinousGift: 'revenant.conduit.numinous-gift',
  mistfire: 'revenant.conduit.mistfire',
  mesmerBanishEnchantment: 'revenant.conduit.mesmer-banish-enchantment',
  mesmerPainAbsorption: 'revenant.conduit.mesmer-pain-absorption',
  mesmerEmpoweringMisery: 'revenant.conduit.mesmer-empowering-misery',
  mesmerCallToAnguish: 'revenant.conduit.mesmer-call-to-anguish',
  mesmerUnyieldingImpact: 'revenant.conduit.mesmer-unyielding-impact',
  mesmerEmbraceTheDarkness: 'revenant.conduit.mesmer-embrace-the-darkness'
});

export const CONDUIT_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.affinity,
    name: 'Affinity',
    profileKind: 'mechanic',
    maximumStacks: 5,
    minimumStacks: 3,
    effects: []
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeMainCastExtension,
    name: 'Beguiling Haze (Main Cast Extension)',
    profileKind: 'skill-variant',
    castTimeMs: 360,
    effects: []
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeFollowUp,
    name: 'Beguiling Haze (Follow-Up)',
    profileKind: 'skill-variant',
    castTimeMs: 240,
    maximumStacks: 2,
    effects: [
      {
        type: 'strike',
        name: 'Beguiling Haze — Follow-Up',
        actorType: 'player',
        ticks: [{ atMs: 200, coefficient: 0.6 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.mesmerEmpoweringMisery,
    name: 'Empowering Misery (Form of the Mesmer)',
    profileKind: 'skill-variant',
    energyCost: 1,
    effects: []
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.mesmerPainAbsorption,
    name: 'Pain Absorption (Form of the Mesmer)',
    profileKind: 'skill-variant',
    energyCost: 10,
    cooldown: 5,
    effects: []
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.mesmerBanishEnchantment,
    name: 'Banish Enchantment (Form of the Mesmer)',
    profileKind: 'skill-variant',
    energyCost: 5,
    cooldown: 5,
    effects: []
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.mesmerCallToAnguish,
    name: 'Call to Anguish (Form of the Mesmer)',
    profileKind: 'skill-variant',
    energyCost: 10,
    effects: []
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.mesmerUnyieldingImpact,
    name: 'Unyielding Impact (Form of the Mesmer)',
    profileKind: 'skill-variant',
    // Mesmer-form skills retain their one-Energy activation cost; Embrace's upkeep drain starts separately on completion.
    energyCost: 1,
    effects: []
  },
  {
    id: CONDUIT_BALANCE_PROFILE_IDS.mesmerEmbraceTheDarkness,
    name: 'Embrace the Darkness (Form of the Mesmer)',
    profileKind: 'skill-variant',
    energyCost: 1,
    effects: []
  }
]);
