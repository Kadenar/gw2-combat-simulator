import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import type { BalanceProfile, SkillEffect, StrikeEffect } from '#gw2/platform/engine/types.js';
import {
  defineSkillVariantProfile as variant,
  defineTraitProfile as trait
} from '#gw2/integrations/patches/authoring/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/mesmer/data/ids.js';

import { MESMER_MIRAGE_AMBUSH_ATTACKS } from '#gw2/content/professions/mesmer/specializations/mirage/mechanics/definitions.js';
import type {
  MesmerAmbushAttack,
  MesmerAmbushStrike,
  MesmerAttackStatus
} from '#gw2/content/professions/mesmer/types.js';

export const MIRAGE_BALANCE_PROFILE_IDS = Object.freeze({
  mechanics: 'mesmer.mirage.mechanics',
  nominalEndurance: TRAIT.NOMADS_ENDURANCE,
  selfDeception: TRAIT.SELF_DECEPTION,
  renewingOasis: TRAIT.RENEWING_OASIS,
  riddleOfSand: TRAIT.RIDDLE_OF_SAND,
  desertDistortion: TRAIT.DESERT_DISTORTION,
  mirageMantle: TRAIT.MIRAGE_MANTLE,
  phantomPain: TRAIT.PHANTOM_PAIN,
  elusiveMind: TRAIT.ELUSIVE_MIND,
  duneCloak: TRAIT.DUNE_CLOAK,
  imaginaryAxes: 'mesmer.mirage.imaginary-axes',
  phantomRazor: 'mesmer.mirage.phantom-razor',
  splitSurge: 'mesmer.mirage.split-surge',
  effervescence: 'mesmer.mirage.effervescence',
  etherBarrage: 'mesmer.mirage.ether-barrage',
  fracturedGlass: 'mesmer.mirage.fractured-glass',
  chaosVortex: 'mesmer.mirage.chaos-vortex',
  mirageThrust: 'mesmer.mirage.mirage-thrust'
});

export const MIRAGE_AMBUSH_PROFILE_IDS: Readonly<Record<string, string>> = Object.freeze({
  Axe: MIRAGE_BALANCE_PROFILE_IDS.imaginaryAxes,
  Dagger: MIRAGE_BALANCE_PROFILE_IDS.phantomRazor,
  Greatsword: MIRAGE_BALANCE_PROFILE_IDS.splitSurge,
  Rifle: MIRAGE_BALANCE_PROFILE_IDS.effervescence,
  Scepter: MIRAGE_BALANCE_PROFILE_IDS.etherBarrage,
  Spear: MIRAGE_BALANCE_PROFILE_IDS.fracturedGlass,
  Staff: MIRAGE_BALANCE_PROFILE_IDS.chaosVortex,
  Sword: MIRAGE_BALANCE_PROFILE_IDS.mirageThrust
});

function attackStatusEffect(status: MesmerAttackStatus, source: 'Player' | 'Clone'): SkillEffect {
  return {
    type: 'condition',
    source,
    condition: status.name,
    duration: status.duration,
    stacks: status.stacks
  };
}

function boonStatusEffect(status: MesmerAttackStatus, source: 'Player' | 'Clone'): SkillEffect {
  return {
    type: 'boon',
    source,
    boon: status.name.toLowerCase(),
    duration: status.duration,
    stacks: status.stacks
  };
}

