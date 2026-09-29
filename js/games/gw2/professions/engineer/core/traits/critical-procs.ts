import type { ResolvedCriticalHitOptions } from '#gw2/platform/profession-definition/mechanics.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { EngineerResolverContext, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  procChanceFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import {
  applyEngineerDerivedCondition,
  queueBuff,
  recordTrait
} from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

/** Owns imperative Core Engineer Firearms critical-hit and condition reactions. */

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
    chanceOnCriticalHit: (context) => procChanceFromContext(context, TRAIT.SERRATED_STEEL),
    randomStream: 'engineer.serrated-steel',
    handler(context, event, _details, application) {
      const serratedSteelProfile = requireBalanceProfileFromContext(context, TRAIT.SERRATED_STEEL);
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
    internalCooldown: {
      duration: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.NO_SCOPE), 'internalCooldown'),
      readyAt: (context) => context.procs.readyAt.noScope || 0,
      setReadyAt: (context, readyAt) => {
        context.procs.readyAt.noScope = readyAt;
      }
    },
    handler(context, event) {
      const noScopeProfile = requireBalanceProfileFromContext(context, TRAIT.NO_SCOPE);
      const noScopeFury = requireEffect(noScopeProfile, 'boon', 'fury');
      if (noScopeFury) {
        queueBuff(context, event, {
          name: 'No Scope',
          kind: String(noScopeFury.boon).toLowerCase(),
          stacks: Number(noScopeFury.stacks),
          duration: noScopeFury.duration,
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
    internalCooldown: {
      duration: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.INCENDIARY_POWDER), 'internalCooldown'),
      readyAt: (context) => context.procs.readyAt['incendiaryPowder.player'] || 0,
      setReadyAt: (context, readyAt) => {
        context.procs.readyAt['incendiaryPowder.player'] = readyAt;
      }
    },
    handler(context, event) {
      const incendiaryPowderProfile = requireBalanceProfileFromContext(context, TRAIT.INCENDIARY_POWDER);
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

// The mech owns independent Firearms proc trackers so its critical hits cannot consume the player's progress.
export function engineerMechCoreCriticalDefinitions(
  isMechEvent: (context: EngineerResolverContext, event: EngineerResolverEvent) => boolean
): readonly EngineerCriticalHitDefinition[] {
  return Object.freeze([
    {
      id: 'engineer.mechanist.serrated-steel-mech',
      actorTypes: ['summon'],
      when: (context, event) =>
        Number(event.coefficient) > 0 && isMechEvent(context, event) && hasTrait(context, TRAIT.SERRATED_STEEL),
      chanceOnCriticalHit: (context) => procChanceFromContext(context, TRAIT.SERRATED_STEEL),
      randomStream: 'engineer.serrated-steel.mech',
      handler(context, event, _details, application) {
        const serratedSteelProfile = requireBalanceProfileFromContext(context, TRAIT.SERRATED_STEEL);
        const serratedSteelBleeding = requireEffect(serratedSteelProfile, 'condition', 'Bleeding');
        if (serratedSteelBleeding) {
          applyEngineerDerivedCondition(context, event, {
            name: 'Serrated Steel',
            procCount: application.quantity,
            condition: String(serratedSteelBleeding.condition),
            stacks: Number(serratedSteelBleeding.stacks) * application.quantity,
            duration: Number(serratedSteelBleeding.duration),
            sourceId: TRAIT.SERRATED_STEEL,
            actorType: 'summon',
            metadata: { engineerMech: true }
          });

          recordTrait(context, 'Serrated Steel', event);
        }
      }
    },
    {
      id: 'engineer.mechanist.incendiary-powder-mech',
      actorTypes: ['summon'],
      when: (context, event) =>
        Number(event.coefficient) > 0 && isMechEvent(context, event) && hasTrait(context, TRAIT.INCENDIARY_POWDER),
      internalCooldown: {
        duration: (context) =>
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.INCENDIARY_POWDER), 'internalCooldown'),
        readyAt: (context) => context.procs.readyAt['incendiaryPowder.mech'] || 0,
        setReadyAt: (context, readyAt) => {
          context.procs.readyAt['incendiaryPowder.mech'] = readyAt;
        }
      },
      handler(context, event) {
        const incendiaryPowderProfile = requireBalanceProfileFromContext(context, TRAIT.INCENDIARY_POWDER);
        const incendiaryPowderBurning = requireEffect(incendiaryPowderProfile, 'condition', 'Burning');
        if (incendiaryPowderBurning) {
          applyEngineerDerivedCondition(context, event, {
            name: 'Incendiary Powder',
            condition: String(incendiaryPowderBurning.condition),
            stacks: Number(incendiaryPowderBurning.stacks),
            duration: Number(incendiaryPowderBurning.duration),
            sourceId: TRAIT.INCENDIARY_POWDER,
            actorType: 'summon',
            metadata: { engineerMech: true }
          });

          recordTrait(context, 'Incendiary Powder', event);
        }
      }
    }
  ] satisfies readonly EngineerCriticalHitDefinition[]);
}
