/** Owns imperative Core Engineer Firearms critical-hit and condition reactions. */
import {
  balanceProfileEffectFromContext,
  balanceProfileValue,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
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
} from '#gw2/professions/engineer/core/mechanics/state-helpers.js';
import type { ResolvedCriticalHitOptions } from '#gw2/platform/profession-definition/mechanics.js';
import type {
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerResolverReactionDetails
} from '#gw2/professions/engineer/types.js';

type EngineerCriticalHitDefinition = ResolvedCriticalHitOptions<
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerResolverReactionDetails
>;

// Keep Firearms critical definitions in gameplay order while shared helpers own sampling and cooldown mechanics.
export const engineerCoreCriticalHitDefinitions = Object.freeze([
  {
    id: 'engineer.core.serrated-steel',
    actorTypes: ['player', 'effect', 'unknown'],
    when: (context, event) => Number(event.coefficient) > 0 && hasTrait(context, TRAIT.SERRATED_STEEL),
    chanceOnCriticalHit: (context) =>
      balanceProfileValueFromContext(context, PROFILE.serratedSteel, 'procChance', 0.33),
    expectedProgress: {
      get: (context) => Number(procState(context).serratedSteelProgress || 0),
      set: (context, progress) => {
        procState(context).serratedSteelProgress = progress;
      }
    },
    randomStream: 'engineer.serrated-steel',
    attribution: { kind: 'trait', id: TRAIT.SERRATED_STEEL },
    handler(context, event, _details, application) {
      applyEngineerDerivedCondition(context, event, {
        name: 'Serrated Steel',
        condition: 'Bleeding',
        stacks:
          balanceProfileValue(
            balanceProfileEffectFromContext(context, PROFILE.serratedSteel, 'condition'),
            'stacks',
            1
          ) * application.quantity,
        duration: balanceProfileValue(
          balanceProfileEffectFromContext(context, PROFILE.serratedSteel, 'condition'),
          'duration',
          3
        ),
        sourceId: TRAIT.SERRATED_STEEL,
        actorType: 'effect',
        ownerActorType: 'player'
      });
      recordTrait(context, 'Serrated Steel', event);
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
      duration: (context) => balanceProfileValueFromContext(context, PROFILE.noScope, 'internalCooldown', 8),
      readyAt: (context) => Number(procState(context).noScope || 0),
      setReadyAt: (context, readyAt) => {
        procState(context).noScope = readyAt;
      }
    },
    attribution: { kind: 'trait', id: TRAIT.NO_SCOPE },
    handler(context, event) {
      queueBuff(context, event, {
        name: 'No Scope',
        kind: 'fury',
        stacks: 1,
        duration: balanceProfileValue(balanceProfileEffectFromContext(context, PROFILE.noScope, 'boon'), 'duration', 4),
        sourceId: TRAIT.NO_SCOPE,
        actorType: 'effect'
      });
      recordTrait(context, 'No Scope', event);
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
      duration: (context) => balanceProfileValueFromContext(context, PROFILE.incendiaryPowder, 'internalCooldown', 10),
      readyAt: (context) => Number(procState(context)['incendiaryPowder.player'] || 0),
      setReadyAt: (context, readyAt) => {
        procState(context)['incendiaryPowder.player'] = readyAt;
      }
    },
    // Preserve deterministic banking of expected critical hits during the cooldown.
    progressDuringCooldown: 'accumulate',
    attribution: { kind: 'trait', id: TRAIT.INCENDIARY_POWDER },
    handler(context, event) {
      applyEngineerDerivedCondition(context, event, {
        name: 'Incendiary Powder',
        condition: 'Burning',
        stacks: balanceProfileValue(
          balanceProfileEffectFromContext(context, PROFILE.incendiaryPowder, 'condition'),
          'stacks',
          1
        ),
        duration: balanceProfileValue(
          balanceProfileEffectFromContext(context, PROFILE.incendiaryPowder, 'condition'),
          'duration',
          8
        ),
        sourceId: TRAIT.INCENDIARY_POWDER,
        actorType: 'effect',
        ownerActorType: 'player'
      });
      recordTrait(context, 'Incendiary Powder', event);
    }
  }
] satisfies readonly EngineerCriticalHitDefinition[]);

/** Opens or extends Thermal Vision's condition-damage window from player-owned Burning. */
export function applyThermalVision(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition !== 'Burning' || event.actorType === 'summon' || !hasTrait(context, TRAIT.THERMAL_VISION)) {
    return;
  }

  const state = professionCoreState(context);
  // Math.max extends the window when multiple Burning applications overlap.
  state.traitProcReadyAt.thermalVisionUntil = Math.max(
    Number(state.traitProcReadyAt.thermalVisionUntil || 0),
    event.at +
      balanceProfileValue(balanceProfileEffectFromContext(context, PROFILE.thermalVision, 'buff'), 'duration', 4)
  );
}

/** Converts player-owned Bleeding applications into Sanguine Array might. */
export function applySanguineArray(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition !== 'Bleeding' || event.actorType === 'summon' || !hasTrait(context, TRAIT.SANGUINE_ARRAY)) {
    return;
  }

  queueBuff(context, event, {
    name: 'Sanguine Array',
    kind: 'might',
    stacks: Math.max(1, Number(event.stacks || 1)),
    duration: balanceProfileValue(
      balanceProfileEffectFromContext(context, PROFILE.sanguineArray, 'boon'),
      'duration',
      4
    ),
    sourceId: TRAIT.SANGUINE_ARRAY,
    actorType: 'effect'
  });
  recordTrait(context, 'Sanguine Array', event);
}

/** Grants Hematic Focus fury from player-owned Bleeding when its cooldown is ready. */
export function applyHematicFocus(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.condition !== 'Bleeding' || event.actorType === 'summon' || !hasTrait(context, TRAIT.HEMATIC_FOCUS)) {
    return;
  }

  const state = procState(context);
  if (!isInternalCooldownReady(event.at, Number(state.hematicFocus || 0))) return;
  state.hematicFocus = event.at + balanceProfileValueFromContext(context, PROFILE.hematicFocus, 'internalCooldown', 8);
  queueBuff(context, event, {
    name: 'Hematic Focus',
    kind: 'fury',
    stacks: 1,
    duration: balanceProfileValue(
      balanceProfileEffectFromContext(context, PROFILE.hematicFocus, 'boon'),
      'duration',
      8
    ),
    sourceId: TRAIT.HEMATIC_FOCUS,
    actorType: 'effect'
  });
  recordTrait(context, 'Hematic Focus', event);
}
