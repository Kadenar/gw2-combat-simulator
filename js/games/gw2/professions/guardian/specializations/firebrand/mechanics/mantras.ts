/**
 * Owns Firebrand mantra preparation, charge, flip, and recharge state.
 * Declarative mantra fragments live in `skills/mantra-skills.ts`.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { CAST_READY, denyCast, retryCast } from '#gw2/platform/engine/skills/availability.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import type { AvailabilityResult } from '#gw2/platform/engine/execution/types.js';
import type {
  GuardianCastContext,
  GuardianPrecastContext,
  GuardianSchedulerContext,
  GuardianSkill
} from '#gw2/professions/guardian/types.js';

interface MantraDefinition {
  readonly rootId: number;
  readonly rootName: string;
  readonly normalId: number;
  readonly finalId: number;
}

const MANTRAS: readonly MantraDefinition[] = Object.freeze([
  {
    rootId: ID.MANTRA_OF_SOLACE,
    rootName: 'Mantra of Solace',
    normalId: ID.RESTORING_REPRIEVE,
    finalId: ID.REJUVENATING_RESPITE
  },
  {
    rootId: ID.MANTRA_OF_FLAME,
    rootName: 'Mantra of Flame',
    normalId: ID.FLAME_RUSH,
    finalId: ID.FLAME_SURGE
  },
  {
    rootId: ID.MANTRA_OF_POTENCE,
    rootName: 'Mantra of Potence',
    normalId: ID.POTENT_HASTE,
    finalId: ID.OVERWHELMING_CELERITY
  },
  {
    rootId: ID.MANTRA_OF_LIBERATION,
    rootName: 'Mantra of Liberation',
    normalId: ID.PORTENT_OF_FREEDOM,
    finalId: ID.UNHINDERED_DELIVERY
  }
]);

const MANTRA_BY_ROOT_ID = new Map(MANTRAS.map((definition) => [definition.rootId, definition]));
const MANTRA_BY_NORMAL_ID = new Map(MANTRAS.map((definition) => [definition.normalId, definition]));
const MANTRA_BY_FINAL_ID = new Map(MANTRAS.map((definition) => [definition.finalId, definition]));

function selectedMantras(context: GuardianSchedulerContext): readonly MantraDefinition[] {
  const names = selectedSkillNameSet(context.config.selectedSkills);
  // No configured list means "all mantras are equipped"; default to the full set.
  if (names.size === 0) return MANTRAS;
  return MANTRAS.filter((definition) => names.has(definition.rootName));
}

function mantraFlipActive(
  context: GuardianPrecastContext | GuardianSchedulerContext,
  definition: MantraDefinition
): boolean {
  const flips = professionCoreState(context).availableFlips;
  return Boolean(flips[definition.normalId] || flips[definition.finalId]);
}

function armMantra(context: GuardianSchedulerContext, definition: MantraDefinition, at: number): void {
  const normal = context.catalog.skillsById.get(definition.normalId);
  if (!normal) return;
  const core = professionCoreState(context);
  // Always start fresh at the normal-charge flip, never at the final-charge
  // flip, so ensureAmmo initialises the charge count from the skill data.
  delete core.availableFlips[definition.finalId];
  core.availableFlips[definition.normalId] = Number.POSITIVE_INFINITY;
  // Wipe any in-flight ammo/cooldown before ensureAmmo so it doesn't treat
  // this as a "refill" and add to an existing count.
  context.state.ammo.delete(normal.id);
  context.state.cooldowns.delete(normal.id);
  context.cooldownController.ensureAmmo(normal, at);
  // Remove the root prepare skill's cooldown so it shows as castable again
  // immediately after the auto-rearm, and record when it was last armed so
  // advanceFirebrandMantras can detect future rearm triggers.
  context.state.cooldowns.delete(definition.rootId);
  firebrandState.from(context).mantraRechargeReadyAt[definition.rootId] = at;
}

function syncMantraFlip(context: GuardianSchedulerContext, definition: MantraDefinition, at: number): void {
  const normal = context.catalog.skillsById.get(definition.normalId);
  // Guard: if ammo was never set this mantra is in full-recharge mode;
  // skip so we don't accidentally surface the final-charge flip early.
  if (!normal || !context.state.ammo.has(normal.id)) return;
  const ammo = context.cooldownController.refreshAmmo(normal, at);
  if (!ammo) return;
  const flips = professionCoreState(context).availableFlips;
  // The final-charge variant is a separate skill ID; the flip registry drives
  // which button the player sees, so exactly one of the two must be set.
  if (ammo.charges > 1) {
    delete flips[definition.finalId];
    flips[definition.normalId] = Number.POSITIVE_INFINITY;
  } else if (ammo.charges === 1) {
    delete flips[definition.normalId];
    flips[definition.finalId] = Number.POSITIVE_INFINITY;
  }
}

function startFullRecharge(context: GuardianSchedulerContext, definition: MantraDefinition, at: number): void {
  const root = context.catalog.skillsById.get(definition.rootId);
  const normal = context.catalog.skillsById.get(definition.normalId);
  if (!root || !normal) return;
  const flips = professionCoreState(context).availableFlips;
  // Hide both charge variants until the root prepare skill finishes recharging.
  delete flips[definition.normalId];
  delete flips[definition.finalId];
  context.state.ammo.delete(normal.id);
  context.state.cooldowns.delete(normal.id);
  const readyAt = at + context.rechargeDurationFor(root, at);
  // Put the root on cooldown so advanceFirebrandMantras knows when to auto-arm.
  context.state.cooldowns.set(root.id, readyAt);
  firebrandState.from(context).mantraRechargeReadyAt[root.id] = readyAt;
}

/** Starts selected PvE Firebrand mantras in their automatically prepared form. */
export function initializeFirebrandMantras(context: GuardianSchedulerContext): void {
  for (const definition of selectedMantras(context)) {
    armMantra(context, definition, context.state.time);
  }
}

