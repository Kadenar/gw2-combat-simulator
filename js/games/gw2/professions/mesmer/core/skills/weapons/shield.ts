/** Canonical Core mesmer skill definitions grouped by their GW2 owner. */
import { ACTOR, WEAPON } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export const MESMER_WEAPONS_SHIELD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<MesmerSkill>>> =
  Object.freeze({
    [ID.ECHO_OF_MEMORY]: {
      name: 'Echo of Memory',
      description:
        'Phantasm. Block incoming attacks for a short duration. If this skill fully channels, summon a phantasm that slows enemies and grants protection to allies. If an attack is blocked, Deja Vu is usable for a short time and the phantasm is summoned immediately.',
      icon: 'https://render.guildwars2.com/file/2B05E7099BC15D3A55C90D33AEB6939204DB92EA/1012889.png',
      type: 'Weapon',
      weapon: 'Shield',
      slot: 'Weapon_4',

      cooldown: 30,
      // The summon owns its attack and conversion timeline independently of the player cast.
      phantasmTiming: {
        damageAtMs: 1440,
        spawnAtMs: 2160
      },
      phantasm: true,
      resource: {
        mode: 'phantasm',
        count: 1
      },
      castTimeMs: 1640,
      effects: [
        {
          type: 'strike',
          coefficient: 0.9,
          hits: 1,
          name: 'Damage',
          actorType: ACTOR.SUMMON,
          summonKind: 'phantasm',
          weapon: 'phantasm medium'
        }
      ],
      sideEffects: [{ on: 'castStart', do: { type: 'mesmer.summon-phantasm' } }]
    },
    [ID.TIDES_OF_TIME]: {
      name: 'Tides of Time',
      description:
        'Grant boons to nearby allies as you launch a wave of temporal energy that damages and stops enemies it passes through, then returns to you. Touching the returning wave reduces the recharge of this skill.',
      icon: 'https://render.guildwars2.com/file/6FFACCD661056FE05F7AA6050A3DFCC8045C0A91/1012890.png',
      type: 'Weapon',
      weapon: 'Shield',
      slot: 'Weapon_5',
      cooldown: 35,
      castTimeMs: 680,
      effects: [
        // Preserve this skill's existing cast-completion CC timing in its own definition.
        {
          type: 'control',
          source: 'Player',
          actorType: ACTOR.PLAYER,
          atMs: 0,
          timingAnchor: 'castEnd',
          timingScale: 'fixed'
        },
        {
          type: 'strike',
          coefficient: 1.5,
          hits: 1,
          name: 'Damage',
          actorType: ACTOR.PLAYER,
          weapon: WEAPON.SHIELD.toLowerCase()
        }
      ]
    }
  });
