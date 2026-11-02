/** Conduit modifiers describe equipped-legend resonance and selected affinity scaling explicitly. */
import { modifierDescription, type ModifierDescriptions } from '#gw2/app/modifier-reference/presentation.js';
import { tooltipFactorChange } from '#gw2/app/shared/simulation-tooltip.js';

export const revenantModifierDescriptions: ModifierDescriptions = {
  'revenant.beguiling-haze-assassin-resonance': modifierDescription({
    name: 'Beguiling Haze — Assassin resonance',
    description:
      "Beguiling Haze's main strike deals increased damage while Legendary Assassin is equipped. Assassin does not need to be the currently active legend. The follow-up strikes do not receive this modifier.",
    facts: [['factor', 'Main-strike damage with Assassin equipped', tooltipFactorChange]]
  }),
  'revenant.twin-moon-assassin-resonance': modifierDescription({
    name: 'Twin Moon Sweep — Assassin resonance',
    description:
      'Twin Moon Sweep deals increased strike damage while Legendary Assassin is equipped, even when it is not the active legend.',
    facts: [['factor', 'Strike damage with Assassin equipped', tooltipFactorChange]]
  }),
  ...Object.fromEntries(
    ['assassin', 'dervish', 'warrior'].map((form) => [
      `revenant.release-${form}-affinity`,
      modifierDescription({
        description:
          "This Release Potential strike gains damage per effective affinity. Kinetic Insight's virtual affinity counts without spending actual affinity.",
        facts: [['damagePerAffinity', 'Strike damage per effective affinity']]
      })
    ])
  )
};