/** Keeps each ambush profile in the same compact-or-explicit packet form as its mechanic definition. */
function ambushStrikeEffect(attack: MesmerAmbushStrike, source: 'Player' | 'Clone'): StrikeEffect {
  return attack.ticks?.length
    ? {
        type: 'strike',
        name: `${source} attack`,
        source,
        ticks: attack.ticks,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    : {
        type: 'strike',
        name: `${source} attack`,
        source,
        coefficient: attack.coefficient,
        hits: attack.hits,
        atMs: attack.atMs
      };
}

/** Builds the patchable balance profile for one Mirage player/clone ambush pair. */
export function mesmerAmbushProfile(id: string, attack: MesmerAmbushAttack): BalanceProfile {
  return variant(id, attack.id, `${attack.name} - Ambush`, {
    effects: [
      ambushStrikeEffect(attack.player, 'Player'),
      ...(attack.player.conditions || []).flatMap((status) =>
        Array.from({ length: Number(status.applications || 1) }, () => attackStatusEffect(status, 'Player'))
      ),
      ...(attack.playerBoons || []).map((status) => boonStatusEffect(status, 'Player')),
      ambushStrikeEffect(attack.clone, 'Clone'),
      ...(attack.clone.conditions || []).flatMap((status) =>
        Array.from({ length: Number(status.applications || 1) }, () => attackStatusEffect(status, 'Clone'))
      ),
      ...(attack.cloneBoons || []).map((status) => boonStatusEffect(status, 'Clone')),
      ...(attack.vulnerability
        ? [
            {
              type: 'condition' as const,
              name: 'Vulnerability',
              condition: 'Vulnerability',
              duration: attack.vulnerability.duration,
              stacks: attack.vulnerability.stacks
            }
          ]
        : [])
    ]
  });
}

// Merge Mirage profile status effects into the base skill while preserving
// explicit skill overrides and packet ordering.
function profileStatuses(
  profile: BalanceProfile | undefined,
  type: 'condition' | 'boon',
  source: 'Player' | 'Clone'
): MesmerAttackStatus[] {
  return (profile?.effects || [])
    .filter((effect) => effect.type === type && effect.source === source)
    .map((effect) => ({
      name: String(type === 'condition' ? effect.condition || '' : effect.boon || ''),
      duration: Number(effect.duration || 0),
      stacks: Number(effect.stacks || 1),
      ...(effect.applications == null ? {} : { applications: Number(effect.applications) })
    }));
}

/** Applies the active Mirage ambush profile to its runtime attack definition. */
export function mesmerProfiledAmbush(
  context: unknown,
  attack: MesmerAmbushAttack,
  balanceProfileId: string
): MesmerAmbushAttack {
  const profile = balanceProfileFromContext(context, balanceProfileId);
  const strikes = (profile?.effects || []).filter((effect) => effect.type === 'strike');
  const playerStrike = strikes.find((effect) => effect.source === 'Player');
  const cloneStrike = strikes.find((effect) => effect.source === 'Clone');
  const vulnerability = (profile?.effects || []).find(
    (effect) => effect.type === 'condition' && effect.condition === 'Vulnerability' && effect.source == null
  );
  return {
    ...attack,
    balanceProfileId,
    player: {
      ...attack.player,
      ...(playerStrike?.ticks?.length
        ? { coefficient: undefined, hits: undefined, atMs: undefined, ticks: playerStrike.ticks }
        : {
            coefficient: Number(playerStrike?.coefficient ?? attack.player.coefficient),
            hits: Number(playerStrike?.hits ?? attack.player.hits),
            atMs: Number(playerStrike?.atMs ?? attack.player.atMs),
            ticks: undefined
          }),
      conditions: profile ? profileStatuses(profile, 'condition', 'Player') : attack.player.conditions
    },
    clone: {
      ...attack.clone,
      ...(cloneStrike?.ticks?.length
        ? { coefficient: undefined, hits: undefined, atMs: undefined, ticks: cloneStrike.ticks }
        : {
            coefficient: Number(cloneStrike?.coefficient ?? attack.clone.coefficient),
            hits: Number(cloneStrike?.hits ?? attack.clone.hits),
            atMs: Number(cloneStrike?.atMs ?? attack.clone.atMs),
            ticks: undefined
          }),
      conditions: profile ? profileStatuses(profile, 'condition', 'Clone') : attack.clone.conditions
    },
    playerBoons: profile ? profileStatuses(profile, 'boon', 'Player') : attack.playerBoons,
    cloneBoons: profile ? profileStatuses(profile, 'boon', 'Clone') : attack.cloneBoons,
    vulnerability: vulnerability
      ? {
          duration: Number(vulnerability.duration || 0),
          stacks: Number(vulnerability.stacks || 1)
        }
      : attack.vulnerability
  };
}

export const MIRAGE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: MIRAGE_BALANCE_PROFILE_IDS.mechanics,
    name: 'Mirage Cloak and Mirrors',
    profileKind: 'mechanic',
    durationMultiplier: 0.75,
    durationPerTier: 1.5,
    effects: [
      { type: 'strike', coefficient: 0.6, hits: 1 },
      { type: 'buff', kind: 'mirage-mirror', duration: 8, stacks: 1 }
    ]
  },
  ...Object.entries(MESMER_MIRAGE_AMBUSH_ATTACKS).map(([weapon, attack]) =>
    mesmerAmbushProfile(MIRAGE_AMBUSH_PROFILE_IDS[weapon], attack)
  ),
  trait(MIRAGE_BALANCE_PROFILE_IDS.nominalEndurance, "Nomad's Endurance", {
    effects: [{ type: 'boon', boon: 'vigor', duration: 3, stacks: 1 }]
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.selfDeception, 'Self-Deception', {
    resourceGain: 1
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.renewingOasis, 'Renewing Oasis', {
    effects: [{ type: 'boon', boon: 'regeneration', duration: 4, stacks: 1 }]
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.riddleOfSand, 'Riddle of Sand', {
    effects: [
      {
        type: 'condition',
        condition: 'Confusion',
        duration: 4,
        stacks: 2
      }
    ]
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.desertDistortion, 'Desert Distortion', {
    resourceGain: 1
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.mirageMantle, 'Mirage Mantle', {
    effects: [{ type: 'boon', boon: 'alacrity', duration: 4, stacks: 1 }]
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.phantomPain, 'Phantom Pain', {
    maximumStacks: 4,
    durationMultiplier: 10
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.elusiveMind, 'Elusive Mind', {
    maximumStacks: 3
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.duneCloak, 'Dune Cloak', {
    threshold: 3,
    rechargeReduction: 1,
    durationMultiplier: 1
  })
]);
