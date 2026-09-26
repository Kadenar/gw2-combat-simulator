import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

const BLINDING_OUTBURST_SKILL_IDS = new Set<number>([ID.VENOMOUS_OUTBURST, ID.RELENTLESS_WHIRL, ID.DEFT_STRIKE]);

interface UntamedModifierState {
  readonly rangerUnleashed?: boolean;
  readonly ferociousSymbiosisPlayerStacks?: number;
  readonly ferociousSymbiosisPlayerUntil?: number;
  readonly ferociousSymbiosisPetStacks?: number;
  readonly ferociousSymbiosisPetUntil?: number;
}

function untamedModifierState(context: Gw2ModifierContext): Partial<UntamedModifierState> {
  return readProfessionSpecializationState<UntamedModifierState>(context.runtime?.profession, 'Untamed') || {};
}

function rangerUnleashed(context: Gw2ModifierContext): boolean {
  return untamedModifierState(context).rangerUnleashed === true;
}

export const untamedModifiers: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'ranger.vow-of-the-untamed',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.25,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      // Pet strikes don't benefit from Vow even when Ranger is unleashed.
      context.event?.source !== 'ranger-pet' &&
      rangerUnleashed(context) &&
      hasTrait(context, TRAIT.VOW_OF_THE_UNTAMED)
  },
  {
    id: 'ranger.blinding-outburst',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.25,
    when: (context) =>
      hasTrait(context, TRAIT.BLINDING_OUTBURST) &&
      BLINDING_OUTBURST_SKILL_IDS.has(Number(context.event?.skillId ?? context.skillId))
  },
  {
    id: 'ranger.ferocious-symbiosis',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: {
      baseFactor: 1,
      maximumStacks: 5,
      damagePerStack: 0.05
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => {
      const state = untamedModifierState(context);
      const pet = context.event?.source === 'ranger-pet';
      // Pet strikes use Pet stacks; player strikes use Player stacks (each built by the other).
      const stacks = pet
        ? context.time < Number(state.ferociousSymbiosisPetUntil || 0)
          ? Number(state.ferociousSymbiosisPetStacks || 0)
          : 0
        : context.time < Number(state.ferociousSymbiosisPlayerUntil || 0)
          ? Number(state.ferociousSymbiosisPlayerStacks || 0)
          : 0;
      return parameters.baseFactor + Math.min(parameters.maximumStacks, stacks) * parameters.damagePerStack;
    },
    when: (context) =>
      hasTrait(context, TRAIT.FEROCIOUS_SYMBIOSIS) &&
      (isGw2PlayerModifierOwnedEvent(context.event) || context.event?.source === 'ranger-pet')
  }
]);
