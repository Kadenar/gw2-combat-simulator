import { WEAPON, BOON, CONDITION } from '#gw2/platform/constants.js';
/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { warriorAmmunition } from '#gw2/professions/warrior/core/mechanics/ammunition.js';
import { skillNumber, effectNumber, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const WARRIOR_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.GUNSTINGER]: {
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    ammo: 0,
    ammoRecharge: 0,
    cooldown: 15,
    castTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 5,
        duration: 8
      },
      {
        type: 'boon',
        boon: BOON.AEGIS,
        duration: 3,
        stacks: 1
      }
    ],
    // Gunstinger restores three Dragon's Roar charges after completion.
    sideEffects: [{ on: 'castCommit', do: { type: 'ammoRestore', skillIds: [ID.DRAGONS_ROAR], count: 3 } }]
  },
  [ID.DRAGONS_ROAR]: {
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    ammo: 6,
    ammoRecharge: 5,
    // Begin the count recharge when the magazine is reserved, so the cast animation does not delay recovery.
    rechargeAnchor: 'castStart',
    cooldown: 5,
    ammoCastLockout: 1,
    castTimeMs: 560,
    // The selected magazine packet expands only after ammunition has been captured.
    firstPacketRatio: 6 / 7,
    packetIntervalRatio: 2 / 7,
    effects: [{ name: 'Strike', type: 'strike', coefficient: 0.75, hits: 1 }],
    effectVariants: [
      {
        when: () => true,
        transform(_runtime, cast) {
          const bullets = warriorAmmunition.get(cast)!.rounds;
          const profile = cast.skill;
          const strike = requireEffect(profile, 'strike', 'Strike');

          if (!strike) return [];

          const durationMs = (cast.effectiveEnd - cast.start) * 1000;
          const first = durationMs * skillNumber(profile, 'firstPacketRatio');
          const interval = durationMs * skillNumber(profile, 'packetIntervalRatio');
          return [
            {
              type: 'strike',
              timingAnchor: 'castStart',
              timingScale: 'fixed',
              name: "Dragon's Roar — Damage per Bullet",
              damageKind: 'explosion',
              weapon: WEAPON.PISTOL,
              ticks: Array.from({ length: bullets }, (_, index) => ({
                atMs: first + index * interval,
                coefficient: effectNumber(profile, strike, 'coefficient')
              }))
            }
          ];
        }
      }
    ],
    // Capture the magazine before depletion; later reloads cannot rewrite its Pistol explosions.
    sideEffects: [{ on: 'castStart', do: { type: 'warrior.spend-magazine' } }]
  }
});
