import { RECIPIENT, ACTOR, BOON } from '#gw2/platform/constants.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import {
  revenantCastCompleted,
  type RevenantCastCompletion
} from '#gw2/professions/revenant/core/mechanics/trigger-points.js';
import { activeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

/** Owns Life Attunement tuning and behavior at its established execution boundaries. */
export const lifeAttunement = defineTrait({
  name: 'Life Attunement',
  id: TRAIT.LIFE_ATTUNEMENT,
  balance: { attributeConversion: 0.07, attributeBonus: 120 },
  attributes: traitAttributeEffects(TRAIT.LIFE_ATTUNEMENT, [
    { kind: 'flat', to: 'Healing Power', field: 'attributeBonus', feedsConversions: 'all' },
    {
      kind: 'conversion',
      from: 'Healing Power',
      to: 'Concentration',
      field: 'attributeConversion',
      rounding: 'round',
      input: 'eligible'
    }
  ])
});

/** Owns Serene Rejuvenation tuning and behavior at its established execution boundaries. */
export const sereneRejuvenation = defineTrait({
  name: 'Serene Rejuvenation',
  id: TRAIT.SERENE_REJUVENATION,
  balance: {
    effects: [
      {
        type: 'boon',
        boon: BOON.VIGOR,
        duration: 2,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        metadata: { trigger: String(ID.NATURAL_HARMONY) }
      },
      {
        type: 'boon',
        boon: BOON.REGENERATION,
        duration: 3,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        metadata: { trigger: String(ID.PURIFYING_ESSENCE) }
      },
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        duration: 5,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        metadata: { trigger: String(ID.PROTECTIVE_SOLACE) }
      },
      {
        type: 'boon',
        boon: BOON.RESISTANCE,
        duration: 4,
        stacks: 1,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        metadata: { trigger: String(ID.ENERGY_EXPULSION) }
      }
    ]
  },
  triggers: [onTriggerPoint(revenantCastCompleted, { run: completeSereneRejuvenation })]
});

/** Runs the trait at its original ordered mechanic boundary. */
function completeSereneRejuvenation(runtime: RevenantRuntime, { cast }: RevenantCastCompletion): void {
  const skill = cast.skill;
  const skillId = skill.id === ID.PROTECTIVE_SOLACE_ID_29310 ? ID.PROTECTIVE_SOLACE : skill.id;

  if (skillId === ID.PROTECTIVE_SOLACE && !activeRevenantUpkeep(runtime, skill.id)) return;

  {
    const invocationProfile = requireBalanceProfileFromContext(runtime, TRAIT.SERENE_REJUVENATION);
    emitTraitProfile(runtime, TRAIT.SERENE_REJUVENATION, invocationProfile.id, undefined, {
      preserveName: true,
      effects: (effect) =>
        (invocationProfile.effects?.filter((effect) => effect.metadata?.trigger === String(skillId)) ?? []).includes(
          effect
        ),
      attribution: (effect) => ({
        activationId: `legend-invocation:${TRAIT.SERENE_REJUVENATION}:${runtime.time}`,
        source: 'Trait',
        sourceId: TRAIT.SERENE_REJUVENATION,
        actorType: effect.actorType || ACTOR.PLAYER,
        skillId: invocationProfile.id,
        skillName: invocationProfile.name
      }),
      skillWeaponFallback: 'Unequipped'
    });
  }
}
