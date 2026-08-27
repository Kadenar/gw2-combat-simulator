import { EPSILON } from '../../platform/engine/core/clock.js';
import { flattenProfessionState } from '../../platform/engine/profession/state.js';
import { mesmerRuntimeFor } from './core/runtime.js';
import { gw2PrimaryWeapon } from '../../platform/gw2/equipment/weapons/loadout.js';
import type {
  MesmerCoreState,
  MesmerEndState,
  MesmerProfessionState,
  MesmerProjectedFlip,
  MesmerResourceDefinition,
  MesmerSchedulerContext,
  MesmerStateSnapshot
} from './types.js';

/** Selects the active specialization's public resource contract at the family boundary. */
export function mesmerResourceDefinition(specialization: string): MesmerResourceDefinition {
  if (specialization === 'Virtuoso') return { singular: 'blade', plural: 'blades', maximum: 5 };
  if (specialization === 'Troubadour') return { singular: 'note', plural: 'notes', maximum: 3 };
  return { singular: 'clone', plural: 'clones', maximum: 3 };
}

/** Selects the active resource balance profile without making Core own elite profile IDs. */
export function mesmerResourceProfileId(specialization: string): string {
  if (specialization === 'Virtuoso') return 'mesmer.virtuoso.resources';
  if (specialization === 'Troubadour') return 'mesmer.troubadour.resources';
  return 'mesmer.core.resources';
}

/** Aggregates Core and active-specialization state into the stable scheduler snapshot contract. */
export function snapshotMesmerState(stateInput: unknown): MesmerStateSnapshot {
  const state = flattenProfessionState(stateInput);
  const clones = Array.isArray(state.clones) ? state.clones : [];
  const instruments =
    state.instruments && typeof state.instruments === 'object' ? (state.instruments as Record<string, number>) : {};
  const availableFlips =
    state.availableFlips && typeof state.availableFlips === 'object'
      ? (state.availableFlips as MesmerCoreState['availableFlips'])
      : {};
  const autoattackChains =
    state.autoattackChains && typeof state.autoattackChains === 'object'
      ? (state.autoattackChains as MesmerCoreState['autoattackChains'])
      : {};
  return {
    cloneCount: clones.length,
    numericResource: Number(state.numericResource || 0),
    instruments: Object.entries(instruments),
    continuumActive: Boolean(state.continuum),
    counterspellAvailable: Boolean(state.counterspellAvailable),
    availableFlips: Object.entries(availableFlips),
    autoattackChains: Object.entries(autoattackChains),
    nextForgeAt: Number(state.nextForgeAt ?? Infinity),
    bloodsongProgress: Number(state.bloodsongProgress || 0),
    sharperImagesProgress: Number(state.sharperImagesProgress || 0),
    masterFencerProgress: Number(state.masterFencerProgress || 0),
    ineptitudeReadyAt: Number(state.ineptitudeReadyAt || 0),
    clarityUntil: Number(state.clarityUntil || 0),
    ambushUntil: Number(state.ambushUntil || 0),
    mirrors: Array.isArray(state.mirrors) ? [...state.mirrors] : [],
    riddleOfSandReady: Boolean(state.riddleOfSandReady),
    timeBombUntil: Number(state.timeBombUntil || 0)
  };
}

/** Projects the family aggregate while exposing only the active specialization's optional fields. */
export function projectMesmerEndState({
  schedulerContext: context
}: {
  readonly schedulerContext: MesmerSchedulerContext;
}): MesmerEndState {
  const runtime = mesmerRuntimeFor(context);
  const { state, config } = context;
  const endTime = state.time;
  const definition = runtime.resourceDefinition;
  const publicState = flattenProfessionState(state.profession) as unknown as MesmerProfessionState;
  const availableFlips: Record<string, MesmerProjectedFlip> = {};
  for (const [skillId, flip] of Object.entries(publicState.availableFlips)) {
    if (flip.expiresAt < endTime - EPSILON) continue;
    const name = context.catalog.skillsById.get(Number(skillId))?.name;
    if (!name) continue;
    const persistent = !Number.isFinite(flip.expiresAt);
    availableFlips[name] = {
      availableAt: Math.round(flip.availableAt * 1000),
      expiresAt: persistent ? null : Math.round(flip.expiresAt * 1000),
      remaining: persistent ? null : Math.max(0, Math.round((flip.expiresAt - endTime) * 1000)),
      persistent
    };
  }

  const activeInstruments = Object.entries(publicState.instruments || {})
    .filter(([, expiresAt]) => expiresAt > endTime + EPSILON)
    .map(([name, expiresAt]) => ({
      name,
      expiresAt: Math.round(expiresAt * 1000),
      remaining: Math.max(0, Math.round((expiresAt - endTime) * 1000))
    }));
  const weaponSet = state.activeWeaponSet === 1 ? 1 : 2;
  const activeWeapon = gw2PrimaryWeapon(config, weaponSet) || gw2PrimaryWeapon(config, 1) || '';
  return {
    resource: definition.singular === 'clone' ? publicState.clones.length : publicState.numericResource,
    resourceDefinition: definition,
    clarityRemaining: Math.max(0, Math.round((publicState.clarityUntil - endTime) * 1000)),
    counterspellAvailable: publicState.counterspellAvailable,
    availableAmbush:
      publicState.ambushSource && publicState.ambushUntil > endTime + EPSILON
        ? {
            name: runtime.ambushAttacks[activeWeapon]?.name || '',
            source: publicState.ambushSource,
            expiresAt: Math.round(publicState.ambushUntil * 1000),
            remaining: Math.max(0, Math.round((publicState.ambushUntil - endTime) * 1000))
          }
        : null,
    ...(config.specialization === 'Mirage'
      ? {
          availableMirrors: (publicState.mirrors || []).filter(
            (mirror) => mirror.availableAt <= endTime + EPSILON && mirror.expiresAt > endTime + EPSILON
          ).length
        }
      : {}),
    ...(config.specialization === 'Troubadour' ? { activeInstruments } : {}),
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
