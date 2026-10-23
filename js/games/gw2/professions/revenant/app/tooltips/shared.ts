import { RECIPIENT } from '#gw2/platform/constants.js';
import {
  simulationEffectFacts,
  skillTooltip,
  tooltipNumber,
  tooltipSeconds,
  type DescribeSimulationTooltip,
  type SimulationTooltip
} from '#gw2/app/shared/simulation-tooltip.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { selectedTraits } from '#gw2/professions/shared/trait-data.js';

/** Share tooltip formatting and descriptions used by multiple profession owners. */

/** Describe only the landing and modifiers selected by this build, matching the simulated dodge choice. */
export const vindicatorDodgeTooltip: DescribeSimulationTooltip = (balanceContext, _entity, _specialization, build) => {
  const traits = new Set(selectedTraits(balanceContext.catalog, build?.specializations).map((trait) => trait.id));
  const landingId = traits.has(TRAIT.SAINT_OF_ZU_HELTZER)
    ? ID.SAINTS_SHIELD
    : traits.has(TRAIT.VASSALS_OF_THE_EMPIRE)
      ? ID.IMPERIAL_IMPACT
      : ID.DEATH_DROP;
  const landing = balanceContext.catalog.skillsById.get(landingId)!;
  return {
    ...simulationEffectFacts(landing.effects, landing.name),
    description: [
      `Spend endurance to leap, then land with ${landing.name}.`,
      traits.has(TRAIT.REAVERS_CURSE) ? "Reaver's Curse can empower the next landing." : '',
      landingId === ID.DEATH_DROP && traits.has(TRAIT.FORERUNNER_OF_DEATH)
        ? 'Death Drop starts its Forerunner of Death bonus after its own damage resolves.'
        : ''
    ]
      .filter(Boolean)
      .join(' ')
  };
};

/** Put requirement-specific effects in tabs while shared effects stay visible with every selection. */
export function variantEffects(effects: readonly SkillEffect[] = [], context = '') {
  const labels: Readonly<Record<string, string>> = {
    LegendaryAssassin: 'Assassin',
    LegendaryDemon: 'Demon',
    LegendaryDwarf: 'Dwarf',
    LegendaryCentaur: 'Centaur',
    LegendaryDragon: 'Dragon',
    LegendaryRenegade: 'Renegade',
    LegendaryAlliance: 'Alliance',
    LegendaryEntity: 'Entity',
    'entity-skill': 'using an Entity skill',
    // Keep the heal's Shared Wisdom boon grouped with its granting skill.
    'shielding-hands': 'Shielding Hands',
    'beguiling-haze': 'Beguiling Haze',
    'hex-eater-vortex': 'Hex Eater Vortex',
    'gladiators-defense': "Gladiator's Defense",
    'twin-moon-sweep': 'Twin Moon Sweep',
    'diabolic-inferno': 'requires Diabolic Inferno'
  };
  const facts: SimulationTooltip['facts'][number][] = [];
  const tabs = new Map<string, SimulationTooltip['facts'][number][]>();
  let incomplete = false;
  for (const effect of effects) {
    const key = effect.metadata?.legendId ?? effect.metadata?.trigger;
    const qualifier = typeof key === 'string' ? labels[key] : '';

    if (key != null && !qualifier) throw new Error(`Unknown Revenant tooltip variant: ${key}`);

    const shared = key == null || key === 'entity-skill';
    const model = simulationEffectFacts([effect], [context, shared ? qualifier : ''].filter(Boolean).join(' · '));
    incomplete ||= !!model.incomplete;

    if (shared) facts.push(...model.facts);
    else tabs.set(qualifier, [...(tabs.get(qualifier) || []), ...model.facts]);
  }

  return { facts, factTabs: [...tabs].map(([label, facts]) => ({ label, facts })), incomplete };
}

export const upkeepTooltip: DescribeSimulationTooltip = (balanceContext, entity) => {
  const selected = balanceContext.catalog.skillsById.get(entity.id)! as RevenantSkill;
  const pulse = selected.upkeepPulse;
  return {
    description: pulse
      ? 'Maintain this facet to pulse its boon to your party while draining energy. Its consume skill stops the upkeep. Draconic Echo can retain the passive temporarily after consumption.'
      : 'Maintain this skill while draining energy. Its recurring effects stop when the upkeep ends or energy is exhausted.',
    facts: [
      ...simulationEffectFacts(selected.effects, 'per upkeep pulse').facts,
      ...(pulse
        ? simulationEffectFacts(
            [
              {
                type: 'boon',
                boon: pulse.kind,
                duration: pulse.duration,
                stacks: pulse.stacks,
                audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
              }
            ],
            'per upkeep pulse'
          ).facts
        : []),
      ...(selected.pulseInterval == null
        ? []
        : [{ name: 'Pulse interval', detail: tooltipSeconds(selected.pulseInterval) }])
    ]
  };
};

export const upkeepReleaseTooltip: DescribeSimulationTooltip = skillTooltip(
  "End the parent skill's upkeep and stop its recurring effects.",
  (balanceContext, entity) => {
    const parent = entity.flipParentId == null ? undefined : balanceContext.catalog.skillsById.get(entity.flipParentId);
    return parent?.manualReleaseCooldown == null
      ? []
      : [
          {
            name: 'Parent cooldown on release',
            detail: tooltipSeconds(tooltipNumber(parent, 'manualReleaseCooldown'))
          }
        ];
  }
);
