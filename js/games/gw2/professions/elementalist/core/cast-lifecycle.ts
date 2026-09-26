import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
/**
 * Routes Core Elementalist casts to the skill families and persistent mechanics that own their behavior.
 * Catalog fragments remain in `skills/`; cross-cast state lives in `mechanics/`.
 */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';

import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { AURA_TRANSMUTE_SKILLS } from '#gw2/professions/elementalist/core/constants.js';
import {
  completeElementalistAttunement,
  targetAttunement
} from '#gw2/professions/elementalist/core/mechanics/attunements.js';

import { completeArcaneEcho } from '#gw2/professions/elementalist/core/mechanics/arcane-echo.js';

import {
  beginElementalistSpearCast,
  completeElementalistSpearProgression
} from '#gw2/professions/elementalist/core/mechanics/spear-empowerments.js';
import { shareAttunementVariantRecharge } from '#gw2/professions/elementalist/core/mechanics/weapon-state.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import {
  applyElementalistAura,
  applyGenericPostCast,
  triggerEvasiveArcana
} from '#gw2/professions/elementalist/core/traits/index.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { applyConjureState, captureConjurePickup } from '#gw2/professions/elementalist/core/mechanics/conjures.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import {
  ensureElementalistElemental,
  completeElementalistElementalCommand,
  completeElementalistGlyphCast
} from '#gw2/professions/elementalist/core/mechanics/elementals/runtime.js';
import {
  applyHammerState,
  scheduleGrandFinaleProfile
} from '#gw2/professions/elementalist/core/mechanics/hammer-orbs.js';
import { applyPistolState } from '#gw2/professions/elementalist/core/mechanics/pistol-bullets.js';

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
 * Cast-start hook: grants the skill's aura, opens glyph casts, seeds spear
 * etching progress, cancels orb packets Grand Finale is about to supersede, and
 * captures armed spear empowerments for this activation.
 */
export function elementalistOnCastStart(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  // Aura-bearing skills grant their aura before same-time strike/condition
  // packets, so aura-triggered modifiers can affect the skill that granted it.
  applySkillAura(context, cast, skill);
  captureConjurePickup(context, cast);
  ensureElementalistElemental(context, skill);
  if (skill.id === ID.GRAND_FINALE) scheduleGrandFinaleProfile(context, cast, skill);
  beginElementalistSpearCast(context, cast, skill);
  const state = professionCoreState(context);
  if (Number(skill.id) === ID.GRAND_FINALE) {
    for (const activation of Object.values(state.hammerOrbActivationIds))
      if (activation) context.cancelOwner({ id: activation, generation: 0 });
  }
}

// Commit stateful flipovers and chain progress at cast completion, including
// aura transmutation, pistol bullets, etchings, orbs, and conjured weapons.
function applySpecialSkillProgression(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  const state = professionCoreState(context);
  const at = cast.effectiveEnd;

  const aura = AURA_TRANSMUTE_SKILLS[Number(skill.id)];
  if (aura) {
    state.activeAuras = state.activeAuras.filter((candidate) => candidate.type !== aura || candidate.expiresAt <= at);
  }

  completeElementalistSpearProgression(context, cast, skill);

  if (Number(skill.resourceGain || 0) > 0) {
    context.endurance.grant(Number(skill.resourceGain));
  }
}

/**
 * Cast-completion hook: settles attunement swaps, conjures, etching progress and
 * endurance, then the Arcane Echo and Fulgor special cases, and finally the
 * pistol, hammer, and trait post-cast owners for the finished activation.
 */
export function elementalistOnCastComplete(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  completeElementalistGlyphCast(context, cast, skill);
  completeElementalistElementalCommand(context, cast, skill);
  // Core commits exactly one registered attunement transition for the active specialization.
  const target = targetAttunement(skill);
  if (target) {
    completeElementalistAttunement(context, cast);
    // Elementalist spear etchings count attunement swaps among the three
    // completed casts required to upgrade their release skill.
    applySpecialSkillProgression(context, cast, skill);
    return;
  }

  applyConjureState(context, cast, skill);
  applySpecialSkillProgression(context, cast, skill);
  shareAttunementVariantRecharge(context, cast, skill);
  // Dodge is modeled as a cast, so endurance is caught up to now before its cost is spent.
  if (Number(skill.id) === ID.DODGE) {
    const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
    context.endurance.spend(balanceProfileNumber(resourcesProfile, 'resourceCost'));
    triggerEvasiveArcana(context, cast, skill);
  }

  completeArcaneEcho(context, cast, skill);

  if (Number(skill.id) === ID.FULGOR) {
    const fulgorProfile = requireBalanceProfileFromContext(context, PROFILE.fulgor);
    const pulse = requireEffect(fulgorProfile, 'strike', 'Fulgor');
    if (!pulse?.ticks?.length) throw new TypeError('Fulgor requires an explicit strike timeline.');
    context.cancelOwner({ id: 'elementalist.fulgor', generation: 0 });
    for (const tick of pulse.ticks) {
      context.schedule(
        'elementalist.fulgor-pulse',
        Math.max(context.time, cast.start + Number(tick.atMs) / 1000),
        {
          at: cast.start + Number(tick.atMs) / 1000,
          source: skill.name,
          sourceId: skill.id,
          actorType: 'effect',
          ownerActorType: 'player',
          skillName: skill.name,
          skillId: skill.id,
          coefficient: Number(tick.coefficient),
          flatStrikeBase: Number(tick.flatStrikeBase),
          flatStrikePowerCoeff: Number(tick.flatStrikePowerCoeff),
          fulgorSecondary: true,
          noCrit: true,
          activationId: cast.id,
          offTarget: cast.command.offTarget
        },
        { id: 'elementalist.fulgor', generation: 0 }
      );
    }
  }

  // Bullet, orb, and trait post-cast owners run last so they observe the state
  // this hook has already settled.
  applyPistolState(context, cast, skill);
  applyHammerState(context, cast, skill);
  applyGenericPostCast(context, cast, skill);
}
