import type { ResolvedCriticalHitOptions } from '#gw2/platform/profession-definition/mechanics.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { EngineerResolverContext, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  procChanceFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import {
  buildEngineerCondition,
  buildEngineerBuff
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
        context.effects.emit({
          kind: 'packet',
          event: buildEngineerCondition(event, {
            name: 'Serrated Steel',
            procCount: application.quantity,
            condition: String(serratedSteelBleeding.condition),
            stacks: Number(serratedSteelBleeding.stacks) * application.quantity,
            duration: Number(serratedSteelBleeding.duration),
            sourceId: TRAIT.SERRATED_STEEL,
            actorType: 'effect',
            ownerActorType: 'player'
          }),
          settlement: 'reaction'
        });

        context.effects.emit({
          attribution: { source: 'Trait', sourceId: TRAIT.SERRATED_STEEL, actorType: 'effect' },
          kind: 'announcement',
          cause: event,
          announcement: { type: 'trait', name: 'Serrated Steel', at: event.at, sourceSkill: event.skillName, icon: '' }
        });
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
      const incendiaryPowderProfile = requireBalanceProfileFromContext(context, TRAIT.INCENDIARY_POWDER);
      const incendiaryPowderBurning = requireEffect(incendiaryPowderProfile, 'condition', 'Burning');
      if (incendiaryPowderBurning) {
        context.effects.emit({
          kind: 'packet',
          event: buildEngineerCondition(event, {
            name: 'Incendiary Powder',
            condition: String(incendiaryPowderBurning.condition),
            stacks: Number(incendiaryPowderBurning.stacks),
            duration: Number(incendiaryPowderBurning.duration),
            sourceId: TRAIT.INCENDIARY_POWDER,
            actorType: 'effect',
            ownerActorType: 'player'
          }),
          settlement: 'reaction'
        });

        context.effects.emit({
          attribution: { source: 'Trait', sourceId: TRAIT.INCENDIARY_POWDER, actorType: 'effect' },
          kind: 'announcement',
          cause: event,
          announcement: {
            type: 'trait',
            name: 'Incendiary Powder',
            at: event.at,
            sourceSkill: event.skillName,
            icon: ''
          }
        });
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
          context.effects.emit({
            kind: 'packet',
            event: buildEngineerCondition(event, {
              name: 'Serrated Steel',
              procCount: application.quantity,
              condition: String(serratedSteelBleeding.condition),
              stacks: Number(serratedSteelBleeding.stacks) * application.quantity,
              duration: Number(serratedSteelBleeding.duration),
              sourceId: TRAIT.SERRATED_STEEL,
              actorType: 'summon',
              metadata: { engineerMech: true }
            }),
            settlement: 'reaction'
          });

          context.effects.emit({
            attribution: { source: 'Trait', sourceId: TRAIT.SERRATED_STEEL, actorType: 'effect' },
            kind: 'announcement',
            cause: event,
            announcement: {
              type: 'trait',
              name: 'Serrated Steel',
              at: event.at,
              sourceSkill: event.skillName,
              icon: ''
            }
          });
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
        readyAt: (context) => context.procs.deadline('incendiaryPowder.mech') || 0,
        setReadyAt: (context, readyAt) => {
          context.procs.setDeadline('incendiaryPowder.mech', readyAt);
        }
      },
      handler(context, event) {
        const incendiaryPowderProfile = requireBalanceProfileFromContext(context, TRAIT.INCENDIARY_POWDER);
        const incendiaryPowderBurning = requireEffect(incendiaryPowderProfile, 'condition', 'Burning');
        if (incendiaryPowderBurning) {
          context.effects.emit({
            kind: 'packet',
            event: buildEngineerCondition(event, {
              name: 'Incendiary Powder',
              condition: String(incendiaryPowderBurning.condition),
              stacks: Number(incendiaryPowderBurning.stacks),
              duration: Number(incendiaryPowderBurning.duration),
              sourceId: TRAIT.INCENDIARY_POWDER,
              actorType: 'summon',
              metadata: { engineerMech: true }
            }),
            settlement: 'reaction'
          });

          context.effects.emit({
            attribution: { source: 'Trait', sourceId: TRAIT.INCENDIARY_POWDER, actorType: 'effect' },
            kind: 'announcement',
            cause: event,
            announcement: {
              type: 'trait',
              name: 'Incendiary Powder',
              at: event.at,
              sourceSkill: event.skillName,
              icon: ''
            }
          });
        }
      }
    }
  ] satisfies readonly EngineerCriticalHitDefinition[]);
}
