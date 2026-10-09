import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import {
  balanceProfileNumber,
  procChanceFromContext,
  requireBalanceProfileFromContext
} from '#gw2/platform/skills/balance-profiles.js';
import type { ResolvedCriticalHitOptions } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { EngineerResolverContext, EngineerResolverEvent } from '#gw2/professions/engineer/types.js';
import { emitIncendiaryPowder, emitSerratedSteel } from '#gw2/professions/engineer/core/traits/firearms/emissions.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerMechResolverEvent } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-ownership.js';

/** The mech owns this option type because player traits now declare their critical reactions directly. */
type MechCriticalHitDefinition = ResolvedCriticalHitOptions<
  EngineerResolverContext,
  EngineerResolverEvent,
  NativeResolvedDamageDetails
>;

// The mech owns independent Firearms proc trackers so its critical hits cannot consume the player's progress.
export const engineerMechCriticalDefinitions: readonly MechCriticalHitDefinition[] = Object.freeze([
  {
    id: 'engineer.mechanist.serrated-steel-mech',
    actorTypes: ['summon'],
    when: (context, event) =>
      Number(event.coefficient) > 0 &&
      engineerMechResolverEvent(context, event) &&
      hasTrait(context, TRAIT.SERRATED_STEEL),
    chanceOnCriticalHit: (context) => procChanceFromContext(context, TRAIT.SERRATED_STEEL),
    randomStream: 'engineer.serrated-steel.mech',
    handler(context, event, _details, application) {
      emitSerratedSteel(context, event, application.quantity, {
        actorType: 'summon',
        metadata: { engineerMech: true }
      });
    }
  },
  {
    id: 'engineer.mechanist.incendiary-powder-mech',
    actorTypes: ['summon'],
    when: (context, event) =>
      Number(event.coefficient) > 0 &&
      engineerMechResolverEvent(context, event) &&
      hasTrait(context, TRAIT.INCENDIARY_POWDER),
    internalCooldown: {
      duration: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.INCENDIARY_POWDER), 'internalCooldown'),
      readyAt: (context) => context.procs.deadline('incendiaryPowder.mech') || 0,
      setReadyAt: (context, readyAt) => {
        context.procs.setDeadline('incendiaryPowder.mech', readyAt);
      }
    },
    handler(context, event) {
      emitIncendiaryPowder(context, event, { actorType: 'summon', metadata: { engineerMech: true } });
    }
  }
] satisfies readonly MechCriticalHitDefinition[]);
