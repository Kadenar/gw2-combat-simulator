import {
  fromProfile,
  outsideScopeTooltip,
  simulationEffectFacts,
  skillTooltip,
  tooltipFactorChange,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { requireSkillFromContext, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { lifeForce } from '#gw2/professions/necromancer/app/tooltips/shared.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

/** Describes implemented Necromancer mechanics locally; numbers remain in selected rules and profiles. */
const barrierTooltip: DescribeSimulationTooltip = skillTooltip(
  'Apply these effects and trigger selected Scourge traits that grant boons when you apply barrier. Barrier absorption and incoming damage are outside simulation scope.'
);

const shadeTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const id = Number(entity.id);
  const description = (
    {
      [ID.MANIFEST_SAND_SHADE]:
        'Manifest a sand shade, striking your target and inflicting torment. Using a shade skill repeats this attack. Sand Savant replaces normal shades with a greater shade.',
      [ID.NEFARIOUS_FAVOR]:
        'Trigger the shared shade attack and remove an active self-condition type. Sadistic Searing adds its Burning effect.',
      [ID.SAND_CASCADE]:
        'Trigger the shared shade attack and applicable barrier traits. Barrier absorption is outside simulation scope.',
      [ID.GARISH_PILLAR]: 'Trigger the shared shade attack and fear your target.',
      [ID.DESERT_SHROUD]:
        'Trigger the shared shade attack, followed by repeated strikes and Torment. Activates applicable shroud and barrier traits.',
      [ID.SANDSTORM_SHROUD]:
        'Trigger the shared shade attack, pulse party protection and barrier traits, then detonate for damage, Torment, and a final protection grant. Activates applicable shroud traits.'
    } as Record<number, string>
  )[id];

  if (!description) throw new Error(`Unknown shade skill: ${id}`);

  const actionId = (
    {
      [ID.GARISH_PILLAR]: 'garishPillar',
      [ID.DESERT_SHROUD]: 'desertShroud',
      [ID.SANDSTORM_SHROUD]: 'sandstormShroud'
    } as Record<number, string>
  )[id];
  const shared = simulationEffectFacts(
    requireSkillAction(requireSkillFromContext(balanceContext, ID.MANIFEST_SAND_SHADE), 'shade').effects.filter(
      (effect) => effect.type !== 'buff'
    ),
    id === ID.MANIFEST_SAND_SHADE ? '' : 'shared shade attack'
  );
  return {
    description,
    facts: [
      ...shared.facts,
      ...(actionId
        ? simulationEffectFacts(requireSkillAction(requireSkillFromContext(balanceContext, id), actionId).effects).facts
        : []),
      ...(id === ID.MANIFEST_SAND_SHADE
        ? (
            [
              [ID.MANIFEST_SAND_SHADE, 'Sand shades'],
              [TRAIT.SAND_SAVANT, 'With Sand Savant']
            ] as const
          ).map(([profile, name]) => {
            // Pair each shade limit with its own lifetime so alternative values stay compact and distinct.
            const ordinary = profile === ID.MANIFEST_SAND_SHADE;
            const owner = ordinary
              ? requireSkillFromContext(balanceContext, profile)
              : tooltipProfile(balanceContext, profile);
            const capacity = { name, detail: String(skillNumber(owner, 'maximumStacks')) };
            const lifetime = simulationEffectFacts(
              (ordinary ? requireSkillAction(owner, 'shade').effects : owner.effects)?.filter(
                (effect) => effect.type === 'buff' && effect.kind === 'active-shade'
              )
            );
            return {
              ...capacity,
              detail: [`${capacity.detail} maximum`, ...lifetime.facts.map((fact) => `${fact.detail} duration`)].join(
                ' · '
              )
            };
          })
        : [])
    ]
  };
};

/** Describe scourge tooltips from the selected balance data. */
export const scourgeTooltips = {
  skills: {
    // Custom descriptions bind to canonical skill IDs independently of execution registration.
    [ID.SERPENT_SIPHON]: barrierTooltip,
    [ID.SAND_FLARE]: barrierTooltip,
    [ID.NEFARIOUS_FAVOR]: shadeTooltip,
    [ID.SAND_CASCADE]: shadeTooltip,
    [ID.GARISH_PILLAR]: shadeTooltip,
    [ID.DESERT_SHROUD]: shadeTooltip,
    [ID.MANIFEST_SAND_SHADE]: shadeTooltip,
    [ID.SANDSTORM_SHROUD]: shadeTooltip
  },
  traits: {
    [TRAIT.MANTLE_OF_SAND]: traitTooltip('This specialization replaces shroud with sand shade skills.'),
    [TRAIT.SAND_SAGE]: traitTooltip('Gain expertise and concentration while a sand shade is active.', [
      ['attributeBonuses.concentration', 'Concentration'],
      ['attributeBonuses.expertise', 'Expertise']
    ]),
    [TRAIT.BLOOD_AS_SAND]: outsideScopeTooltip,
    [TRAIT.ABRASIVE_GRIT]: traitTooltip(
      'Supported barrier applications grant might to recipients.',
      undefined,
      'on barrier application'
    ),
    [TRAIT.FELL_BEACON]: traitTooltip('Gain expertise from condition damage and increase burning damage.', [
      ['attributeConversion', 'Condition damage converted to expertise', tooltipPercent],
      fromProfile(TRAIT.FELL_BEACON, 'conditionDamageMultiplier', 'Burning damage', tooltipFactorChange)
    ]),
    [TRAIT.NOURISHING_ASHES]: traitTooltip(
      'Burning applications generate life force, subject to an internal cooldown.',
      [
        ['lifeForceGain', 'Life force gained', lifeForce],
        ['cooldown', 'Internal cooldown', tooltipSeconds]
      ]
    ),
    [TRAIT.FEED_FROM_CORRUPTION]: outsideScopeTooltip,
    [TRAIT.SADISTIC_SEARING]: traitTooltip('Nefarious Favor inflicts burning.'),
    [TRAIT.HERALD_OF_SORROW]: traitTooltip('Replaces Desert Shroud with Sandstorm Shroud and its barrier pulses.'),
    [TRAIT.SAND_SAVANT]: traitTooltip('Use a single greater sand shade with adjusted shade recharge.', [
      ['maximumStacks', 'Maximum shades'],
      ['rechargePenalty', 'Shade recharge multiplier', (value) => `${value}×`]
    ]),
    [TRAIT.DEMONIC_LORE]: traitTooltip(
      'Torment deals increased damage and can trigger burning.',
      [
        ['cooldown', 'Internal cooldown', tooltipSeconds],
        fromProfile(TRAIT.DEMONIC_LORE, 'conditionDamageMultiplier', 'Torment damage', tooltipFactorChange)
      ],
      'on torment'
    ),
    // Shade creation grants barrier; accepted barrier applications then grant Alacrity.
    [TRAIT.DESERT_EMPOWERMENT]: (balanceContext) => {
      const effects = tooltipProfile(balanceContext, TRAIT.DESERT_EMPOWERMENT).effects;
      return {
        description: 'Manifesting a shade grants barrier. Supported barrier applications grant alacrity to recipients.',
        facts: [
          ...simulationEffectFacts(
            effects?.filter((effect) => effect.type === 'buff' && effect.kind === 'barrier'),
            'on shade creation'
          ).facts,
          ...simulationEffectFacts(
            effects?.filter((effect) => effect.type !== 'buff' || effect.kind !== 'barrier'),
            'on barrier application'
          ).facts
        ]
      };
    }
  }
} satisfies ProfessionTooltips;
