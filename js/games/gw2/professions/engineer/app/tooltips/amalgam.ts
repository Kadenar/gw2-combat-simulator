import {
  fromProfile,
  modifierFact,
  outsideScopeTooltip,
  profileFact,
  simulationEffectFacts,
  skillFact,
  skillTooltip,
  tooltipDecimal,
  tooltipFactorChange,
  tooltipNumber,
  tooltipPercent,
  tooltipProfile,
  tooltipSeconds,
  traitTooltip,
  type DescribeSimulationTooltip,
  type ProfessionTooltips
} from '#gw2/app/shared/simulation-tooltip.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';
import type { SkillId, TooltipFact } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  AMALGAM_MORPH_KIND_BY_SKILL_ID,
  type AmalgamMorphKind
} from '#gw2/professions/engineer/specializations/amalgam/selection-policy.js';
import { amalgamStrainOwnerId } from '#gw2/professions/engineer/specializations/amalgam/skills/strain-owner.js';
import type { AmalgamSkill } from '#gw2/professions/engineer/specializations/amalgam/types.js';

// Describe each protocol's purpose; section headings name the strain so individual facts need not repeat it.
const protocolDescriptions: Record<AmalgamMorphKind, { description: string; strain: string }> = {
  thorns: {
    description: 'Strike your foe. Retaliation pulses require the damaging-field assumption.',
    strain: 'Rapacious Strain'
  },
  obliterate: { description: 'Strike your foe and inflict bleeding.', strain: 'Titanic Strain' },
  demolish: { description: 'Spin to strike foes, then finish with a smash.', strain: 'Berserker Strain' },
  shred: { description: 'Fire projectiles that damage and immobilize your foe.', strain: 'Predator Strain' },
  pierce: { description: 'Strike your foe, stunning them and applying vulnerability.', strain: 'Volatile Strain' },
  cleanse: { description: 'Gain protection.', strain: 'Replicating Strain' },
  protect: { description: 'Activate this protocol to trigger Morph and tool-belt traits.', strain: 'Resiliant Strain' }
};

/** Keep recognizable attack phases while omitting repeated skill names and internal packet labels. */
function protocolFacts(effects: readonly SkillEffect[] = []): readonly TooltipFact[] {
  return effects.flatMap((effect) => {
    const strikeLabel =
      effect.name === 'Offensive Protocol: Demolish - Packet 1'
        ? 'Spin damage'
        : effect.name === 'Smash Damage'
          ? 'Smash damage'
          : effect.name === 'Initial Damage'
            ? 'Initial damage'
            : 'Strike damage';
    return simulationEffectFacts([{ ...effect, name: undefined }]).facts.map((fact) => ({
      ...fact,
      name: fact.name === 'Strike damage' ? strikeLabel : fact.name
    }));
  });
}

/** Section context owns the strain's name and trigger; numeric facts still read its simulation owner. */
function strainFacts(balanceContext: ProfessionBalanceContext, skillId: SkillId): readonly TooltipFact[] {
  const kind = AMALGAM_MORPH_KIND_BY_SKILL_ID.get(skillId);
  skillId = amalgamStrainOwnerId(skillId);
  const skill = balanceContext.catalog.skillsById.get(skillId)!;
  const effects = requireSkillAction(skill, 'strain').effects;
  const facts = protocolFacts(effects).map((fact) => ({
    ...fact,
    name: kind === 'thorns' && fact.name === 'Strike damage' ? 'Bonus strike damage' : fact.name
  }));

  if (kind === 'thorns')
    facts.push(
      skillFact(balanceContext, skillId, 'rapaciousDuration', 'Duration', tooltipSeconds),
      skillFact(balanceContext, skillId, 'rapaciousInternalCooldown', 'Internal cooldown', tooltipSeconds)
    );

  if (kind === 'obliterate')
    facts.push(
      skillFact(
        balanceContext,
        skillId,
        'titanicAttributePerStack',
        'Power and Condition Damage per Might stack',
        (value) => `${value > 0 ? '+' : ''}${tooltipDecimal(value)}`
      )
    );

  return facts;
}

const amalgamMorphTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id)!;
  const kind = AMALGAM_MORPH_KIND_BY_SKILL_ID.get(entity.id)!;
  const { description, strain } = protocolDescriptions[kind];
  const facts = [...protocolFacts(selected.effects)];

  if (kind === 'thorns') {
    facts.push(
      ...protocolFacts(requireSkillAction(selected, 'retaliation').effects).map((fact) => ({
        ...fact,
        name: fact.name === 'Strike damage' ? 'Damage per retaliation pulse' : fact.name
      })),
      // Present the retaliation window as the named effect, using its skill icon and selected pulse tuning.
      {
        name: `Thorns (${tooltipDecimal(tooltipNumber(selected, 'maximumStacks') * tooltipNumber(selected, 'retaliationInterval'))} sec)`,
        detail: 'Deal damage to nearby enemies when struck.',
        icon: selected.icon
      },
      skillFact(balanceContext, selected.id, 'retaliationInterval', 'Retaliation interval', tooltipSeconds)
    );
  }

  const strainDescription = 'Granted by Evolve, or by this protocol with Silver Lining.';
  return {
    description,
    facts,
    factSections: [
      {
        label: strain,
        description:
          kind === 'thorns'
            ? `${strainDescription} Adds damage to eligible subsequent strikes.`
            : kind === 'obliterate'
              ? `${strainDescription} Might grants extra attributes while the strain lasts.`
              : strainDescription,
        facts: strainFacts(balanceContext, selected.id)
      }
    ]
  };
};

