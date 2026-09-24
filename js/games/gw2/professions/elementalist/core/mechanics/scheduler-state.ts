import { expireSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
/**
 * Owns Core Elementalist state maintenance performed by scheduler advance and event-observation hooks.
 * Skill-family transitions remain with their named mechanics.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import type { ElementalistRechargeQuery, ElementalistSchedulerContext } from '#gw2/professions/elementalist/types.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS
} from '#gw2/professions/elementalist/data/ids.js';
import { ELEMENTALIST_ATTUNEMENTS } from '#gw2/professions/elementalist/core/state.js';
import {
  extendPersistingFlamesField,
  observeElementalistTraitEvent
} from '#gw2/professions/elementalist/core/traits/index.js';
import { observeElementalistElementalEvent } from '#gw2/professions/elementalist/core/mechanics/elementals/runtime.js';
import { updateEndurance } from '#gw2/professions/elementalist/core/mechanics/endurance.js';

// Observe scheduled combat packets to update aura, attunement, and trait state
// that depends on the canonical event timeline.
export function observeElementalistEvent(context: ElementalistSchedulerContext, event: SimulationEvent): void {
  observeElementalistElementalEvent(context, event);
  extendPersistingFlamesField(context, event);
  observeElementalistTraitEvent(context, event);
}

// Advance endurance, then expire transient
// auras, orbs, chains, and conjures at the requested scheduler timestamp.
export function advanceElementalistState(context: ElementalistSchedulerContext, at: number): void {
  const state = professionCoreState(context);
  // Attunement availability mirrors the shared recharge projection after each Alacrity segment.
  for (const element of ELEMENTALIST_ATTUNEMENTS) {
    state.attunementReadyAt[element] =
      context.state.cooldowns.get(ELEMENTALIST_ATTUNEMENT_SKILL_IDS[element]) ?? state.attunementReadyAt[element];
  }

  updateEndurance(context, state, at);
  state.activeAuras = state.activeAuras.filter((aura) => aura.expiresAt > at);
  // Clear expired etchings before casts advance their charge or read their payoff/palette stage.
  for (const [name, progress] of Object.entries(state.etchings)) {
    if (progress && progress.expiresAt <= at) state.etchings[name] = null;
  }

  // Expire hammer orbs together with the metadata Grand Finale reads from them.
  for (const element of ELEMENTALIST_ATTUNEMENTS) {
    if (Number(state.hammerOrbs[element] || 0) < at) {
      state.hammerOrbs[element] = null;
      state.hammerOrbActivationIds[element] = null;
    }
  }

  // Expiring the wielded copy restores the normal weapon bar and prevents further bundle casts.
  if (state.conjureEquipped && state.conjureExpiresAt <= at) {
    state.conjureEquipped = null;
    state.conjureExpiresAt = 0;
    resetAutoattackChains(context);
  }

  for (const [weapon, expiresAt] of Object.entries(state.conjurePickups)) {
    if (expiresAt <= at) delete state.conjurePickups[weapon];
  }

  if (state.dazingDischargeUntil < at) state.dazingDischargeUntil = 0;
  // A barrier that lapses unthrown starts the skill's recharge from its expiry and
  // rearms the chain so Rock Barrier, not Hurl, is offered again.
  const barrier = expireSkillFlip(state.availableFlips, ID.HURL, at);
  if (barrier) {
    const expiresAt = barrier.expiresAt;
    const root = context.catalog.skillsById.get(ID.ROCK_BARRIER);
    if (root) {
      const releaseQuery: ElementalistRechargeQuery = { rockBarrierRelease: true };
      context.cooldownController.startRecharge(
        root,
        expiresAt,
        context.rechargeDurationFor(root, expiresAt, releaseQuery) * context.cooldownController.rate(root, expiresAt)
      );
      resetAutoattackChains(context, [root.id]);
    }
  }
}
