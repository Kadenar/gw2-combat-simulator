import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import type { EffectDelivery } from '#gw2/platform/effects/emission.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistBuffRequest } from '#gw2/professions/elementalist/core/events.js';
import {
  elementalistEventSkill,
  elementalistProfiledBuffRequest
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import type { ElementalistAttunementTraitDispatch } from '#gw2/professions/elementalist/core/traits/dispatch.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Grants Arcane Prowess might for one completed attunement transition. */
function applyArcaneProwess(
  context: ElementalistRuntime,
  at: number,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
): void {
  if (hasTrait(context, TRAIT.ARCANE_PROWESS)) {
    context.effects.emit(
      elementalistProfiledBuffRequest(
        context,
        at,
        TRAIT.ARCANE_PROWESS,
        'Might',
        'Arcane Prowess',
        sourceId,
        undefined,
        undefined,
        emissionCast
      )
    );
  }
}

/** Grants Elemental Attunement's boon matching the element just entered. */
function grantElementalAttunementBoon(
  context: ElementalistRuntime,
  at: number,
  attunement: ElementalistAttunement,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
): void {
  if (!hasTrait(context, TRAIT.ELEMENTAL_ATTUNEMENT)) return;
  context.effects.emit(
    elementalistProfiledBuffRequest(
      context,
      at,
      TRAIT.ELEMENTAL_ATTUNEMENT,
      attunement,
      'Elemental Attunement',
      sourceId,
      undefined,
      undefined,
      emissionCast
    )
  );
}

/** Accumulates Bountiful Power swaps and grants each completed threshold's timed effects. */
export function triggerBountifulPower(
  context: ElementalistRuntime,
  at: number,
  stacks: number,
  sourceId: Skill['id'],
  emissionCast?: EffectDelivery['cast']
): void {
  if (!hasTrait(context, TRAIT.BOUNTIFUL_POWER)) return;
  const bountifulPowerProfile = requireBalanceProfileFromContext(context, TRAIT.BOUNTIFUL_POWER);
  const threshold = balanceProfileNumber(bountifulPowerProfile, 'threshold');
  // Nonpositive custom thresholds disable this proc.
  if (threshold <= 0) return;
  const state = professionCoreState(context);
  // Reaching the stack cap grants one buff package and resets buildup before rewards can start a new cycle.
  const progress = advanceCounter(state.bountifulPowerProgress, stacks, threshold, 'reset');
  state.bountifulPowerProgress = progress.value;
  if (!progress.reached) return;
  context.effects.emit(
    elementalistProfiledBuffRequest(
      context,
      at,
      TRAIT.BOUNTIFUL_POWER,
      'Quickness',
      'Bountiful Power',
      sourceId,
      undefined,
      undefined,
      emissionCast
    )
  );
  const active = requireEffect(bountifulPowerProfile, 'buff', 'Damage Window');
  if (active) {
    context.effects.emit(
      elementalistBuffRequest(
        {
          skill: elementalistEventSkill(context, 'Bountiful Power', sourceId),
          at,
          source: 'Trait',
          sourceId: TRAIT.BOUNTIFUL_POWER,
          actorType: 'player',
          kind: 'bountiful-power-active',
          stacks: Number(active.stacks),
          duration: active.duration,
          skillName: 'Bountiful Power'
        },
        emissionCast
      )
    );
  }
}

/** Apply Arcane transition traits at the dispatcher's original phase, honoring elite entry vetoes. */
export function applyArcaneAttunementTraits(
  context: ElementalistRuntime,
  dispatch: ElementalistAttunementTraitDispatch,
  emissionCast?: EffectDelivery['cast']
): void {
  const { at, skill, previous, target, dualAttunement } = dispatch;
  applyArcaneProwess(context, at, skill.id, emissionCast);
  if (!dualAttunement || target !== previous) grantElementalAttunementBoon(context, at, target, skill.id, emissionCast);
  if (!dualAttunement) triggerBountifulPower(context, at, 1, skill.id, emissionCast);
}
