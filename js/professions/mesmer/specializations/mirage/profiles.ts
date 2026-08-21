import type { BalanceProfile, SkillEffect } from '../../../../platform/engine/types.js';
import { MESMER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { mesmerBalanceProfile } from '../../core/profiles.js';
import { MESMER_MIRAGE_AMBUSH_ATTACKS } from './mechanics.js';
import type { MesmerAmbushAttack, MesmerAttackStatus } from '../../types.js';

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

const trait = (id: number, name: string, fields: Readonly<Record<string, unknown>> = {}): BalanceProfile => ({
  id,
  name,
  profileKind: 'trait',
  categories: ['Trait'],
  skillFamily: 'Trait',
  effects: [],
  ...fields
});

const variant = (
  id: string,
  parentId: number,
  name: string,
  fields: Readonly<Record<string, unknown>> = {}
): BalanceProfile => ({
  id,
  parentId,
  name,
  profileKind: 'skill-variant',
  effects: [],
  ...fields
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

/** Builds the patchable balance profile for one Mirage player/clone ambush pair. */
export function mesmerAmbushProfile(id: string, attack: MesmerAmbushAttack): BalanceProfile {
  return variant(id, attack.id, `${attack.name} - Ambush`, {
    effects: [
      {
        type: 'strike',
        name: 'Player attack',
        source: 'Player',
        coefficient: attack.player.coefficient,
        hits: attack.player.hits
      },
      ...(attack.player.conditions || []).flatMap((status) =>
        Array.from({ length: Number(status.applications || 1) }, () => attackStatusEffect(status, 'Player'))
      ),
      ...(attack.playerBoons || []).map((status) => boonStatusEffect(status, 'Player')),
      {
        type: 'strike',
        name: 'Clone attack',
        source: 'Clone',
        coefficient: attack.clone.coefficient,
        hits: attack.clone.hits
      },
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
  const profile = mesmerBalanceProfile(context, balanceProfileId);
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
      coefficient: Number(playerStrike?.coefficient ?? attack.player.coefficient),
      hits: Number(playerStrike?.hits ?? attack.player.hits),
      conditions: profile ? profileStatuses(profile, 'condition', 'Player') : attack.player.conditions
    },
    clone: {
      ...attack.clone,
      coefficient: Number(cloneStrike?.coefficient ?? attack.clone.coefficient),
      hits: Number(cloneStrike?.hits ?? attack.clone.hits),
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
