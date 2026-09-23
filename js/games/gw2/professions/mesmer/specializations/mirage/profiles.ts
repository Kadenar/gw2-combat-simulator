import { normalizeSkillEffects } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import type {
  BalanceProfile,
  SkillEffect,
  StrikeEffect,
  ConditionEffect,
  StatusEffect
} from '#gw2/platform/engine/skills/types.js';
import {
  defineSkillVariantProfile as variant,
  defineTraitProfile as trait
} from '#gw2/platform/profession-definition/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

import { MESMER_MIRAGE_AMBUSH_SKILLS } from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';

import type { MesmerConditionApplication } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerAmbushAttack, MesmerAmbushStrike } from '#gw2/professions/mesmer/types.js';

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

function attackStatusEffect(status: MesmerConditionApplication, source: 'Player' | 'Clone'): SkillEffect {
  return {
    type: 'condition',
    source,
    condition: status.name,
    duration: Number(status.duration),
    stacks: status.stacks
  };
}

function boonStatusEffect(status: MesmerConditionApplication, source: 'Player' | 'Clone'): SkillEffect {
  return {
    type: 'boon',
    source,
    boon: status.name.toLowerCase(),
    duration: Number(status.duration),
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
        Array.from({ length: Number(status.applications ?? 1) }, () => attackStatusEffect(status, 'Player'))
      ),
      ...(attack.player.boons || []).map((status) => boonStatusEffect(status, 'Player')),
      ambushStrikeEffect(attack.clone, 'Clone'),
      ...(attack.clone.conditions || []).flatMap((status) =>
        Array.from({ length: Number(status.applications ?? 1) }, () => attackStatusEffect(status, 'Clone'))
      ),
      ...(attack.clone.boons || []).map((status) => boonStatusEffect(status, 'Clone')),
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
  profile: BalanceProfile,
  type: 'condition' | 'boon',
  source: 'Player' | 'Clone'
): MesmerConditionApplication[] {
  return normalizeSkillEffects(
    profile.effects || [],
    `profession=mesmer patch=${profile.balanceDataContext?.patchId ?? '<unknown>'} profile=${profile.id}`
  )
    .filter((effect): effect is ConditionEffect | StatusEffect => effect.type === type && effect.source === source)
    .map((effect) => ({
      ...effect,
      summonKind: undefined,
      name: String(type === 'condition' ? (effect.condition ?? effect.name) : effect.boon)
    }));
}

/** Applies the active Mirage ambush profile to its runtime attack definition. */
export function mesmerProfiledAmbush(
  context: unknown,
  attack: MesmerAmbushAttack,
  balanceProfileId: string
): MesmerAmbushAttack {
  const profile = requireBalanceProfileFromContext(context, balanceProfileId);
  const playerStrike = requireEffect(profile, 'strike', 'Player attack');
  const cloneStrike = requireEffect(profile, 'strike', 'Clone attack');
  const vulnerability = attack.vulnerability ? requireEffect(profile, 'condition', 'Vulnerability') : undefined;
  return {
    ...attack,
    balanceProfileId,
    player: {
      castTimeMs: attack.player.castTimeMs,
      damageAtMs: attack.player.damageAtMs,
      statusAtMs: attack.player.ticks?.map((tick) => tick.atMs),
      ...playerStrike,
      conditions: profileStatuses(profile, 'condition', 'Player'),
      boons: profileStatuses(profile, 'boon', 'Player')
    },
    clone: {
      castTimeMs: attack.clone.castTimeMs,
      damageAtMs: attack.clone.damageAtMs,
      ...cloneStrike,
      conditions: profileStatuses(profile, 'condition', 'Clone'),
      boons: profileStatuses(profile, 'boon', 'Clone')
    },
    vulnerability: vulnerability
      ? {
          duration: Number(vulnerability.duration),
          stacks: Number(vulnerability.stacks)
        }
      : undefined
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
      { name: 'Strike', type: 'strike', coefficient: 0.6, hits: 1 },
      // Touching a mirror weakens nearby enemies; creating it does not apply the condition.
      { name: 'Weakness', type: 'condition', condition: 'Weakness', stacks: 1, duration: 4 },
      { name: 'mirage-mirror', type: 'buff', kind: 'mirage-mirror', duration: 8, stacks: 1 }
    ]
  },
  ...Object.entries(MESMER_MIRAGE_AMBUSH_SKILLS).map(([weapon, attack]) =>
    mesmerAmbushProfile(MIRAGE_AMBUSH_PROFILE_IDS[weapon], attack)
  ),
  trait(MIRAGE_BALANCE_PROFILE_IDS.nominalEndurance, "Nomad's Endurance", {
    effects: [{ name: 'vigor', type: 'boon', boon: 'vigor', duration: 3, stacks: 1 }]
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.selfDeception, 'Self-Deception', {
    resourceGain: 1
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.renewingOasis, 'Renewing Oasis', {
    effects: [{ name: 'regeneration', type: 'boon', boon: 'regeneration', duration: 4, stacks: 1 }]
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.riddleOfSand, 'Riddle of Sand', {
    effects: [{ name: 'Confusion', type: 'condition', condition: 'Confusion', duration: 4, stacks: 2 }]
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.desertDistortion, 'Desert Distortion', {
    resourceGain: 1
  }),
  trait(MIRAGE_BALANCE_PROFILE_IDS.mirageMantle, 'Mirage Mantle', {
    effects: [{ name: 'alacrity', type: 'boon', boon: 'alacrity', duration: 4, stacks: 1 }]
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
