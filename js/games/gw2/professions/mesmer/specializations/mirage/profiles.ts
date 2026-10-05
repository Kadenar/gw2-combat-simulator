import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { requireCanonicalSkillEffects } from '#gw2/platform/effects/validation.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import type { StatusEffect } from '#gw2/platform/effects/types.js';
import type { ConditionEffect, SkillEffect, StrikeEffect } from '#gw2/platform/effects/types.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/balance-profiles.js';

import {
  MESMER_MIRAGE_AMBUSH_SKILLS,
  MIRAGE_MIRROR_EFFECTS
} from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';

import type { MesmerAmbushAttack, MesmerAmbushStrike } from '#gw2/professions/mesmer/types.js';

export const MIRAGE_BALANCE_PROFILE_IDS = Object.freeze({
  mechanics: 'mesmer.mirage.mechanics',
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

function attackStatusEffect(status: ConditionEffect, source: 'Player' | 'Clone'): SkillEffect {
  return {
    ...status,
    // The ambush profile expands repeated statuses into independently selectable effects.
    applications: undefined,
    source
  };
}

function boonStatusEffect(status: StatusEffect, source: 'Player' | 'Clone'): SkillEffect {
  return {
    ...status,
    source
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
function mesmerAmbushProfile(id: string, attack: MesmerAmbushAttack): BalanceProfile {
  return variant(id, attack.id, `${attack.name} - Ambush`, {
    effects: [
      ambushStrikeEffect(attack.player, 'Player'),
      ...(attack.player.conditions || []).flatMap((status) =>
        Array.from({ length: status.applications ?? 1 }, () => attackStatusEffect(status, 'Player'))
      ),
      ...(attack.player.boons || []).map((status) => boonStatusEffect(status, 'Player')),
      ambushStrikeEffect(attack.clone, 'Clone'),
      ...(attack.clone.conditions || []).flatMap((status) =>
        Array.from({ length: status.applications ?? 1 }, () => attackStatusEffect(status, 'Clone'))
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
function profileStatuses<T extends 'condition' | 'boon'>(
  profile: BalanceProfile,
  type: T,
  source: 'Player' | 'Clone'
): (T extends 'condition' ? ConditionEffect : StatusEffect)[] {
  // Keep selected effects canonical so runtime expansion retains patched payloads and metadata.
  return requireCanonicalSkillEffects(profile).filter(
    (effect) => effect.type === type && effect.source === source
  ) as (T extends 'condition' ? ConditionEffect : StatusEffect)[];
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
      ...MIRAGE_MIRROR_EFFECTS,
      { name: 'mirage-mirror', type: 'buff', kind: 'mirage-mirror', duration: 8, stacks: 1 }
    ]
  },
  ...Object.entries(MESMER_MIRAGE_AMBUSH_SKILLS).map(([weapon, attack]) =>
    mesmerAmbushProfile(MIRAGE_AMBUSH_PROFILE_IDS[weapon], attack)
  )
]);
