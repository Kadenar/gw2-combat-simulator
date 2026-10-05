import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { professionCoreState, readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import {
  elementalistEventSkill,
  elementalistProfiledBuffRequest,
  elementalistProfiledConditionRequest
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { elementalistAttunements } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { weaverDualAttunements } from '#gw2/professions/elementalist/specializations/weaver/mechanics/dual-weapon-state.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import type {
  ElementalistModifierContext,
  ElementalistRuntime,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';
/** Seed the opener only after the mechanic has assigned both starting hands. */
export function initializeElementsOfRage(context: ElementalistRuntime, emissionCast?: EffectDelivery['cast']): void {
  const core = professionCoreState(context),
    state = weaverState.from(context);
  if (core.primaryAttunement === state.secondaryAttunement && hasTrait(context, TRAIT.ELEMENTS_OF_RAGE)) {
    const elementsOfRageProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTS_OF_RAGE);
    context.effects.emit(
      elementalistBuffRequest(
        {
          skill: elementalistEventSkill(context, 'Starting Attunement', 'starting-attunement'),
          at: context.time,
          source: 'Starting Attunement',
          sourceId: 'starting-attunement',
          actorType: 'player',
          kind: 'elements of rage',
          stacks: 1,
          duration: balanceProfileNumber(elementsOfRageProfile, 'durationMultiplier'),
          skillName: 'Starting Attunement'
        },
        emissionCast
      )
    );
  }
}

/** Unravel is unavailable without its owning trait, including when that trait is unselected. */
export function elementsOfRageAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill
): AvailabilityResult {
  if (skill.id === ID.UNRAVEL && !hasTrait(context, TRAIT.ELEMENTS_OF_RAGE)) {
    return denySkillCast(skill, 'elementalist.weaver-elements-of-rage', `requires Elements of Rage.`);
  }

  return { ready: true };
}

/** Fully attuned setup swaps may carry Rage into combat before Weave Self observes the transition. */
export function applyElementsOfRageAttunement(
  context: ElementalistRuntime,
  event: SimulationEvent,
  emissionCast?: EffectDelivery['cast']
): void {
  const at = event.at,
    target = event.to,
    previous = event.from,
    sourceId = event.skillId ?? event.sourceId,
    source = event.skillName || event.source || 'Attunement',
    unravelActive = weaverState.from(context).unravelUntil > at;
  if ((target === previous || unravelActive) && hasTrait(context, TRAIT.ELEMENTS_OF_RAGE)) {
    const elementsOfRageProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTS_OF_RAGE);
    context.effects.emit(
      elementalistBuffRequest(
        {
          skill: elementalistEventSkill(context, source, sourceId),
          at,
          source,
          sourceId,
          actorType: 'player',
          kind: 'elements of rage',
          stacks: 1,
          duration: balanceProfileNumber(elementsOfRageProfile, 'durationMultiplier'),
          skillName: source
        },
        emissionCast
      )
    );
  }
}

/** Resistance follows the in-combat transition and precedes Core's Bountiful Power accounting. */
export function applyWeaversProwess(
  context: ElementalistRuntime,
  event: SimulationEvent,
  emissionCast?: EffectDelivery['cast']
): void {
  const at = event.at,
    target = event.to,
    previous = event.from,
    sourceId = event.skillId ?? event.sourceId,
    unravelActive = weaverState.from(context).unravelUntil > at;
  if (hasTrait(context, TRAIT.WEAVERS_PROWESS) && (unravelActive || target === previous)) {
    const weaversProwessProfile = requireBalanceProfileFromContext(context, TRAIT.WEAVERS_PROWESS);
    const resistance = requireEffect(weaversProwessProfile, 'boon', 'Resistance');
    if (resistance) {
      context.effects.emit(
        elementalistBuffRequest(
          {
            skill: elementalistEventSkill(context, "Weaver's Prowess", sourceId),
            at,
            source: "Weaver's Prowess",
            sourceId,
            actorType: 'player',
            kind: String(resistance.boon).toLowerCase(),
            stacks: Number(resistance.stacks),
            duration: resistance.duration,
            skillName: "Weaver's Prowess"
          },
          emissionCast
        )
      );
    }
  }
}

