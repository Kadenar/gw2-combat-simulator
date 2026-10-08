import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildEngineerBuff } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerResolverContext, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';

/** React to accepted conditions with Firearms trait rewards, retaining their eligibility and cooldown rules. */

/** Opens or extends Thermal Vision's condition-damage window from player-owned Burning. */
export function applyThermalVision(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition !== 'Burning' || event.actorType === 'summon' || !hasTrait(context, TRAIT.THERMAL_VISION)) {
    return;
  }

  const thermalVisionProfile = requireBalanceProfileFromContext(context, TRAIT.THERMAL_VISION);
  // Independent accepted grants retain the longest window when Burning applications overlap.
  const thermalVisionBuff = requireEffect(thermalVisionProfile, 'buff', 'thermal-vision');
  if (thermalVisionBuff) {
    context.effects.emit({
      kind: 'packet',
      cause: event,
      settlement: 'reaction',
      event: buildEngineerBuff(event, {
        name: 'Thermal Vision',
        kind: 'thermal-vision',
        duration: thermalVisionBuff.duration,
        stacks: 1,
        sourceId: TRAIT.THERMAL_VISION,
        actorType: 'effect'
      })
    });
  }
}

/** Converts player-owned Bleeding applications into Sanguine Array might. */
export function applySanguineArray(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition !== 'Bleeding' || event.actorType === 'summon' || !hasTrait(context, TRAIT.SANGUINE_ARRAY)) {
    return;
  }

  const sanguineArrayProfile = requireBalanceProfileFromContext(context, TRAIT.SANGUINE_ARRAY);
  const sanguineArrayMight = requireEffect(sanguineArrayProfile, 'boon', 'might');
  if (sanguineArrayMight) {
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerBuff(event, {
        name: 'Sanguine Array',
        kind: String(sanguineArrayMight.boon).toLowerCase(),
        stacks: Math.max(1, event.stacks || 1),
        duration: sanguineArrayMight.duration,
        sourceId: TRAIT.SANGUINE_ARRAY,
        actorType: 'effect'
      }),
      durationContext: event
    });

    context.effects.emit({
      attribution: { source: 'Trait', sourceId: TRAIT.SANGUINE_ARRAY, actorType: 'effect' },
      kind: 'announcement',
      cause: event,
      announcement: { type: 'trait', name: 'Sanguine Array', at: event.at, sourceSkill: event.skillName, icon: '' }
    });
  }
}

/** Grants Hematic Focus fury from player-owned Bleeding when its cooldown is ready. */
export function applyHematicFocus(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition !== 'Bleeding' || event.actorType === 'summon' || !hasTrait(context, TRAIT.HEMATIC_FOCUS)) {
    return;
  }

  const state = context.procs;
  if (!isInternalCooldownReady(event.at, state.deadline('hematicFocus') || 0)) return;
  const hematicFocusProfile = requireBalanceProfileFromContext(context, TRAIT.HEMATIC_FOCUS);
  const hematicFocusFury = requireEffect(hematicFocusProfile, 'boon', 'fury');
  if (hematicFocusFury) {
    state.setDeadline('hematicFocus', event.at + balanceProfileNumber(hematicFocusProfile, 'internalCooldown'));
    context.effects.emit({
      kind: 'packet',
      event: buildEngineerBuff(event, {
        name: 'Hematic Focus',
        kind: String(hematicFocusFury.boon).toLowerCase(),
        stacks: Number(hematicFocusFury.stacks),
        duration: hematicFocusFury.duration,
        sourceId: TRAIT.HEMATIC_FOCUS,
        actorType: 'effect'
      }),
      durationContext: event
    });

    context.effects.emit({
      attribution: { source: 'Trait', sourceId: TRAIT.HEMATIC_FOCUS, actorType: 'effect' },
      kind: 'announcement',
      cause: event,
      announcement: { type: 'trait', name: 'Hematic Focus', at: event.at, sourceSkill: event.skillName, icon: '' }
    });
  }
}