/** Refreshes individual charges and automatically prepares a fully recharged mantra. */
export function advanceFirebrandMantras(context: GuardianSchedulerContext, target: number): void {
  for (const definition of MANTRAS) {
    const readyAt = Number(firebrandState.from(context).mantraRechargeReadyAt[definition.rootId]);
    // readyAt === 0 means "already armed at sim start", not "due now"; skip it.
    // The cooldowns guard prevents double-arming if advance is called twice for
    // the same tick.
    if (readyAt > 0 && readyAt <= target + context.epsilon && context.state.cooldowns.has(definition.rootId)) {
      armMantra(context, definition, readyAt);
    }

    syncMantraFlip(context, definition, target);
  }
}

/** Gates preparation, normal charges, and the distinct final-charge flip. */
export function firebrandMantraAvailability(context: GuardianPrecastContext, skill: GuardianSkill): AvailabilityResult {
  const root = MANTRA_BY_ROOT_ID.get(Number(skill.id));
  if (root) {
    return mantraFlipActive(context, root)
      ? denyCast('guardian.mantra-prepared', `${skill.name} is already prepared.`)
      : CAST_READY;
  }

  const normal = MANTRA_BY_NORMAL_ID.get(Number(skill.id));
  const final = MANTRA_BY_FINAL_ID.get(Number(skill.id));
  const definition = normal || final;
  if (!definition) return CAST_READY;
  const expectedId = normal ? definition.normalId : definition.finalId;
  const preparedAt = Number(firebrandState.from(context).mantraRechargeReadyAt[definition.rootId]);
  // preparedAt > start means the mantra is currently in full-recharge (not yet
  // armed), so give the scheduler a concrete retry time rather than blocking
  // forever with retryAt: null.
  if (preparedAt > context.start + context.epsilon) {
    return retryCast(
      preparedAt,
      'guardian.mantra-charge',
      `${skill.name} is unavailable until ${definition.rootName} is prepared.`
    );
  }

  // The flip being absent means this specific charge variant (normal vs. final)
  // is not the one currently available; no retry time because the scheduler
  // already controls which flip is live.
  if (professionCoreState(context).availableFlips[expectedId]) return CAST_READY;
  return denyCast('guardian.mantra-charge', `${skill.name} is unavailable until ${definition.rootName} is prepared.`);
}

/** Commits mantra preparation, charge flipping, and final-charge recharge. */
export function completeFirebrandMantra(context: GuardianCastContext, skill: GuardianSkill): void {
  // Interrupted casts must not consume a charge or start a recharge; early-out
  // when the cast was cut short before its natural end.
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const root = MANTRA_BY_ROOT_ID.get(Number(skill.id));
  if (root) {
    armMantra(context, root, context.effectiveEnd);
    return;
  }

  const normal = MANTRA_BY_NORMAL_ID.get(Number(skill.id));
  if (normal) {
    syncMantraFlip(context, normal, context.effectiveEnd);
    return;
  }

  const final = MANTRA_BY_FINAL_ID.get(Number(skill.id));
  if (final) startFullRecharge(context, final, context.effectiveEnd);
}