// Keep Evolve focused on its form bonus; each protocol tooltip owns its strain details instead of repeating every slot.
const evolveTooltip: DescribeSimulationTooltip = skillTooltip<AmalgamSkill>(
  'Enter Evolved form, increasing attributes and granting the strains of your equipped protocols. See each protocol tooltip for its strain effects. With Silver Lining, activating protocols grants strains instead. With Symbiotic Synergy, Evolve also recharges your protocols.',
  (balanceContext, skill) => [
    { name: 'Evolved duration', detail: tooltipSeconds(tooltipNumber(skill, 'duration')) },
    skill.id === ID.EVOLVE_DOUBLE_HELIX
      ? profileFact(
          balanceContext,
          TRAIT.DOUBLE_HELIX,
          'coefficientMultiplier',
          'Eligible attribute increase',
          tooltipFactorChange
        )
      : {
          name: 'Eligible attribute increase',
          detail: tooltipFactorChange(tooltipNumber(skill, 'attributeMultiplier'))
        }
  ]
);

const plasmaticStateTooltip: DescribeSimulationTooltip = skillTooltip(
  'Strike and burn foes, starting a temporary outgoing-damage bonus with the first strike.',
  (balanceContext, skill) => [
    { name: 'Damage bonus duration', detail: tooltipSeconds(tooltipNumber(skill, 'duration')) },
    modifierFact(balanceContext, 'engineer.plasmatic-state-strike', 'amount', 'Strike damage'),
    modifierFact(balanceContext, 'engineer.plasmatic-state-condition', 'amount', 'Condition damage')
  ]
);

/** Describe amalgam tooltips from the selected balance data. */
export const amalgamTooltips = {
  skills: {
    ...Object.fromEntries([...AMALGAM_MORPH_KIND_BY_SKILL_ID.keys()].map((id) => [id, amalgamMorphTooltip])),
    ...Object.fromEntries([ID.EVOLVE_BASE, ID.EVOLVE_DOUBLE_HELIX].map((id) => [id, evolveTooltip])),
    [ID.PLASMATIC_STATE]: plasmaticStateTooltip
  },
  traits: {
    [TRAIT.EXPERIMENTAL_UNION]: traitTooltip(
      'Replace toolbelt skills with selected protocols and Evolve. Protocols grant the corresponding Morph effects.'
    ),
    [TRAIT.HYBRID_VIGOR]: traitTooltip('Gain vitality.', [['attributeBonuses.vitality', 'Vitality']]),
    [TRAIT.WILLING_HOST]: traitTooltip('Using a protocol temporarily increases player strike and condition damage.', [
      fromProfile(TRAIT.WILLING_HOST, 'damageIncrease', 'Strike damage', tooltipPercent),
      fromProfile(TRAIT.WILLING_HOST, 'conditionDamageIncrease', 'Condition damage', tooltipPercent),
      ['duration', 'Bonus duration', tooltipSeconds]
    ]),
    [TRAIT.STAINLESS_STEEL]: outsideScopeTooltip,
    [TRAIT.INNERVATING_ALLOY]: outsideScopeTooltip,
    [TRAIT.HARDENED_CHROME]: traitTooltip('Protocols and Evolve grant protection, with a longer duration on Evolve.', [
      ['minimumStacks', 'Protocol protection duration', tooltipSeconds],
      ['maximumStacks', 'Evolve protection duration', tooltipSeconds]
    ]),
    [TRAIT.CARBOLIC_COMPOSITION]: traitTooltip(
      'Eligible Amalgam and Rapacious Strain strikes inflict poison. Poison lasts longer.',
      [['conditionDurationBonus', 'Poison duration', tooltipPercent]]
    ),
    [TRAIT.MERCURIAL_TENDENCIES]: traitTooltip('Applying a control effect reduces active Evolve cooldowns.', [
      ['internalCooldown', 'Internal cooldown', tooltipSeconds],
      ['rechargeReduction', 'Recharge reduction', tooltipSeconds]
    ]),
    [TRAIT.SILVER_LINING]: traitTooltip(
      'Protocols grant their corresponding strain immediately. Evolve no longer grants the selected strains.'
    ),
    [TRAIT.SYMBIOTIC_SYNERGY]: traitTooltip('Morph strikes deal increased damage. Evolve recharges Morph skills.', [
      fromProfile(TRAIT.SYMBIOTIC_SYNERGY, 'damageIncrease', 'Morph strike damage', tooltipPercent)
    ]),
    [TRAIT.NEW_GENES]: (balanceContext, entity) => ({
      description:
        'Using a Morph skill grants alacrity and might to you and nearby allies. Each Morph skill also grants the additional boon listed below.',
      // Render each boon once and replace internal packet names with the Morph skill that grants it.
      facts: (tooltipProfile(balanceContext, entity.id).effects || []).flatMap((effect) => {
        const trigger = effect.metadata?.trigger;
        const qualifier = trigger
          ? `${trigger.replace(/^\w/, (letter) => letter.toUpperCase())} only`
          : 'All Morph skills';
        return simulationEffectFacts([{ ...effect, name: undefined }], qualifier).facts;
      })
    }),
    [TRAIT.DOUBLE_HELIX]: traitTooltip(
      'Evolve gains ammunition and a stronger attribute increase from its eligible attribute pool.',
      (balanceContext) => [
        {
          name: 'Evolve ammunition',
          detail: tooltipDecimal(tooltipNumber(balanceContext.catalog.skillsById.get(ID.EVOLVE_DOUBLE_HELIX), 'ammo'))
        },
        profileFact(
          balanceContext,
          TRAIT.DOUBLE_HELIX,
          'coefficientMultiplier',
          'Eligible attribute increase',
          tooltipFactorChange
        )
      ]
    )
  }
} satisfies ProfessionTooltips;
