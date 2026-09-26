import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
/**
 * Owns Harbinger Shroud entry, exit, and weapon skill fragments.
 * Persistent Blight and shroud state remain under `mechanics/`.
 */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { HARBINGER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import type { Skill, SkillEffect } from '#gw2/platform/engine/skills/types.js';

/** Supplies Harbinger Shroud fragments to specialization composition. */
export const HARBINGER_SHROUD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.VORACIOUS_ARC]: {
    castTimeMs: 840,
    blightCost: 5,
    effects: [{ name: 'Strike', type: 'strike', coefficient: 1.4, hits: 1 }],
    type: 'Profession',
    slot: 'Weapon_4',
    shroud: 'harbinger',
    shroudSlot: 4,
    specialization: 'Harbinger'
  },
  [ID.EXIT_HARBINGER_SHROUD]: {
    castTimeMs: 0,
    effects: [],
    cooldown: 0,
    specialization: 'Harbinger',
    shroudExit: 'harbinger',
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/shroud.ts`.
    inputCategory: 'bar-swap'
  },
  [ID.VITAL_DRAW]: {
    castTimeMs: 800,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [760, 1760, 2760].map((atMs) => ({ atMs, coefficient: 0.4 }))
      },
      {
        type: 'control',
        applications: 3,
        atMs: 760,
        intervalMs: 1000,
        controlKind: 'float'
      }
    ]),
    // Each accepted siphon funds the live pool only when its own strike arrives.
    lifeForcePerHit: 3,
    type: 'Profession',
    slot: 'Weapon_5',
    shroud: 'harbinger',
    shroudSlot: 5,
    specialization: 'Harbinger'
  },
  [ID.HARBINGER_SHROUD]: {
    castTimeMs: 0,
    effects: [],
    cooldown: 10,
    specialization: 'Harbinger',
    shroudEntry: 'harbinger',
    shroudProfileId: PROFILE.resources,
    minimumShroudLifeForcePercent: 0,
    // Custom: Enters/exits the selected shroud and updates life-force drain/state; see `core/mechanics/shroud.ts`.
    inputCategory: 'bar-swap'
  },
  [ID.TAINTED_BOLTS]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    dhuumfireDuration: 1,
    castTimeMs: 600,
    // Committed bolts retain their strike and Torment packets even if the remaining cast is interrupted.
    interruptCommitMs: 520,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [320, 600].map((atMs) => ({ atMs, coefficient: 0.6 }))
      },
      {
        type: 'condition',
        ticks: [320, 600].map((atMs) => ({ atMs, condition: 'Torment', stacks: 1, duration: 3 }))
      }
    ]),
    type: 'Profession',
    slot: 'Weapon_1',
    shroud: 'harbinger',
    shroudSlot: 1,
    specialization: 'Harbinger'
  },
  [ID.DARK_BARRAGE]: {
    // Doom Approaches selects its patchable packet profile once; the shared scheduler owns every selected pulse.
    effectVariants: [
      {
        when: (runtime) => hasTrait(runtime, TRAIT.DOOM_APPROACHES),
        profileId: PROFILE.darkBarrageDoomApproaches,
        transform: (runtime, _cast, effects) => {
          const profile = requireBalanceProfileFromContext(runtime, PROFILE.darkBarrageDoomApproaches);
          const ticks = Array.from({ length: balanceProfileNumber(profile, 'pulseCount') }, (_, index) => ({
            atMs: (index + 1) * balanceProfileNumber(profile, 'pulseInterval') * 1000
          }));
          return effects.flatMap((effect): SkillEffect[] => {
            if (effect.type === 'strike')
              return [
                {
                  ...effect,
                  timingAnchor: 'castStart',
                  timingScale: 'fixed',
                  ticks: ticks.map((tick) => ({ ...tick, coefficient: effectNumber(profile, effect, 'coefficient') }))
                }
              ];
            if (effect.type === 'condition')
              return [
                {
                  ...effect,
                  timingAnchor: 'castStart',
                  timingScale: 'fixed',
                  ticks: ticks.map((tick) => ({
                    ...tick,
                    condition: String(effect.condition),
                    stacks: effectNumber(profile, effect, 'stacks'),
                    duration: effectNumber(profile, effect, 'duration')
                  }))
                }
              ];
            return [];
          });
        }
      }
    ],
    castTimeMs: 920,
    // Dark Barrage is a channel: interruption keeps each landed volley while 800 ms remains the full-damage cutoff.
    interruptMode: 'per-packet',
    interruptCommitMs: 800,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [600, 680, 680, 800, 800, 800].map((atMs) => ({ atMs, coefficient: 0.6 }))
      },
      {
        type: 'condition',
        ticks: [600, 680, 680, 800, 800, 800].map((atMs) => ({ atMs, condition: 'Torment', stacks: 1, duration: 3 }))
      }
    ]),
    type: 'Profession',
    slot: 'Weapon_2',
    shroud: 'harbinger',
    shroudSlot: 2,
    specialization: 'Harbinger'
  },
  [ID.DEVOURING_CUT]: {
    castTimeMs: 480,
    // Devouring Cut commits at its impact frame before the default cast finishes.
    interruptCommitMs: 280,
    blightCost: 5,
    effects: [{ name: 'Strike', type: 'strike', coefficient: 1, hits: 1 }],
    type: 'Profession',
    slot: 'Weapon_3',
    shroud: 'harbinger',
    shroudSlot: 3,
    specialization: 'Harbinger'
  }
});
