/** Explain Necromancer's conditional skill bonuses and shared shout family using selected rule values. */
import { modifierDescription, type ModifierDescriptions } from '#gw2/app/modifier-reference/presentation.js';
import { tooltipFactorChange } from '#gw2/app/shared/simulation-tooltip.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

export const necromancerModifierDescriptions: ModifierDescriptions = {
  'necromancer.essence-blast-active-spirits': modifierDescription({
    name: 'Essence Blast — bonus per active spirit',
    skills: [ID.ESSENCE_BLAST],
    description:
      "Active spirits increase Essence Blast's damage. Their bonuses add together before multiplying the attack's damage.",
    facts: [['damagePerSpirit', 'Strike damage per active spirit']]
  }),
  'necromancer.ghastly-claws-vulnerability': modifierDescription({
    name: 'Ghastly Claws — Vulnerability bonus',
    skills: [ID.GHASTLY_CLAWS],
    description:
      "Ghastly Claws gains additional damage per Vulnerability stack, multiplying separately from the target's ordinary Vulnerability bonus.",
    facts: [['damagePerStack', 'Additional strike damage per Vulnerability stack']]
  }),
  'necromancer.life-siphon-bleeding-target': modifierDescription({
    name: 'Life Siphon — bleeding target',
    skills: [ID.LIFE_SIPHON],
    description: 'Life Siphon deals increased strike damage while the target is bleeding.',
    facts: [['factor', 'Strike damage against a bleeding target', tooltipFactorChange]]
  }),
  'necromancer.reaper-shout-melee': (context, rule) => ({
    ...modifierDescription({
      name: 'Reaper shouts — melee bonus',
      category: 'utility',
      description:
        "Reaper shouts deal increased strike damage to nearby targets. The simulator's target is always nearby.",
      facts: [['factor', 'Shout strike damage at melee range', tooltipFactorChange]]
    })(context, rule)!,
    skills: context.catalog.skills.filter((skill) => skill.skillFamily === 'Shout').map((skill) => skill.id),
    icon: context.catalog.specializations.find((line) => line.name === 'Reaper')!.icon
  }),
  'necromancer.anguish-conditional-damage': modifierDescription({
    description:
      "Anguish's attacks gain strike damage for each distinct condition on the target. The bonus also applies to its Summon Spirits attack, but not Innervate Anguish.",
    facts: [['damagePerCondition', 'Strike damage per target condition']]
  })
};
