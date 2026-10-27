import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_SKILL_IDS as SKILL, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { VINDICATOR_REWORK_TRAIT_IDS as REWORK } from '#gw2/professions/revenant/specializations/vindicator/rework/ids.js';
import { enduranceNotFull } from '#gw2/professions/revenant/specializations/vindicator/traits/behavior.js';
import { traitDefinitions } from '#gw2/professions/revenant/specializations/vindicator/traits/index.js';

/** Accepted legend swaps restore capped endurance, including outside combat; Alliance Tactics remains deferred. */
const balanceInDiscord = defineTrait({
  name: 'Balance in Discord',
  id: TRAIT.BALANCE_IN_DISCORD,
  balance: { resourceGain: 0 },
  triggers: [
    {
      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === SKILL.SWAP_LEGENDS,
      run(runtime: RevenantRuntime) {
        runtime.endurance.grant(balanceNumberFromContext(runtime, TRAIT.BALANCE_IN_DISCORD, 'resourceGain'));
      }
    }
  ]
});

/** Replace the old Power grant with an endurance-gated multiplier; the manifest supplies the provisional percentage. */
const riseToTheOccasion = defineTrait({
  name: 'Rise to the Occasion',
  id: REWORK.RISE_TO_THE_OCCASION,
  balance: { damageIncrease: 0 },
  modifierRules: [
    {
      id: 'revenant.rise-to-the-occasion',
      order: 100,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => 1 + balanceNumberFromContext(context, REWORK.RISE_TO_THE_OCCASION, 'damageIncrease'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && enduranceNotFull(context)
    }
  ]
});

// Moved traits retain their mechanics, while removed traits contribute neither attributes nor damage rules.
export const vindicatorReworkTraits = [
  ...traitDefinitions.filter((trait) => trait.id !== TRAIT.EMPIRE_DIVIDED && trait.id !== TRAIT.LEVIATHAN_STRENGTH),
  balanceInDiscord,
  riseToTheOccasion,
  defineTrait({ name: 'Friend of the Luxons', id: REWORK.FRIEND_OF_THE_LUXONS }),
  defineTrait({ name: 'Heated Rivalry', id: REWORK.HEATED_RIVALRY }),
  defineTrait({ name: 'Friend of the Kurzicks', id: REWORK.FRIEND_OF_THE_KURZICKS })
];
