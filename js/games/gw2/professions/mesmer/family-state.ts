import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { skillFlipVisible } from '#gw2/platform/engine/skills/skill-flips.js';
import { canonicalTime, isTimeInWindow } from '#kernel/core/clock.js';
import { flattenProfessionState, readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { MESMER_MIRAGE_AMBUSH_SKILLS } from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import type { MesmerPlanningState, MesmerProfessionState, MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';
import type { Gw2PlanningStateInput } from '#gw2/platform/simulation/types.js';
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
export function mesmerNumericResourceState(state: MesmerRuntime): MesmerNumericResourceState {
  const kind = state.profession.specialization.kind;
  const active = readProfessionSpecializationState<MesmerNumericResourceState>(state.profession, kind);
  if (typeof active?.numericResource !== 'number') {
    throw new TypeError(`${kind} does not own a numeric Mesmer resource.`);
  }

  return active as MesmerNumericResourceState;
}

/** Projects the family aggregate while exposing only the active specialization's optional fields. */
export function projectMesmerPlanningState(input: Gw2PlanningStateInput<MesmerRuntimeState>): MesmerPlanningState {
  const { config, catalog } = input;
  const endTime = canonicalTime(input.time);
  // Resource labels and ambush names derive from selected catalog data, without initializing combat controllers.
  const definition = mesmerResourceDefinition(config.specialization || 'Core', { catalog });
  const publicState = flattenProfessionState(input.profession) as unknown as MesmerProfessionState;
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
  const weaponSet = input.activeWeaponSet === 1 ? 1 : 2;
  const activeWeapon = gw2ActivePrimaryWeapon(config, weaponSet) || '';
  return {
    resource: definition.singular === 'clone' ? publicState.clones.length : publicState.numericResource,
    resourceDefinition: definition,
    clarityRemaining: Math.max(0, Math.round((publicState.clarityUntil - endTime) * 1000)),
    availableAmbush:
      publicState.ambushSource && publicState.ambushUntil > endTime
        ? {
            name: catalog.skillsById.get(MESMER_MIRAGE_AMBUSH_SKILLS[activeWeapon]?.id ?? NaN)?.name || '',
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
      catalog.autoattackChains.map((chain) => [chain[0], publicState.autoattackChains[chain[0]] || chain[0]])
    ),
    continuumActive: Boolean(publicState.continuum),
    continuumRemaining: publicState.continuum
      ? Math.max(0, Math.round((publicState.continuum.expiresAt - endTime) * 1000))
      : 0
  };
}
