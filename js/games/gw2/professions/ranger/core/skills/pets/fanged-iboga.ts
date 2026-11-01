/**
 * Owns Core Ranger pet skill definitions for the Fanged Iboga family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import { ACTOR, COMBO_FIELD, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill, SkillDefinition } from '#gw2/platform/skills/types.js';
import { definePetSkill } from '#gw2/professions/ranger/core/skills/pets/pet-skill.js';
import { packAlphaPetRecharge } from '#gw2/professions/ranger/core/traits/beastmastery/pet-attributes.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime } from '#gw2/professions/ranger/types.js';

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
export const RANGER_CORE_FANGED_IBOGA_PET_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.FANG_GRAPPLE]: definePetSkill({
    name: 'Fang Grapple',
    description: 'Beast. Spits a fanged projectile to pull in its prey.',
    icon: 'https://render.guildwars2.com/file/35FD907EDEF66355A431696550722AEBE5D65360/1770559.png',
    petNames: ['Fanged Iboga'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 20,
    quicknessCastTimeMs: 1000,
    effects: impactEffects({ atMs: 1040, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.2,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'control',
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        controlKind: CONTROL.PULL
      }
    ])
  }),
  [ID.CONSUMING_BITE]: definePetSkill({
    name: 'Consuming Bite',
    description: 'Bite foes, dealing additional damage for each condition afflicting anyone struck.',
    icon: new URL('@images/wiki/consuming-bite.png', import.meta.url).href,
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Fanged Iboga'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 0,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 0.45 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]
  }),
  [ID.CRIPPLING_ANGUISH_PET]: definePetSkill({
    name: 'Crippling Anguish',
    description: 'Launch a projectile that inflicts conditions.',
    icon: 'https://render.guildwars2.com/file/DF000038FF639A0601ECBC46222467D6FECE7046/1770580.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Fanged Iboga'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 10,
    autonomousRecharge: 14,
    quicknessAutonomousRecharge: 12,
    quicknessCastTimeMs: 600,
    effects: impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.3,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.CONFUSION,
        stacks: 4,
        duration: 8,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 3,
        duration: 10,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  }),
  [ID.NARCOTIC_SPORES_PET]: definePetSkill({
    name: 'Narcotic Spores',
    description: 'Spit a glob of confusing spores at a foe, inflicting confusion at that location.',
    icon: 'https://render.guildwars2.com/file/510AE44E0E0452005337386A66526522F817424E/1770581.png',
    petFamilySkill: true,
    petAutonomousSkill: true,
    petNames: ['Fanged Iboga'],
    type: 'Profession',
    slot: 'Profession_2',

    cooldown: 15,
    autonomousRecharge: 16.5,
    quicknessCastTimeMs: 720,
    comboFields: [
      {
        ownerId: 'ranger',
        fieldType: COMBO_FIELD.ETHEREAL,
        duration: 6,
        startAnchor: 'castEnd'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [720, 1720, 2720, 3720, 4720, 5720].map((atMs) => ({
          atMs,
          coefficient: 0.1
        })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        ticks: [720, 1720, 2720, 3720, 4720, 5720].map((atMs) => ({
          atMs,
          condition: CONDITION.CONFUSION,
          stacks: 1,
          duration: 8
        })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ])
  })
});

/** Intrinsic live-impact policy stays beside its skill; the shared registry supplies resolution. */
export const rangerConsumingBiteModifier: Gw2ModifierRule = {
  id: 'ranger.consuming-bite-condition-count',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  parameters: {
    maximumConditions: 5,
    coefficientPerCondition: 0.025
  },
  factor: (context, _target, parameters) => {
    const coefficient = Number(context.event?.coefficient || 0);

    if (!(coefficient > 0)) return 1;

    const conditions = Math.min(parameters.maximumConditions, targetConditionCount(context));
    return (coefficient + conditions * parameters.coefficientPerCondition) / coefficient;
  },
  when: (context) => Number(context.event?.skillId ?? context.skillId) === ID.CONSUMING_BITE
};

/** Preserve the Iboga's autonomous policy, including its independent Quickness recharge, outside the scheduler. */
export function ibogaAutonomousRecharge(context: RangerRuntime, skill: Skill, quickness: boolean): number | undefined {
  if (skill.id !== ID.NARCOTIC_SPORES_PET && skill.id !== ID.CRIPPLING_ANGUISH_PET) return undefined;

  const quicknessVariant = skill.id === ID.CRIPPLING_ANGUISH_PET && quickness;
  const cooldown = skillNumber(skill, quicknessVariant ? 'quicknessAutonomousRecharge' : 'autonomousRecharge');
  return quicknessVariant ? cooldown : cooldown * packAlphaPetRecharge(context);
}
