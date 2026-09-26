import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { CAST_READY, denyCast, retryCast } from '#gw2/platform/engine/skills/availability.js';
import { armSkillFlip, consumeSkillFlip, skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import { castCompleted, gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
import { MANTRAS, type MantraDefinition } from '#gw2/professions/guardian/data/mantra-definitions.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { GuardianRuntimeState } from '#gw2/professions/guardian/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

type Runtime = Gw2Runtime<GuardianRuntimeState>;
export const FIREBRAND_MANTRA_WAKE = 'guardian.firebrand.mantra';
const owner = (definition: MantraDefinition, generation: number) => ({ id: `mantra:${definition.rootId}`, generation });

/** Preparation replaces the charge pool once; subsequent recovery uses the shared ammo controller. */
function arm(runtime: Runtime, definition: MantraDefinition): void {
  const normal = runtime.helpers.skillsById.get(definition.normalId)!;
  const flips = runtime.profession.core.availableFlips;
  consumeSkillFlip(flips, definition.finalId);
  armSkillFlip(flips, definition.normalId, runtime.time);
  runtime.ammo.delete(normal.id);
  runtime.cooldownController.clear(normal.id);
  runtime.cooldownController.ensureAmmo(normal, runtime.time);
  runtime.cooldownController.clear(definition.rootId);
  firebrandState.from(runtime).mantraRechargeReadyAt[definition.rootId] = runtime.time;
}

/** Exactly one pending wake owns each mantra's next charge or full rearm; rate changes replace that wake. */
function sync(runtime: Runtime, definition: MantraDefinition): void {
  const state = firebrandState.from(runtime);
  const previous = state.mantraWakeGenerations[definition.rootId] ?? 0;
  runtime.cancelOwner(owner(definition, previous));
  const generation = previous + 1;
  state.mantraWakeGenerations[definition.rootId] = generation;
  const normal = runtime.helpers.skillsById.get(definition.normalId)!;
  let next = Infinity;
  if (
    runtime.cooldowns.has(definition.rootId) ||
    state.mantraRechargeReadyAt[definition.rootId] > runtime.time ||
    !runtime.ammo.has(normal.id)
  ) {
    const readyAt = gw2CooldownReadyAt(runtime.cooldowns.get(definition.rootId) ?? 0);
    if (readyAt <= runtime.time) arm(runtime, definition);
    else {
      // Shared readiness can provision an ammo pool while probing; root recharge still owns its eligibility.
      runtime.ammo.delete(normal.id);
      state.mantraRechargeReadyAt[definition.rootId] = readyAt;
      next = readyAt;
    }
  }

  if (runtime.ammo.has(normal.id)) {
    const ammo = runtime.cooldownController.refreshAmmo(normal, runtime.time)!;
    const flips = runtime.profession.core.availableFlips;
    const current = ammo.charges > 1 ? definition.normalId : definition.finalId;
    consumeSkillFlip(flips, current === definition.normalId ? definition.finalId : definition.normalId);
    if (!skillFlipReady(flips[current], runtime.time)) armSkillFlip(flips, current, runtime.time);
    next = gw2CooldownReadyAt(ammo.nextRechargeAt ?? Infinity);
  }

  if (Number.isFinite(next) && next > runtime.time)
    runtime.schedule(FIREBRAND_MANTRA_WAKE, next, definition.rootId, owner(definition, generation));
}

/** Only equipped PvE mantras start prepared; an omitted selection retains the catalog's all-skills sandbox. */
export function initializeLiveMantras(runtime: Runtime): void {
  const selected = selectedSkillNameSet(runtime.config.selectedSkills);
  for (const definition of MANTRAS) {
    if (selected.size && !selected.has(definition.rootName)) continue;
    arm(runtime, definition);
    sync(runtime, definition);
  }
}

/** Alacrity and explicit resets settle the real recharge maps before reprojecting visible flips and wakes. */
export function refreshLiveMantras(runtime: Runtime): void {
  runtime.cooldownController.refresh(runtime.time);
  for (const definition of MANTRAS)
    if (Object.hasOwn(firebrandState.from(runtime).mantraRechargeReadyAt, definition.rootId)) sync(runtime, definition);
}

export function liveMantraWake(runtime: Runtime, rootId: unknown): void {
  if (rootId == null) {
    refreshLiveMantras(runtime);
    return;
  }

  const definition = MANTRAS.find((entry) => entry.rootId === rootId);
  if (definition) {
    runtime.cooldownController.refresh(runtime.time);
    sync(runtime, definition);
  }
}

/** Preparation and final variants consult the one normal-charge pool, including its shared cast lockout. */
export function liveMantraAvailability(runtime: Runtime, skill: Skill) {
  const definition = MANTRAS.find(({ rootId, normalId, finalId }) =>
    [rootId, normalId, finalId].includes(Number(skill.id))
  );
  if (!definition) return CAST_READY;
  const flips = runtime.profession.core.availableFlips;
  if (skill.id === definition.rootId)
    return skillFlipReady(flips[definition.normalId], runtime.time) ||
      skillFlipReady(flips[definition.finalId], runtime.time)
      ? denyCast('guardian.mantra-prepared', `${skill.name} is already prepared.`)
      : CAST_READY;
  const preparedAt = gw2CooldownReadyAt(runtime.cooldowns.get(definition.rootId) ?? 0);
  if (preparedAt > runtime.time)
    return retryCast(preparedAt, 'guardian.mantra-charge', `${skill.name} is waiting for preparation.`);
  const chargeAt = gw2CooldownReadyAt(runtime.cooldowns.get(definition.normalId) ?? 0);
  if (skill.id === definition.finalId && chargeAt > runtime.time)
    return retryCast(chargeAt, 'guardian.mantra-charge', `${skill.name} is waiting for its charge cooldown.`);
  return skillFlipReady(flips[skill.id], runtime.time)
    ? CAST_READY
    : denyCast('guardian.mantra-charge', `${skill.name} is not the currently prepared charge.`);
}

/** The last charge retires its ammo pool and starts root recharge; no predicted rearm mutates current state. */
export function completeLiveMantra(runtime: Runtime, cast: RuntimeCast): void {
  if (!castCompleted(cast)) return;
  const definition = MANTRAS.find(({ rootId, normalId, finalId }) =>
    [rootId, normalId, finalId].includes(Number(cast.skill.id))
  );
  if (!definition) return;
  if (cast.skill.id === definition.rootId) arm(runtime, definition);
  else if (cast.skill.id === definition.finalId) {
    const flips = runtime.profession.core.availableFlips;
    consumeSkillFlip(flips, definition.normalId);
    consumeSkillFlip(flips, definition.finalId);
    runtime.ammo.delete(definition.normalId);
    runtime.cooldownController.clear(definition.normalId);
    const root = runtime.helpers.skillsById.get(definition.rootId)!;
    firebrandState.from(runtime).mantraRechargeReadyAt[definition.rootId] = runtime.cooldownController.startRecharge(
      root,
      runtime.time
    );
  }

  sync(runtime, definition);
}
