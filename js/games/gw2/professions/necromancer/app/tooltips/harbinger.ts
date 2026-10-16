import {
  fromProfile,
  profileFact,
  simulationEffectFacts,
  tooltipFactorChange,
  tooltipNumber,
  tooltipPercent,
  tooltipProfile,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { darkBarrageEffects } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/dark-barrage.js';
import {
  HARBINGER_BALANCE_PROFILE_IDS as HARBINGER,
  HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID
} from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';
import { lifeForce, shroudTooltip } from '#gw2/professions/necromancer/app/tooltips/shared.js';

/** Base and empowered packets are alternatives; spending happens before the elixir grants fresh Blight. */
const empoweredSkill: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id);

  if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);

  const profile = tooltipProfile(balanceContext, HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(entity.id)]);
  const elixir = selected.categories?.includes('Elixir');
  const base = simulationEffectFacts(selected.effects);
  const empowered = simulationEffectFacts(profile.effects);
  return {
    description: elixir
      ? "Throw an elixir. With enough Blight, consume the required stacks and use the empowered effects instead. Gain fresh Blight after the attack. Twisted Medicine shares the elixir's boons with your party."
      : `Strike your target. With enough Blight, consume the required stacks and use the empowered effects instead.${Number(entity.id) === ID.VORACIOUS_ARC ? ' Also apply control: daze normally, or fear with Doom Approaches.' : ''}`,
    facts: [
      { name: 'Blight required and consumed', detail: String(tooltipNumber(profile, 'blightCost')) },
      ...(elixir ? [{ name: 'Blight gained afterward', detail: String(tooltipNumber(profile, 'blightGain')) }] : [])
    ],
    factTabs: [
      { label: 'Base effects', facts: base.facts },
      { label: 'Enhanced effects', facts: empowered.facts }
    ],
    incomplete: base.incomplete || empowered.incomplete
  };
};

const darkBarrageTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id);

  if (!selected) throw new Error(`Missing tooltip skill: ${entity.id}`);

  const base = simulationEffectFacts(selected.effects, 'without Doom Approaches');
  const profile = tooltipProfile(balanceContext, HARBINGER.darkBarrageDoomApproaches);
  const replacement = simulationEffectFacts(
    darkBarrageEffects(profile, profile.effects ?? []),
    'with Doom Approaches; replaces base volley'
  );
  return {
    description:
      'Channel a volley of strikes, each applying Torment. Doom Approaches replaces the ordinary volley with a faster sequence. Interruption retains only the projectiles already fired.',
    facts: [...base.facts, ...replacement.facts],
    incomplete: base.incomplete || replacement.incomplete
  };
};

const elixirTooltip: DescribeSimulationTooltip = empoweredSkill;

const blightSkillTooltip: DescribeSimulationTooltip = empoweredSkill;

/** Describe harbinger tooltips from the selected balance data. */
export const harbingerTooltips = {
  skills: {
    [ID.DARK_BARRAGE]: darkBarrageTooltip,
    [ID.ELIXIR_OF_BLISS]: elixirTooltip,
    [ID.ELIXIR_OF_RISK]: elixirTooltip,
    [ID.ELIXIR_OF_IGNORANCE]: elixirTooltip,
    [ID.ELIXIR_OF_AMBITION]: elixirTooltip,
    [ID.ELIXIR_OF_ANGUISH]: elixirTooltip,
    [ID.ELIXIR_OF_PROMISE]: elixirTooltip,
    [ID.VORACIOUS_ARC]: blightSkillTooltip,
    [ID.DEVOURING_CUT]: blightSkillTooltip,
    [ID.EXIT_HARBINGER_SHROUD]: shroudTooltip,
    [ID.HARBINGER_SHROUD]: shroudTooltip
  },
  traits: {
    [TRAIT.DARK_DISCIPLE]: traitTooltip(
      'This specialization uses Harbinger Shroud and accumulates blight. Variable player health is not simulated.'
    ),
    [TRAIT.ALCHEMIC_VIGOR]: traitTooltip('Gain vitality.', [['attributeBonus', 'Vitality']]),
    [TRAIT.CORRUPTED_TALENT]: traitTooltip('Entering Harbinger Shroud generates life force.', [
      ['lifeForceGain', 'Life force gained', lifeForce]
    ]),
    [TRAIT.WICKED_CORRUPTION]: traitTooltip(
      'Blight increases strike damage. Critical strikes deal more damage to targets with torment.',
      [
        fromProfile(TRAIT.WICKED_CORRUPTION, 'damageIncreasePerStack', 'Strike damage per blight', tooltipPercent),
        ['criticalDamage', 'Critical damage against tormented targets', tooltipFactorChange]
      ]
    ),
    [TRAIT.BOLSTERING_BREW]: traitTooltip('Elixirs grant protection.', undefined, 'on elixir'),
    [TRAIT.SEPTIC_CORRUPTION]: (balanceContext, entity) => {
      const profile = tooltipProfile(balanceContext, entity.id);
      const effects = simulationEffectFacts(profile.effects, 'on shroud skill 2');
      return {
        ...effects,
        description:
          'Blight increases condition damage.' +
          (profile.effects?.some((effect) => effect.type === 'condition' && effect.condition === 'Poisoned')
            ? ' Shroud skill 2 also inflicts poison.'
            : ''),
        facts: [
          profileFact(
            balanceContext,
            TRAIT.SEPTIC_CORRUPTION,
            'conditionDamageIncreasePerStack',
            'Condition damage per blight',
            tooltipPercent
          ),
          ...effects.facts
        ]
      };
    },
    [TRAIT.IMPLACABLE_FOE]: traitTooltip('Gain ferocity from vitality. Entering Harbinger Shroud grants stability.', [
      ['attributeConversion', 'Vitality converted to ferocity', tooltipPercent]
    ]),
    [TRAIT.TWISTED_MEDICINE]: traitTooltip('Gain concentration from vitality. Elixir boons are shared with allies.', [
      ['attributeConversion', 'Vitality converted to concentration', tooltipPercent]
    ]),
    [TRAIT.DARK_GUNSLINGER]: traitTooltip('Gain expertise from vitality. Pistol skills recharge faster.', [
      ['attributeConversion', 'Vitality converted to expertise', tooltipPercent],
      ['rechargeMultiplier', 'Pistol recharge reduction', (value) => tooltipPercent(1 - value)]
    ]),
    [TRAIT.CASCADING_CORRUPTION]: traitTooltip(
      'Consuming enough blight triggers Meltdown, strike damage, and torment. Meltdown increases strike and condition damage.',
      [
        ['minimumStacks', 'Blight consumed per trigger'],
        fromProfile(TRAIT.CASCADING_CORRUPTION, 'damageIncrease', 'Strike damage during Meltdown', tooltipPercent),
        fromProfile(
          TRAIT.CASCADING_CORRUPTION,
          'conditionDamageIncrease',
          'Condition damage during Meltdown',
          tooltipPercent
        )
      ]
    ),
    [TRAIT.DEATHLY_HASTE]: traitTooltip(
      'Entering Harbinger Shroud and casting Dark Barrage grant quickness and fury to the party.'
    ),
    [TRAIT.DOOM_APPROACHES]: traitTooltip(
      'Gain additional blight in Harbinger Shroud. Tainted Bolts inflicts vulnerability, and Dark Barrage uses its alternate sequence.',
      [['blightGain', 'Blight gained per pulse']]
    )
  }
} satisfies ProfessionTooltips;
