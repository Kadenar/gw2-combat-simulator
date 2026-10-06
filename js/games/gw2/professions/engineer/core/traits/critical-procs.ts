import { emitSerratedSteel, emitIncendiaryPowder } from '#gw2/professions/engineer/core/traits/firearms-emissions.js';
import type { ResolvedCriticalHitOptions } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { EngineerResolverContext, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import {
  balanceProfileNumber,
  procChanceFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { buildEngineerBuff } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

/** Owns imperative Core Engineer Firearms critical-hit and condition reactions. */

export type EngineerCriticalHitDefinition = ResolvedCriticalHitOptions<
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
    chanceOnCriticalHit: (context) => procChanceFromContext(context, TRAIT.SERRATED_STEEL),
    randomStream: 'engineer.serrated-steel',
    handler(context, event, _details, application) {
      emitSerratedSteel(context, event, application.quantity, { actorType: 'effect', ownerActorType: 'player' });
    }
  },
  {
    id: 'engineer.core.no-scope',
    actorTypes: ['player'],
    when: (context, event) => Number(event.coefficient) > 0 && hasTrait(context, TRAIT.NO_SCOPE),
    internalCooldown: {
      duration: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.NO_SCOPE), 'internalCooldown'),
      readyAt: (context) => context.procs.deadline('noScope') || 0,
      setReadyAt: (context, readyAt) => {
        context.procs.setDeadline('noScope', readyAt);
      }
    },
    handler(context, event) {
      const noScopeProfile = requireBalanceProfileFromContext(context, TRAIT.NO_SCOPE);
      const noScopeFury = requireEffect(noScopeProfile, 'boon', 'fury');
      if (noScopeFury) {
        context.effects.emit({
          kind: 'packet',
          event: buildEngineerBuff(event, {
            name: 'No Scope',
            kind: String(noScopeFury.boon).toLowerCase(),
            stacks: Number(noScopeFury.stacks),
            duration: noScopeFury.duration,
            sourceId: TRAIT.NO_SCOPE,
            actorType: 'effect'
          }),
          durationContext: event
        });

        context.effects.emit({
          attribution: { source: 'Trait', sourceId: TRAIT.NO_SCOPE, actorType: 'effect' },
          kind: 'announcement',
          cause: event,
          announcement: { type: 'trait', name: 'No Scope', at: event.at, sourceSkill: event.skillName, icon: '' }
        });
      }
    }
  },
  {
    id: 'engineer.core.incendiary-powder-player',
    actorTypes: ['player'],
    when: (context, event) => Number(event.coefficient) > 0 && hasTrait(context, TRAIT.INCENDIARY_POWDER),
    internalCooldown: {
      duration: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.INCENDIARY_POWDER), 'internalCooldown'),
      readyAt: (context) => context.procs.deadline('incendiaryPowder.player') || 0,
      setReadyAt: (context, readyAt) => {
        context.procs.setDeadline('incendiaryPowder.player', readyAt);
      }
    },
    handler(context, event) {
      emitIncendiaryPowder(context, event, { actorType: 'effect', ownerActorType: 'player' });
    }
  }
] satisfies readonly EngineerCriticalHitDefinition[]);