/** Preserve stance, per-element dual-skill, and ICD rewards before Fervent Stance reacts to the same cast. */
export function applyWeaverCastTraits(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill,
  dualAttunements: ReturnType<typeof weaverDualAttunements>
): void {
  const at = cast.effectiveEnd;
  if (hasTrait(context, TRAIT.BOLSTERED_ELEMENTS) && skill.skillFamily === 'Stance') {
    context.effects.emit(
      elementalistProfiledBuffRequest(
        context,
        at,
        TRAIT.BOLSTERED_ELEMENTS,
        'Protection',
        skill.name,
        skill.id,
        undefined,
        undefined,
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    );
  }

  if (hasTrait(context, TRAIT.SWIFT_REVENGE) && dualAttunements) {
    for (const element of dualAttunements) {
      if (element === 'Fire') {
        context.effects.emit(
          elementalistProfiledBuffRequest(
            context,
            at,
            TRAIT.SWIFT_REVENGE,
            'Fire',
            skill.name,
            skill.id,
            undefined,
            undefined,
            { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
          )
        );
      } else if (element === 'Air') {
        context.effects.emit(
          elementalistProfiledBuffRequest(
            context,
            at,
            TRAIT.SWIFT_REVENGE,
            'Air',
            skill.name,
            skill.id,
            undefined,
            undefined,
            { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
          )
        );
      } else if (element === 'Earth') {
        const swiftRevengeProfile = requireBalanceProfileFromContext(context, TRAIT.SWIFT_REVENGE);
        context.endurance.grant(balanceProfileNumber(swiftRevengeProfile, 'resourceGain'));
      }
    }
  }

  if (
    hasTrait(context, TRAIT.SUPERIOR_ELEMENTS) &&
    dualAttunements &&
    context.procs.claim(TRAIT.SUPERIOR_ELEMENTS, 'elementalist.weaver.superiorElements', at)
  ) {
    context.effects.emit(
      elementalistProfiledConditionRequest(
        context,
        at,
        TRAIT.SUPERIOR_ELEMENTS,
        'Weakness',
        skill.name,
        skill.id,
        undefined,
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    ).length > 0;
  }
}

/** Unravel rewards the transition from split hands after its boons and recharge resets. */
export function applyUnravelElementsOfRage(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  previousPrimary: string,
  previousSecondary: string | null
): void {
  const skill = cast.skill;
  if (hasTrait(context, TRAIT.ELEMENTS_OF_RAGE) && previousPrimary !== previousSecondary) {
    const elementsOfRageProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTS_OF_RAGE);
    context.effects.emit(
      elementalistBuffRequest(
        {
          skill: skill,
          at: cast.effectiveEnd,
          source: skill.name,
          sourceId: skill.id,
          actorType: 'player',
          name: skill.name,
          kind: 'elements of rage',
          duration: balanceProfileNumber(elementsOfRageProfile, 'durationMultiplier'),
          stacks: 1
        },
        { activationId: cast.id, skillId: cast.skill.id, offTarget: cast.command.offTarget }
      )
    );
  }
}

/** Apply each distinct active attunement once, including Water's Healing Power bonus. */
export function applyElementalPolyphonyAttributes(
  context: ElementalistModifierContext,
  attributes: Gw2Stats
): Gw2Stats {
  if (!hasTrait(context, TRAIT.ELEMENTAL_POLYPHONY)) return attributes;
  const modified = { ...attributes };
  const active = elementalistAttunements(context);
  const secondary =
    readProfessionSpecializationState<{
      secondaryAttunement?: string;
    }>(context.runtime?.profession, 'Weaver')?.secondaryAttunement ?? context.config?.secondaryAttunement;
  if (typeof secondary === 'string') active.add(secondary);
  const elementalPolyphonyProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_POLYPHONY);
  const attributeBonus = balanceProfileNumber(elementalPolyphonyProfile, 'attributeBonus');
  if (active.has('Fire')) {
    modified.power = (modified.power || 0) + attributeBonus;
  }

  if (active.has('Air')) {
    modified.ferocity = (modified.ferocity || 0) + attributeBonus;
  }

  if (active.has('Water')) {
    modified.healingPower = (modified.healingPower || 0) + attributeBonus;
  }

  if (active.has('Earth')) {
    modified.conditionDamage = (modified.conditionDamage || 0) + attributeBonus;
  }

  return modified;
}

/** Flow State supplies the flat reduction after Core's multiplier and before shared recharge-rate conversion. */
export function flowStateAttunementReduction(context: unknown): number {
  return hasTrait(context, TRAIT.FLOW_STATE)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FLOW_STATE), 'rechargeReduction')
    : 0;
}
