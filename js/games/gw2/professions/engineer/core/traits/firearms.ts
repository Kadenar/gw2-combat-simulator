/** Owns imperative Core Engineer Firearms critical-hit and condition reactions. */
import {
  procChanceFromContext,
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/core/profiles.js';
import {
  applyEngineerDerivedCondition,
  procState,
  queueBuff,
  recordTrait
} from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { ResolvedCriticalHitOptions } from '#gw2/platform/profession-definition/mechanics.js';
import type { EngineerResolverContext, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';

type EngineerCriticalHitDefinition = ResolvedCriticalHitOptions<
  EngineerResolverContext,
  EngineerResolverEvent,
  NativeResolvedDamageDetails
>;

// Keep Firearms critical definitions in gameplay order while shared helpers own sampling and cooldown mechanics.
export const engineerCoreCriticalHitDefinitions = Object.freeze([
  {
    id: 'engineer.core.serrated-steel',
    actorTypes: ['player', 'effect', 'unknown'],
    when: (context, event) => Number(event.coefficient) > 0 && hasTrait(context, TRAIT.SERRATED_STEEL),
    chanceOnCriticalHit: (context) => procChanceFromContext(context, PROFILE.serratedSteel),
    expectedProgress: {
      get: (context) => Number(procState(context).serratedSteelProgress || 0),
      set: (context, progress) => {
        procState(context).serratedSteelProgress = progress;
      }
    },
    randomStream: 'engineer.serrated-steel',
    attribution: { kind: 'trait', id: TRAIT.SERRATED_STEEL },
    handler(context, event, _details, application) {
      const serratedSteelProfile = requireBalanceProfileFromContext(context, PROFILE.serratedSteel);
      const serratedSteelBleeding = requireEffect(serratedSteelProfile, 'condition', 'Bleeding');
      if (serratedSteelBleeding) {
        applyEngineerDerivedCondition(context, event, {
          name: 'Serrated Steel',
          procCount: application.quantity,
          condition: String(serratedSteelBleeding.condition),
          stacks: Number(serratedSteelBleeding.stacks) * application.quantity,
          duration: Number(serratedSteelBleeding.duration),
          sourceId: TRAIT.SERRATED_STEEL,
          actorType: 'effect',
          ownerActorType: 'player'
        });

        recordTrait(context, 'Serrated Steel', event);
      }
    }
  },
  {
    id: 'engineer.core.no-scope',
    actorTypes: ['player'],
    when: (context, event) => Number(event.coefficient) > 0 && hasTrait(context, TRAIT.NO_SCOPE),
    expectedProgress: {
      get: (context) => Number(procState(context).noScopeProgress || 0),
      set: (context, progress) => {
        procState(context).noScopeProgress = progress;
      }
    },
    internalCooldown: {
      duration: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.noScope), 'internalCooldown'),
      readyAt: (context) => Number(procState(context).noScope || 0),
      setReadyAt: (context, readyAt) => {
        procState(context).noScope = readyAt;
      }
    },
    attribution: { kind: 'trait', id: TRAIT.NO_SCOPE },
    handler(context, event) {
      const noScopeProfile = requireBalanceProfileFromContext(context, PROFILE.noScope);
      const noScopeFury = requireEffect(noScopeProfile, 'boon', 'fury');
      if (noScopeFury) {
        queueBuff(context, event, {
          name: 'No Scope',
          kind: String(noScopeFury.boon).toLowerCase(),
          stacks: Number(noScopeFury.stacks),
          duration: Number(noScopeFury.duration),
          sourceId: TRAIT.NO_SCOPE,
          actorType: 'effect'
        });

        recordTrait(context, 'No Scope', event);
      }
    }
  },
  {
    id: 'engineer.core.incendiary-powder-player',
    actorTypes: ['player'],
    when: (context, event) => Number(event.coefficient) > 0 && hasTrait(context, TRAIT.INCENDIARY_POWDER),
    expectedProgress: {
      get: (context) => Number(procState(context)['incendiaryProgress.player'] || 0),
      set: (context, progress) => {
        procState(context)['incendiaryProgress.player'] = progress;
      }
    },
    internalCooldown: {
      duration: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.incendiaryPowder), 'internalCooldown'),
      readyAt: (context) => Number(procState(context)['incendiaryPowder.player'] || 0),
      setReadyAt: (context, readyAt) => {
        procState(context)['incendiaryPowder.player'] = readyAt;
      }
    },
    // Preserve deterministic banking of expected critical hits during the cooldown.
    progressDuringCooldown: 'accumulate',
    attribution: { kind: 'trait', id: TRAIT.INCENDIARY_POWDER },
    handler(context, event) {
      const incendiaryPowderProfile = requireBalanceProfileFromContext(context, PROFILE.incendiaryPowder);
      const incendiaryPowderBurning = requireEffect(incendiaryPowderProfile, 'condition', 'Burning');
      if (incendiaryPowderBurning) {
        applyEngineerDerivedCondition(context, event, {
          name: 'Incendiary Powder',
          condition: String(incendiaryPowderBurning.condition),
          stacks: Number(incendiaryPowderBurning.stacks),
          duration: Number(incendiaryPowderBurning.duration),
          sourceId: TRAIT.INCENDIARY_POWDER,
          actorType: 'effect',
          ownerActorType: 'player'
        });

        recordTrait(context, 'Incendiary Powder', event);
      }
    }
  }
] satisfies readonly EngineerCriticalHitDefinition[]);

