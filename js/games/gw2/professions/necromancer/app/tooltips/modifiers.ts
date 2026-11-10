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
  // Each shout exposes its own editable rule while sharing the nearby-target explanation.
  ...Object.fromEntries(
    ['you-are-all-weaklings', 'nothing-can-save-you', 'chilled-to-the-bone', 'your-soul-is-mine', 'suffer', 'rise'].map(
      (skill) => [
        `necromancer.${skill}-melee`,
        modifierDescription({
          description:
            "This shout deals increased strike damage to nearby targets. The simulator's target is always nearby.",
          facts: [['factor', 'Shout strike damage at melee range', tooltipFactorChange]]
        })
      ]
    )
  ),
  'necromancer.anguish-conditional-damage': modifierDescription({
    description:
      "Anguish's attacks gain strike damage for up to five distinct target conditions. Defiant targets receive the maximum bonus. This also applies to Summon Spirits, but not Innervate Anguish. Temporary disables are not modeled.",
    facts: [['damagePerCondition', 'Strike damage per target condition']]
  })
};
