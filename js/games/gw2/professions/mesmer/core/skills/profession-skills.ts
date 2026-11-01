/** Canonical Core mesmer skill definitions grouped by their GW2 owner. */
import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import type { MesmerShatterDefinition } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { shatterSkill } from '#gw2/professions/mesmer/core/skills/shatter.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

export const MESMER_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<MesmerSkill>>> =
  Object.freeze({
    [ID.CRY_OF_FRUSTRATION]: {
      name: 'Cry of Frustration',
      description:
        'Shatter. Destroy all your clones, confusing nearby foes. The shatter effect also occurs at your location.',
      icon: 'https://render.guildwars2.com/file/B8E57C1F08727AF8C39066160B93D175B6A3B9BA/103731.png',
      type: 'Profession',
      slot: 'Profession_2',
      cooldown: 25,
      // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
      ...shatterSkill({
        slot: 2,
        kind: CONDITION.CONFUSION.toLowerCase(),
        resolver: 'mesmer.core.clone-shatter',
        coefficients: [0.42, 0.84, 1.25, 1.67],
        effects: [
          { name: CONDITION.CONFUSION, type: 'condition', condition: CONDITION.CONFUSION, duration: 3, stacks: 1 }
        ]
      }),
      lockouts: [
        {
          group: 'mesmer.shatter',
          durationMs: 50
        }
      ],
      rechargeAnchor: 'castStart',
      castTimeMs: 0,
      effects: []
    },
    [ID.MIND_WRACK]: {
      name: 'Mind Wrack',
      description:
        'Shatter. Destroy all your clones, damaging nearby foes. The shatter effect also occurs at your location.',
      icon: 'https://render.guildwars2.com/file/52619C5D4F9A61C8F37A0705AE36602F19E164C2/103732.png',
      type: 'Profession',
      slot: 'Profession_1',
      cooldown: 12,
      // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
      ...shatterSkill({
        slot: 1,
        kind: 'power',
        resolver: 'mesmer.core.clone-shatter',
        coefficients: [0.81, 1.61, 2.42, 3.22]
      }),
      lockouts: [
        {
          group: 'mesmer.shatter',
          durationMs: 50
        }
      ],
      rechargeAnchor: 'castStart',
      castTimeMs: 0,
      effects: []
    },
    [ID.DISTORTION]: {
      name: 'Distortion',
      description:
        'Shatter. Gain distortion and destroy all your clones, gaining additional distortion for each one shattered.',
      icon: 'https://render.guildwars2.com/file/D0969802A76808ACD65A56A6D54F2A40E355F7C3/103284.png',
      type: 'Profession',
      slot: 'Profession_4',
      cooldown: 50,
      // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
      ...shatterSkill({
        slot: 4,
        kind: 'defense',
        resolver: 'mesmer.core.clone-shatter',
        coefficients: [0, 0, 0, 0]
      }),
      lockouts: [
        {
          group: 'mesmer.shatter',
          durationMs: 50
        }
      ],
      rechargeAnchor: 'castStart',
      castTimeMs: 0,
      effects: []
    },
    [ID.DIVERSION]: {
      name: 'Diversion',
      description:
        'Shatter. Destroy all your clones, dazing their targets. The shatter effect also occurs at your location.',
      icon: 'https://render.guildwars2.com/file/0BD64508BF40EFFF3299DFA3D1A63BF2F941A4C9/103769.png',
      type: 'Profession',
      slot: 'Profession_3',
      cooldown: 38,
      // Skill-owned resource policy and patchable packet tiers feed the shared transaction.
      ...shatterSkill({
        slot: 3,
        kind: 'control',
        resolver: 'mesmer.core.clone-shatter',
        coefficients: [0, 0, 0, 0]
      }),
      lockouts: [
        {
          group: 'mesmer.shatter',
          durationMs: 50
        }
      ],
      rechargeAnchor: 'castStart',
      castTimeMs: 0,
      // The shatter owns its control effect rather than relying on the core CC skill list.
      effects: [
        {
          type: 'control',
          source: 'Player',
          controlKind: CONTROL.DAZE,
          actorType: ACTOR.PLAYER,
          atMs: 0,
          timingAnchor: 'castEnd',
          timingScale: 'fixed'
        }
      ]
    }
  });

// Profile and runtime registries project the same skill-owned recipe.
export const MESMER_CORE_SHATTERS: Readonly<Record<number, MesmerShatterDefinition>> = Object.freeze(
  Object.fromEntries(
    Object.entries(MESMER_PROFESSION_SKILLS_SKILL_MECHANICS).flatMap(([id, skill]) =>
      skill.shatter ? [[Number(id), skill.shatter]] : []
    )
  )
);
