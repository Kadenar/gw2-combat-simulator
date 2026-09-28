import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { withElementalistCast } from '#gw2/professions/elementalist/core/events.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { RuntimeProfession, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
/**
 * Routes Core Elementalist casts to the skill families and persistent mechanics that own their behavior.
 * Catalog fragments remain in `skills/`; cross-cast state lives in `mechanics/`.
 */
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';

import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { AURA_TRANSMUTE_SKILLS } from '#gw2/professions/elementalist/core/constants.js';
import {
  completeElementalistAttunement,
  targetAttunement
} from '#gw2/professions/elementalist/core/mechanics/attunements.js';

import { armArcaneEcho, completeArcaneEcho } from '#gw2/professions/elementalist/core/mechanics/arcane-echo.js';

import {
  beginElementalistSpearCast,
  completeElementalistSpearProgression,
  openElementalistEtching,
  consumeElementalistEtching
} from '#gw2/professions/elementalist/core/mechanics/spear-empowerments.js';
import { shareAttunementVariantRecharge } from '#gw2/professions/elementalist/core/mechanics/weapon-state.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import {
  applyElementalistAura,
  applyGenericPostCast,
  triggerEvasiveArcana
} from '#gw2/professions/elementalist/core/traits/index.js';
import type { ElementalistRuntime, ElementalistRuntimeState } from '#gw2/professions/elementalist/types.js';
import {
  equipConjure,
  dropConjure,
  pickUpConjure,
  captureConjurePickup
} from '#gw2/professions/elementalist/core/mechanics/conjures.js';
import {
  ensureElementalistElemental,
  completeElementalistElementalCommand,
  completeElementalistGlyphCast
} from '#gw2/professions/elementalist/core/mechanics/elementals/runtime.js';
import { createHammerOrbs, consumeHammerOrbs } from '#gw2/professions/elementalist/core/mechanics/hammer-orbs.js';
import { elementalistPistolSideEffects } from '#gw2/professions/elementalist/core/mechanics/pistol-bullets.js';

// Skill data encodes a granted aura as "Element|seconds"; malformed or
// zero-length values grant nothing.
function applySkillAura(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
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
export function elementalistOnCastStart(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
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
export function elementalistOnCastCommit(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
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
export const elementalistCoreSideEffectHandlers: RuntimeProfession<ElementalistRuntimeState>['sideEffectHandlers'] = {
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
    const { cast, skill } = trigger;
    const fulgorProfile = requireBalanceProfileFromContext(context, PROFILE.fulgor);
    const pulse = requireEffect(fulgorProfile, 'strike', 'Fulgor');
    if (!pulse?.ticks?.length) throw new TypeError('Fulgor requires an explicit strike timeline.');
    context.cancelOwner({ id: 'elementalist.fulgor', generation: 0 });
    for (const tick of pulse.ticks) {
      context.schedule(
        'elementalist.fulgor-pulse',
        Math.max(context.time, cast.start + tick.atMs / 1000),
        {
          at: cast.start + tick.atMs / 1000,
          source: skill.name,
          sourceId: skill.id,
          actorType: 'effect',
          ownerActorType: 'player',
          skillName: skill.name,
          skillId: skill.id,
          coefficient: tick.coefficient,
          flatStrikeBase: Number(tick.flatStrikeBase),
          flatStrikePowerCoeff: Number(tick.flatStrikePowerCoeff),
          canCrit: false,
          activationId: cast.id,
          offTarget: cast.command.offTarget
        },
        { id: 'elementalist.fulgor', generation: 0 }
      );
    }
  }
};
