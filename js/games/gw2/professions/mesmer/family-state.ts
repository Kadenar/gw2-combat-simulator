import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { skillFlipVisible } from '#gw2/platform/engine/skills/skill-flips.js';
import { canonicalTime, isTimeInWindow } from '#kernel/core/clock.js';
import { flattenProfessionState, readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { mesmerRuntimeFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import type { SchedulerState } from '#gw2/platform/execution/types.js';
import type {
  MesmerPlanningState,
  MesmerProfessionState,
  MesmerRuntimeState,
  MesmerSchedulerContext
} from '#gw2/professions/mesmer/types.js';
import type { MesmerResourceDefinition } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';

/** Selects the active specialization's public resource contract at the family boundary. */
export function mesmerResourceDefinition(specialization: string, context: unknown): MesmerResourceDefinition {
  const maximum = balanceProfileNumber(
    requireBalanceProfileFromContext(context, mesmerResourceProfileId(specialization)),
    'maximumStacks'
  );
  if (specialization === 'Virtuoso') return { singular: 'blade', plural: 'blades', maximum };
  if (specialization === 'Troubadour') return { singular: 'note', plural: 'notes', maximum };
  return { singular: 'clone', plural: 'clones', maximum };
}

/** Selects the active resource balance profile without making Core own elite profile IDs. */
export function mesmerResourceProfileId(specialization: string): string {
  if (specialization === 'Virtuoso') return 'mesmer.virtuoso.resources';
  if (specialization === 'Troubadour') return 'mesmer.troubadour.resources';
  return 'mesmer.core.resources';
}

interface MesmerNumericResourceState {
  numericResource: number;
}

/** Returns the active numeric resource state and rejects clone-owning Mesmer specializations. */
export function mesmerNumericResourceState(state: SchedulerState<MesmerRuntimeState>): MesmerNumericResourceState {
  const kind = state.profession.specialization.kind;
  const active = readProfessionSpecializationState<MesmerNumericResourceState>(state.profession, kind);
  if (typeof active?.numericResource !== 'number') {
    throw new TypeError(`${kind} does not own a numeric Mesmer resource.`);
  }

  return active as MesmerNumericResourceState;
}

/** Projects the family aggregate while exposing only the active specialization's optional fields. */
export function projectMesmerPlanningState({
  schedulerContext: context
}: {
  readonly schedulerContext: MesmerSchedulerContext;
}): MesmerPlanningState {
  const runtime = mesmerRuntimeFor(context);
  const { state, config } = context;
  const endTime = canonicalTime(state.time);
  const definition = runtime.resourceDefinition;
  const publicState = flattenProfessionState(state.profession) as unknown as MesmerProfessionState;
  const availableFlips = Object.fromEntries(
    Object.entries(publicState.availableFlips).filter(([, window]) => skillFlipVisible(window, endTime))
  );

  // The palette retains each exact playing window through its final live microsecond.
  const activeInstruments = Object.entries(publicState.instruments || {})
    .filter(([, expiresAt]) => expiresAt > endTime)
    .map(([name, expiresAt]) => ({
      name,
      expiresAt: Math.round(expiresAt * 1000),
      remaining: Math.max(0, Math.round((expiresAt - endTime) * 1000))
    }));
  const weaponSet = state.activeWeaponSet === 1 ? 1 : 2;
  const activeWeapon = gw2ActivePrimaryWeapon(config, weaponSet) || '';
  return {
    resource: definition.singular === 'clone' ? publicState.clones.length : publicState.numericResource,
    resourceDefinition: definition,
    clarityRemaining: Math.max(0, Math.round((publicState.clarityUntil - endTime) * 1000)),
    availableAmbush:
      publicState.ambushSource && publicState.ambushUntil > endTime
        ? {
            name: runtime.ambushAttacks[activeWeapon]?.name || '',
            source: publicState.ambushSource,
            expiresAt: Math.round(publicState.ambushUntil * 1000),
            remaining: Math.max(0, Math.round((publicState.ambushUntil - endTime) * 1000))
          }
        : null,
    ...(config.specialization === 'Mirage'
      ? {
          endurance: publicState.endurance,
          // Mirror counts use pickup's exact half-open window so palette and scheduler availability agree.
          availableMirrors: (publicState.mirrors || []).filter((mirror) =>
            isTimeInWindow(endTime, mirror.availableAt, mirror.expiresAt)
          ).length
        }
      : {}),
    ...(config.specialization === 'Troubadour' ? { activeInstruments, endurance: publicState.endurance } : {}),
    availableFlips,
    autoattackChains: Object.fromEntries(
      context.catalog.autoattackChains.map((chain) => [chain[0], publicState.autoattackChains[chain[0]] || chain[0]])
    ),
    continuumActive: Boolean(publicState.continuum),
    continuumRemaining: publicState.continuum
      ? Math.max(0, Math.round((publicState.continuum.expiresAt - endTime) * 1000))
      : 0
  };
}
