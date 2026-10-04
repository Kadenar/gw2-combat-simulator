/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { warriorAmmunition } from '#gw2/professions/warrior/core/mechanics/ammunition.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const WARRIOR_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.GUNSTINGER]: {
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    ammo: 0,
    ammoRecharge: 0,
    cooldown: 15,
    // Gunstinger restores three Dragon's Roar charges after completion.
    sideEffects: [{ on: 'castCommit', do: { type: 'ammoRestore', skillIds: [ID.DRAGONS_ROAR], count: 3 } }],
    castTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 8
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.DRAGONS_ROAR]: {
    // Capture the magazine before depletion; later reloads cannot rewrite its Pistol explosions.
    sideEffects: [{ on: 'castStart', do: { type: 'warrior.spend-magazine' } }],
    effectVariants: [
      {
        profileId: PROFILE.dragonsRoar,
        when: () => true,
        transform(runtime, cast) {
          const bullets = warriorAmmunition.get(cast)!.rounds;
          const profile = requireBalanceProfileFromContext(runtime, PROFILE.dragonsRoar);
          const strike = requireEffect(profile, 'strike', 'Strike');
          if (!strike) return [];
          const durationMs = (cast.effectiveEnd - cast.start) * 1000;
          const first = durationMs * balanceProfileNumber(profile, 'firstPacketRatio');
          const interval = durationMs * balanceProfileNumber(profile, 'packetIntervalRatio');
          return [
            {
              type: 'strike',
              timingAnchor: 'castStart',
              timingScale: 'fixed',
              name: "Dragon's Roar — Damage per Bullet",
              damageKind: 'explosion',
              weapon: 'Pistol',
              ticks: Array.from({ length: bullets }, (_, index) => ({
                atMs: first + index * interval,
                coefficient: effectNumber(profile, strike, 'coefficient')
              }))
            }
          ];
        }
      }
    ],
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    ammo: 6,
    ammoRecharge: 5,
    // Begin the count recharge when the magazine is reserved, so the cast animation does not delay recovery.
    rechargeAnchor: 'castStart',
    cooldown: 5,
    ammoCastLockout: 1,
    castTimeMs: 560,
    effects: []
  }
});
