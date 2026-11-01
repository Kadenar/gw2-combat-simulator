/** Canonical Core warrior skill definitions grouped by their GW2 owner. */
import { BOON, CONDITION, WEAPON } from '#gw2/platform/constants.js';
import { effectNumber, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { warriorAmmunition } from '#gw2/professions/warrior/core/mechanics/ammunition.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

// Dragon's Roar bullets land at fixed fractions of its cast: the first at 6/7, then one every 2/7.
const DRAGONS_ROAR_FIRST_PACKET_RATIO = 6 / 7;
const DRAGONS_ROAR_PACKET_INTERVAL_RATIO = 2 / 7;

export const WARRIOR_WEAPONS_PISTOL_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.GUNSTINGER]: {
    name: 'Gunstinger',
    description: 'Quickly step forward to strike your foe while reloading your gun. Restores ammo to skill 5.',
    icon: 'https://render.guildwars2.com/file/61C209FC314798A0EDD27F91E04B0F561C5352C0/2491641.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_4',
    ammoCastLockout: 15,
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,

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
    name: "Dragon's Roar",
    description:
      'Fire all the barrels in your hand cannon to deal damage to foes in front of you. This skill consumes all your ammo when fired and pushes you back slightly based on the amount of ammo expended.',
    icon: 'https://render.guildwars2.com/file/06F0D4DB943A7967574D02708093700A97540F24/2491642.png',
    type: 'Weapon',
    weapon: 'Pistol',
    slot: 'Weapon_5',
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    ammo: 6,

    // Begin the count recharge when the magazine is reserved, so the cast animation does not delay recovery.
    rechargeAnchor: 'castStart',
    cooldown: 5,
    ammoCastLockout: 1,
    castTimeMs: 560,
    effects: [{ name: 'Strike', type: 'strike', coefficient: 0.75, hits: 1 }],
    // The selected magazine packet expands only after ammunition has been captured.
    effectVariants: [
      {
        when: () => true,
        transform(_runtime, cast) {
          const bullets = warriorAmmunition.get(cast)!.rounds;
          const profile = cast.skill;
          const strike = requireEffect(profile, 'strike', 'Strike');

          if (!strike) return [];

          const durationMs = (cast.effectiveEnd - cast.start) * 1000;
          const first = durationMs * DRAGONS_ROAR_FIRST_PACKET_RATIO;
          const interval = durationMs * DRAGONS_ROAR_PACKET_INTERVAL_RATIO;
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
