import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { BOON } from '#gw2/platform/constants.js';
import type { ActionContext } from '#gw2/platform/effects/actions.js';
import { CAST_READY, denyCast, retryCast } from '#gw2/platform/execution/availability.js';
import {
  closePreparedMagazine,
  openPreparedMagazine,
  preparedMagazineMaximum,
  preparedMagazineOpen,
  type PreparedMagazine
} from '#gw2/platform/execution/prepared-magazines.js';
import { skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MaximumAmmoContext } from '#gw2/platform/profession-definition/runtime-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { finalMantraChargeUsed } from '#gw2/professions/guardian/specializations/firebrand/mechanics/trigger-points.js';
import {
  MANTRAS,
  type MantraDefinition
} from '#gw2/professions/guardian/specializations/firebrand/skills/skill-flips.js';
import {
  firebrandState,
  type GuardianFirebrandState
} from '#gw2/professions/guardian/specializations/firebrand/state.js';
import type { GuardianRuntime, GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

const FIREBRAND_MANTRA_WAKE = 'guardian.firebrand.mantra';
const owner = (definition: MantraDefinition, generation: number) => ({ id: `mantra:${definition.rootId}`, generation });

// Preparation membership and wake cancellation belong to each run, even when no recharge is pending.
const generationsByState = new WeakMap<GuardianFirebrandState, Map<number, number>>();

function wakeGenerations(runtime: GuardianRuntime): Map<number, number> {
  const state = firebrandState.from(runtime.profession);
  let generations = generationsByState.get(state);

  if (!generations) {
    generations = new Map();
    generationsByState.set(state, generations);
  }

  return generations;
}

/** The normal and final faces spend one pool kept on the normal skill. */
const faces = (definition: MantraDefinition) => ({ faceIds: [definition.normalId, definition.finalId] });

function magazine(runtime: GuardianRuntime, definition: MantraDefinition): PreparedMagazine {
  return { pool: runtime.helpers.skillsById.get(definition.normalId)!, ...faces(definition) };
}

/** Preparation seeds a lifetime generation even when the full magazine has no pending wake. */
function mantraInitialized(runtime: GuardianRuntime, definition: MantraDefinition): boolean {
  return wakeGenerations(runtime).has(definition.rootId);
}

/** Preparation replaces the charge pool once; subsequent recovery uses the shared ammo controller. */
function arm(runtime: GuardianRuntime, definition: MantraDefinition): void {
  openPreparedMagazine(
    runtime,
    runtime.cooldownController,
    magazine(runtime, definition),
    definition.normalId,
    runtime.time
  );
  runtime.cooldownController.clear(definition.rootId);

  if (!mantraInitialized(runtime, definition)) wakeGenerations(runtime).set(definition.rootId, 0);
}

/** Callers select prepared mantras; one replaceable wake owns each next charge or full rearm. */
function sync(runtime: GuardianRuntime, definition: MantraDefinition): void {
  const generations = wakeGenerations(runtime);
  const previous = generations.get(definition.rootId) ?? 0;
  runtime.cancelOwner(owner(definition, previous));
  const generation = previous + 1;
  generations.set(definition.rootId, generation);
  const normal = runtime.helpers.skillsById.get(definition.normalId)!;
  let next = Infinity;

  // Timer presence includes completed recharge; only its controller deadline decides when to rearm.
  if (runtime.cooldownController.hasCooldown(definition.rootId) || !runtime.cooldownController.hasAmmo(normal.id)) {
    const readyAt = gw2CooldownReadyAt(runtime.cooldownController.readyAt(definition.rootId) ?? 0);

    if (readyAt <= runtime.time) arm(runtime, definition);
    else next = readyAt;
  }

  if (runtime.cooldownController.hasAmmo(normal.id)) {
    const ammo = runtime.cooldownController.refreshAmmo(normal, runtime.time)!;
    const flips = runtime.flips;
    // Recovery can turn the final face back into the normal face; availability follows the shared ammo pool.
    const current = ammo.charges > 1 ? definition.normalId : definition.finalId;
    runtime.consumeFlip(current === definition.normalId ? definition.finalId : definition.normalId);

    if (!skillFlipReady(flips[current], runtime.time)) runtime.armFlip(current);

    next = gw2CooldownReadyAt(ammo.nextRechargeAt ?? Infinity);
  }

  if (Number.isFinite(next) && next > runtime.time)
    runtime.schedule(FIREBRAND_MANTRA_WAKE, next, definition.rootId, owner(definition, generation));
}

/** Only equipped PvE mantras start prepared; an omitted selection retains the catalog's all-skills sandbox. */
function initializeFirebrandMantras(runtime: GuardianRuntime): void {
  const selected = selectedSkillIdSet(runtime.config.selectedSkillIds);
  for (const definition of MANTRAS) {
    if (runtime.config.selectedSkillIds !== undefined && !selected.has(definition.rootId)) continue;

    arm(runtime, definition);
    sync(runtime, definition);
  }
}

/** Refresh only mantras registered by preparation, independently of their pending wakes. */
function refreshFirebrandMantras(runtime: GuardianRuntime): void {
  runtime.cooldownController.refresh(runtime.time);
  for (const definition of MANTRAS) if (mantraInitialized(runtime, definition)) sync(runtime, definition);
}

/** A charge deadline refreshes one mantra; an untargeted wake settles all prepared pools after a shared change. */
function firebrandMantraWake(runtime: GuardianRuntime, rootId: unknown): void {
  if (rootId == null) {
    refreshFirebrandMantras(runtime);
    return;
  }

  const definition = MANTRAS.find((entry) => entry.rootId === rootId);

  if (definition) {
    runtime.cooldownController.refresh(runtime.time);
    sync(runtime, definition);
  }
}

/** Preparation and final variants consult the one normal-charge pool, including its shared cast lockout. */
export function firebrandMantraAvailability(runtime: MechanicQueriesOf<GuardianRuntime>, skill: Skill) {
  const definition = MANTRAS.find(({ rootId, normalId, finalId }) =>
    [rootId, normalId, finalId].includes(Number(skill.id))
  );

  if (!definition) return CAST_READY;

  const flips = runtime.flips;

  if (skill.id === definition.rootId)
    return preparedMagazineOpen(flips, faces(definition))
      ? denyCast('guardian.mantra-prepared', `${skill.name} is already prepared.`)
      : CAST_READY;

  const preparedAt = gw2CooldownReadyAt(runtime.cooldownController.readyAt(definition.rootId) ?? 0);

  if (preparedAt > runtime.time)
    return retryCast(preparedAt, 'guardian.mantra-charge', `${skill.name} is waiting for preparation.`);

  const chargeAt = gw2CooldownReadyAt(runtime.cooldownController.readyAt(definition.normalId) ?? 0);

  if (skill.id === definition.finalId && chargeAt > runtime.time)
    return retryCast(chargeAt, 'guardian.mantra-charge', `${skill.name} is waiting for its charge cooldown.`);

  return skillFlipReady(flips[skill.id], runtime.time)
    ? CAST_READY
    : denyCast('guardian.mantra-charge', `${skill.name} is not the currently prepared charge.`);
}

/** Declarations choose the phase; shared charge pools and generation wakes retain one controller. */
const firebrandMantraActions: RuntimeHooks<GuardianRuntimeState, GuardianSkill>['sideEffectHandlers'] =
  Object.fromEntries(
    MANTRAS.flatMap((definition) => [
      [
        `guardian.prepare-mantra-${definition.rootId}`,
        (runtime: GuardianRuntime) => {
          arm(runtime, definition);
          sync(runtime, definition);
        }
      ],
      [`guardian.use-mantra-${definition.rootId}`, (runtime: GuardianRuntime) => sync(runtime, definition)],
      [
        `guardian.finish-mantra-${definition.rootId}`,
        (runtime: GuardianRuntime, context: ActionContext) => {
          runtime.fireTrigger(finalMantraChargeUsed, { context });
          closePreparedMagazine(runtime, runtime.cooldownController, magazine(runtime, definition));
          const root = runtime.helpers.skillsById.get(definition.rootId)!;
          runtime.cooldownController.startRecharge(root, runtime.time);
          sync(runtime, definition);
        }
      ]
    ])
  );

/** During root recharge both faces are closed, so readiness checks must not create a pool for the normal skill. */
function firebrandMantraMaximumAmmo(
  context: MaximumAmmoContext<GuardianRuntimeState>,
  skill: GuardianSkill,
  maximum: number
): number {
  const definition = MANTRAS.find(({ normalId }) => normalId === skill.id);
  return definition ? preparedMagazineMaximum(context.flips, faces(definition), maximum) : maximum;
}

/** Own preparation and recharge refreshes so callers need no mantra scheduling or bookkeeping. */
export const firebrandMantraLifecycle = {
  initialize: initializeFirebrandMantras,
  maximumAmmo: firebrandMantraMaximumAmmo,
  sideEffectHandlers: firebrandMantraActions,
  tasks: { [FIREBRAND_MANTRA_WAKE]: firebrandMantraWake },
  onCooldownReset: refreshFirebrandMantras,
  reactions: {
    'buff.applied'(runtime, event) {
      // Executed history is appended after dispatch; refresh once the applied Alacrity window is queryable.
      if (event.kind === boonKey(BOON.ALACRITY)) runtime.schedule(FIREBRAND_MANTRA_WAKE, runtime.time);
    }
  }
} satisfies RuntimeHooks<GuardianRuntimeState, GuardianSkill>;
