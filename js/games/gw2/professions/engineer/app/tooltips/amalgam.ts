import { amalgamStrainOwnerId } from '#gw2/professions/engineer/specializations/amalgam/skills/strain-owner.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import {
  fromProfile,
  tooltipFactorChange,
  tooltipSeconds,
  outsideScopeTooltip,
  traitTooltip,
  skillTooltip,
  profileFact,
  skillFact,
  modifierFact,
  tooltipPercent,
  tooltipDecimal,
  tooltipNumber,
  tooltipProfile,
  simulationEffectFacts,
  type ProfessionTooltips,
  type DescribeSimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import { AMALGAM_MORPH_KIND_BY_SKILL_ID } from '#gw2/professions/engineer/specializations/amalgam/selection-policy.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { TooltipFact, SkillId } from '#gw2/platform/skills/types.js';
import type { ProfessionBalanceContext } from '#gw2/platform/profession-definition/balance-context.js';

/** Strain wording records the state transition; numerical durations and proc packets stay with their simulation owners. */
function strainFacts(
  balanceContext: ProfessionBalanceContext,
  skillId: SkillId,
  qualifier: string
): readonly TooltipFact[] {
  const kind = AMALGAM_MORPH_KIND_BY_SKILL_ID.get(skillId);
  skillId = amalgamStrainOwnerId(skillId);
  const skill = balanceContext.catalog.skillsById.get(skillId)!;
  const effects = requireSkillAction(skill, 'strain').effects;
  const facts = simulationEffectFacts(
    effects,
    kind === 'thorns' ? `${qualifier} · per eligible subsequent strike` : qualifier
  ).facts.slice();

  if (kind === 'thorns')
    facts.push(
      skillFact(balanceContext, skillId, 'rapaciousDuration', 'Rapacious Strain duration', tooltipSeconds),
      skillFact(
        balanceContext,
        skillId,
        'rapaciousInternalCooldown',
        'Rapacious Strain internal cooldown',
        tooltipSeconds
      )
    );

  if (kind === 'obliterate')
    facts.push(
      skillFact(
        balanceContext,
        skillId,
        'titanicAttributePerStack',
        'Additional Power and Condition Damage per Might stack'
      )
    );

  return facts;
}

const amalgamMorphTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id)!;
  const kind = AMALGAM_MORPH_KIND_BY_SKILL_ID.get(entity.id);
  const facts = [...simulationEffectFacts(selected.effects).facts];
  let description =
    'Activate this protocol and apply supported Morph and tool-belt traits. Silver Lining grants its corresponding strain on activation; otherwise Evolve grants selected strains.';

  if (kind === 'thorns') {
    description += ' Retaliation pulses require the damaging-field assumption.';
    facts.push(
      ...simulationEffectFacts(
        requireSkillAction(selected, 'retaliation').effects,
        'per retaliation pulse; requires damaging-field assumption'
      ).facts,
      skillFact(balanceContext, selected.id, 'maximumStacks', 'Retaliation pulses'),
      skillFact(balanceContext, selected.id, 'retaliationInterval', 'Retaliation interval', tooltipSeconds)
    );
  }

  if (kind) facts.push(...strainFacts(balanceContext, selected.id, 'requires Silver Lining'));

  // Predator and Berserker windows display strain uptime; only their authored boons affect combat.
  if (kind === 'demolish') description += ' Its strain grants stability and displays the Berserker Strain window.';

  if (kind === 'obliterate') description += ' Its strain also grants power per might stack.';

  if (kind === 'shred')
    description += ' Its strain grants quickness and superspeed and displays the Predator Strain window.';

  return { description, facts };
};

const evolveTooltip: DescribeSimulationTooltip = skillTooltip(
  'Enter Evolved form, increasing eligible attributes. Apply strains for the selected protocols, unless Silver Lining moved those grants to protocol activations. Symbiotic Synergy also recharges selected protocols. Double Helix selects the ammunition variant and larger attribute bonus.',
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
        },
    // Slot identities can be patched independently; report each actual owner.
    ...[...AMALGAM_MORPH_KIND_BY_SKILL_ID].flatMap(([id, kind]) =>
      strainFacts(
        balanceContext,
        id,
        `${kind} protocol in F${balanceContext.catalog.skillsById.get(id)!.mechanicSlot}; without Silver Lining`
      )
    )
  ]
);

const plasmaticStateTooltip: DescribeSimulationTooltip = skillTooltip(
  'Strike and burn foes, starting a temporary outgoing-damage bonus with the first strike.',
  (balanceContext, skill) => [
    { name: 'Damage bonus duration', detail: tooltipSeconds(tooltipNumber(skill, 'duration')) },
    modifierFact(balanceContext, 'engineer.plasmatic-state', 'amount', 'Strike and condition damage')
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
