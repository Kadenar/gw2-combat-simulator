import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { armArcaneEcho, completeArcaneEcho } from '#gw2/professions/elementalist/core/mechanics/arcane-echo.js';
import { targetAttunement } from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import {
  completeElementalistElementalCommand,
  completeElementalistGlyphCast
} from '#gw2/professions/elementalist/core/mechanics/elementals/runtime.js';
import {
  elementalistCastCompleted,
  elementalistDodgeCompleted
} from '#gw2/professions/elementalist/core/mechanics/trigger-points.js';
import { shareAttunementVariantRecharge } from '#gw2/professions/elementalist/core/mechanics/weapon-state.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

/**
 * Shared completion observers link variant recharge, consume Arcane Echo on weapons, and apply cross-skill traits.
 * Attunement swaps retain their separate family-owned rewards.
 */
export function elementalistOnCastCommit(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  // The family hook settles the selected transition before Core advances weapon progression.
  const target = targetAttunement(skill);

  if (target) return;

  shareAttunementVariantRecharge(context, skill);

  // The runtime has already paid the committed dodge's declared endurance cost.
  if (Number(skill.id) === SHARED_SKILL_IDS.DODGE) context.fireTrigger(elementalistDodgeCompleted, { cast });

  completeArcaneEcho(context, cast, skill);
  // Cross-skill traits observe the state settled by the skill declarations and shared observers.
  context.fireTrigger(elementalistCastCompleted, { cast });
}

/** Registers Arcane Echo and companion actions for their declared cast triggers. */
export const elementalistCoreSideEffectHandlers: RuntimeHooks<
  ElementalistRuntimeState,
  ElementalistSkill
>['sideEffectHandlers'] = {
  'elementalist.arm-arcane-echo'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Arcane Echo requires a cast trigger.');

    armArcaneEcho(context, trigger.cast);
  },
  'elementalist.summon-elemental'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Elemental summoning requires a cast trigger.');

    completeElementalistGlyphCast(context, trigger.cast, trigger.skill);
  },
  'elementalist.command-elemental'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Elemental commands require a cast trigger.');

    completeElementalistElementalCommand(context, trigger.cast, trigger.skill);
  }
};
