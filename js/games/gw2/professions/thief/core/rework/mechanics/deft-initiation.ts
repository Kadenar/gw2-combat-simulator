import { ACTOR } from '#gw2/platform/constants.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { emitTraitProfile, isTraitEffect } from '#gw2/platform/profession-definition/trait-emission.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import type { ThiefStrike } from '#gw2/professions/thief/core/mechanics/trigger-points.js';
import { THIEF_CORE_REWORK_TRAIT_IDS as REWORK } from '#gw2/professions/thief/core/rework/ids.js';
import { reworkCoreState } from '#gw2/professions/thief/core/rework/state.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Direct landed player attacks qualify without requiring a critical hit; proc and summon damage cannot consume. */
export function initiatingStrike(runtime: ThiefRuntime, event: Gw2ResolverEvent): boolean {
  // These traits replace the player's dodge attack; their attribution does not make that attack a triggered proc.
  const dodgeAttack =
    event.skillId === SHARED_SKILL_IDS.DODGE &&
    (event.traitId === TRAIT.BOUNDING_DODGER || event.traitId === TRAIT.LOTUS_TRAINING);

  return (
    event.type === 'damage' &&
    event.actorType === ACTOR.PLAYER &&
    (!isTraitEffect(event) || dodgeAttack) &&
    event.source !== 'Relic' &&
    event.source !== 'Sigil' &&
    !event.cancelled &&
    !missesTarget(event) &&
    Number(event.coefficient) > 0 &&
    !Number.isFinite(event.flatDamage) &&
    !Number.isFinite(event.flatStrikeBase) &&
    runtime.engagement.combatMechanicsAllowed()
  );
}

/** The proc keeps its causal parent but rolls its own strength, independently of the triggering weapon. */
export function emitSharpInitiation(runtime: ThiefRuntime, cause: Gw2ResolverEvent): void {
  emitTraitProfile(runtime, REWORK.SHARP_INITIATION, REWORK.SHARP_INITIATION, cause, {
    skillId: REWORK.SHARP_INITIATION,
    skillName: 'Sharp Initiation',
    activationId: runtime.combat.allocateEffectActivation('thief.sharp-initiation:'),
    attribution: { actorType: ACTOR.EFFECT, ownerActorType: ACTOR.PLAYER, skillWeapon: '' }
  });
}

/** Consume before children are queued; a positive ICD preserves the armed reward while it is blocked. */
export function consumeDeftInitiation(runtime: ThiefRuntime, { cause }: ThiefStrike): void {
  const state = reworkCoreState(runtime);

  if (!state.deftInitiationArmed || !initiatingStrike(runtime, cause)) return;

  const cooldown = balanceNumberFromContext(runtime, REWORK.DEFT_INITIATION, 'internalCooldown');

  if (cooldown > 0 && !runtime.procs.claimCooldown(REWORK.DEFT_INITIATION, runtime.time, cooldown)) return;

  state.deftInitiationArmed = false;
  emitTraitProfile(runtime, REWORK.DEFT_INITIATION, REWORK.DEFT_INITIATION, cause);

  if (hasTrait(runtime, REWORK.OPPORTUNE_OPENING))
    emitTraitProfile(runtime, REWORK.OPPORTUNE_OPENING, REWORK.OPPORTUNE_OPENING, cause);

  if (hasTrait(runtime, REWORK.SHARP_INITIATION)) emitSharpInitiation(runtime, cause);
}
