/** Heat scaling belongs to the Holosmith skill family, including both ordinary and Enhanced Capacity tiers. */
import type { ModifierDescriptions } from '#gw2/app/modifier-reference/presentation.js';
import { heatStrikeFacts } from '#gw2/professions/engineer/app/tooltips/shared.js';

export const engineerModifierDescriptions: ModifierDescriptions = {
  'engineer.enhanced-capacity-damage-tier': (context) => {
    const skills = context.catalog.skills.filter(
      (skill) =>
        'highStrikeFactor' in skill &&
        typeof skill.highStrikeFactor === 'number' &&
        'enhancedStrikeFactor' in skill &&
        typeof skill.enhancedStrikeFactor === 'number'
    );
    return {
      name: 'Holosmith — heat-based skill damage',
      category: 'mechanic',
      skills: skills.map((skill) => skill.id),
      icon: context.catalog.specializations.find((line) => line.name === 'Holosmith')!.icon,
      description:
        'Eligible Holosmith skills change their strike damage with heat. Enhanced Capacity Storage Unit unlocks the enhanced tier. Delayed attacks retain their captured tier; other eligible strikes use their current skill tier.',
      facts: skills.flatMap((skill) =>
        heatStrikeFacts(context, skill.id).map((fact) => ({ ...fact, name: `${skill.name} — ${fact.name}` }))
      )
    };
  }
};