/** Opens or extends Thermal Vision's condition-damage window from player-owned Burning. */
export function applyThermalVision(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition !== 'Burning' || event.actorType === 'summon' || !hasTrait(context, TRAIT.THERMAL_VISION)) {
    return;
  }

  const state = professionCoreState(context);
  const thermalVisionProfile = requireBalanceProfileFromContext(context, PROFILE.thermalVision);
  // Math.max extends the window when multiple Burning applications overlap.
  const thermalVisionBuff = requireEffect(thermalVisionProfile, 'buff', 'thermal-vision');
  if (thermalVisionBuff) {
    state.traitProcReadyAt.thermalVisionUntil = Math.max(
      Number(state.traitProcReadyAt.thermalVisionUntil || 0),
      event.at + Number(thermalVisionBuff.duration)
    );
  }
}

/** Converts player-owned Bleeding applications into Sanguine Array might. */
export function applySanguineArray(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition !== 'Bleeding' || event.actorType === 'summon' || !hasTrait(context, TRAIT.SANGUINE_ARRAY)) {
    return;
  }

  const sanguineArrayProfile = requireBalanceProfileFromContext(context, PROFILE.sanguineArray);
  const sanguineArrayMight = requireEffect(sanguineArrayProfile, 'boon', 'might');
  if (sanguineArrayMight) {
    queueBuff(context, event, {
      name: 'Sanguine Array',
      kind: String(sanguineArrayMight.boon).toLowerCase(),
      stacks: Math.max(1, Number(event.stacks || 1)),
      duration: Number(sanguineArrayMight.duration),
      sourceId: TRAIT.SANGUINE_ARRAY,
      actorType: 'effect'
    });

    recordTrait(context, 'Sanguine Array', event);
  }
}

/** Grants Hematic Focus fury from player-owned Bleeding when its cooldown is ready. */
export function applyHematicFocus(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition !== 'Bleeding' || event.actorType === 'summon' || !hasTrait(context, TRAIT.HEMATIC_FOCUS)) {
    return;
  }

  const state = procState(context);
  if (!isInternalCooldownReady(event.at, Number(state.hematicFocus || 0))) return;
  const hematicFocusProfile = requireBalanceProfileFromContext(context, PROFILE.hematicFocus);
  const hematicFocusFury = requireEffect(hematicFocusProfile, 'boon', 'fury');
  if (hematicFocusFury) {
    state.hematicFocus = event.at + balanceProfileNumber(hematicFocusProfile, 'internalCooldown');
    queueBuff(context, event, {
      name: 'Hematic Focus',
      kind: String(hematicFocusFury.boon).toLowerCase(),
      stacks: Number(hematicFocusFury.stacks),
      duration: Number(hematicFocusFury.duration),
      sourceId: TRAIT.HEMATIC_FOCUS,
      actorType: 'effect'
    });

    recordTrait(context, 'Hematic Focus', event);
  }
}
