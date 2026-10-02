import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { withElementalistCast } from '#gw2/professions/elementalist/core/events.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
/**
 * Routes Core Elementalist casts to the skill families and persistent mechanics that own their behavior.
 * Catalog fragments remain in `skills/`; cross-cast state lives in `mechanics/`.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { AURA_TRANSMUTE_SKILLS } from '#gw2/professions/elementalist/core/constants.js';
import {
  completeElementalistAttunement,
  targetAttunement
} from '#gw2/professions/elementalist/core/mechanics/attunements.js';

import { armArcaneEcho, completeArcaneEcho } from '#gw2/professions/elementalist/core/mechanics/arcane-echo.js';

import {
  captureConjurePickup,
  dropConjure,
  equipConjure,
  pickUpConjure
} from '#gw2/professions/elementalist/core/mechanics/conjures.js';
import {
  completeElementalistElementalCommand,
  completeElementalistGlyphCast,
  ensureElementalistElemental
} from '#gw2/professions/elementalist/core/mechanics/elementals/runtime.js';
import { replaceFulgor } from '#gw2/professions/elementalist/core/mechanics/fulgor.js';
import { consumeHammerOrbs, createHammerOrbs } from '#gw2/professions/elementalist/core/mechanics/hammer-orbs.js';
import { elementalistPistolSideEffects } from '#gw2/professions/elementalist/core/mechanics/pistol-bullets.js';
import {
  beginElementalistSpearCast,
  completeElementalistSpearProgression,
  consumeElementalistEtching,
  openElementalistEtching
} from '#gw2/professions/elementalist/core/mechanics/spear-empowerments.js';
import { shareAttunementVariantRecharge } from '#gw2/professions/elementalist/core/mechanics/weapon-state.js';
import { triggerEvasiveArcana } from '#gw2/professions/elementalist/core/traits/behavior.js';
import { applyElementalistAura, applyGenericPostCast } from '#gw2/professions/elementalist/core/traits/dispatch.js';
import type {
  ElementalistSkill,
  ElementalistRuntime,
  ElementalistRuntimeState
} from '#gw2/professions/elementalist/types.js';

// Skill data encodes a granted aura as "Element|seconds"; malformed or
// zero-length values grant nothing.
function applySkillAura(context: ElementalistRuntime, cast: RuntimeCast<ElementalistSkill>, skill: Skill): void {
  if (!skill.aura) return;
  const [element, rawDuration] = String(skill.aura).split('|');
  const duration = Number(rawDuration || 0);
  if (!element || !(duration > 0)) return;
  applyElementalistAura(context, {
    at: cast.effectiveEnd,
    aura: `${element} Aura`,
    duration,
    skillName: skill.name,
    sourceId: skill.id
  });
}

/**
 * Shared cast-start observers grant declared auras, ensure the automatic companion,
 * and capture armed spear empowerments for this activation.
 */
export function elementalistOnCastStart(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  // Aura-bearing skills grant their aura before same-time strike/condition
  // packets, so aura-triggered modifiers can affect the skill that granted it.
  applySkillAura(context, cast, skill);
  ensureElementalistElemental(context, skill);
  beginElementalistSpearCast(context, cast, skill);
}

/**
 * Shared completion observers settle attunement swaps, advance etchings and recharge,
 * consume Arcane Echo on weapons, and apply cross-skill traits.
 */
export function elementalistOnCastCommit(
  context: ElementalistRuntime,
  cast: RuntimeCast<ElementalistSkill>,
  skill: Skill
): void {
  // Core commits exactly one registered attunement transition for the active specialization.
  const target = targetAttunement(skill);
  if (target) {
    completeElementalistAttunement(context, cast);
    // Elementalist spear etchings count attunement swaps among the three
    // completed casts required to upgrade their release skill.
    completeElementalistSpearProgression(context, skill);
    return;
  }

  completeElementalistSpearProgression(context, skill);
  shareAttunementVariantRecharge(context, skill);
  // The runtime has already paid the committed dodge's declared endurance cost.
  if (Number(skill.id) === SHARED_SKILL_IDS.DODGE) triggerEvasiveArcana(context, cast, skill);

  completeArcaneEcho(context, cast, skill);

  // Cross-skill traits observe the state settled by the skill declarations and shared observers.
  applyGenericPostCast(context, cast, skill);
}

/** Skill declarations own these commit triggers; handlers retain aura and companion lifetime bookkeeping. */
export const elementalistCoreSideEffectHandlers: RuntimeProfession<
  ElementalistRuntimeState,
  ElementalistSkill
>['sideEffectHandlers'] = {
  ...elementalistPistolSideEffects,
  'elementalist.capture-conjure-pickup'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Conjure pickup requires a cast trigger.');
    captureConjurePickup(context, trigger.cast);
  },
  'elementalist.equip-conjure'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Conjures require a cast trigger.');
    withElementalistCast(context, trigger.cast, () => equipConjure(context, trigger.cast, trigger.skill));
  },
  'elementalist.drop-conjure'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Dropping a conjure requires a cast trigger.');
    withElementalistCast(context, trigger.cast, () => dropConjure(context, trigger.cast, trigger.skill));
  },
  'elementalist.pick-up-conjure'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Conjure pickup requires a cast trigger.');
    withElementalistCast(context, trigger.cast, () => pickUpConjure(context, trigger.cast, trigger.skill));
  },
  'elementalist.create-hammer-orbs'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Hammer orbs require a cast trigger.');
    withElementalistCast(context, trigger.cast, () =>
      createHammerOrbs(
        context,
        trigger.cast,
        trigger.skill,
        String(trigger.skill.attunement).split('+') as ElementalistAttunement[]
      )
    );
  },
  'elementalist.cancel-hammer-orbits'(context) {
    for (const activation of Object.values(professionCoreState(context).hammerOrbActivationIds))
      if (activation) context.cancelOwner({ id: activation, generation: 0 });
  },
  'elementalist.consume-hammer-orbs'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Grand Finale requires a cast trigger.');
    consumeHammerOrbs(context, trigger.cast);
  },
  'elementalist.open-etching'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Etchings require a cast trigger.');
    openElementalistEtching(context, trigger.skill);
  },
  'elementalist.consume-etching'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Etchings require a cast trigger.');
    consumeElementalistEtching(context, trigger.skill);
  },
  'elementalist.transmute-aura'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Aura transmutation requires a cast trigger.');
    const aura = AURA_TRANSMUTE_SKILLS[Number(trigger.skill.id)];
    const state = professionCoreState(context);
    state.activeAuras = state.activeAuras.filter(
      (candidate) => candidate.type !== aura || candidate.expiresAt <= trigger.cast.effectiveEnd
    );
  },
  'elementalist.arm-arcane-echo'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Arcane Echo requires a cast trigger.');
    armArcaneEcho(context, trigger.cast);
  },
  'elementalist.summon-elemental'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Elemental summoning requires a cast trigger.');
    withElementalistCast(context, trigger.cast, () =>
      completeElementalistGlyphCast(context, trigger.cast, trigger.skill)
    );
  },
  'elementalist.command-elemental'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Elemental commands require a cast trigger.');
    withElementalistCast(context, trigger.cast, () =>
      completeElementalistElementalCommand(context, trigger.cast, trigger.skill)
    );
  },
  'elementalist.replace-fulgor'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Fulgor requires a cast trigger.');
    replaceFulgor(context, trigger.cast);
  }
};
