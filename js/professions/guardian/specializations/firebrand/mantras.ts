import { professionCoreState } from "../../../../platform/engine/profession.js";
import { GUARDIAN_SKILL_IDS as ID } from "../../data/ids.js";
import { firebrandState } from "./state.js";
import type { AvailabilityResult } from "../../../../platform/engine/types.js";
import type {
  GuardianCastContext,
  GuardianPrecastContext,
  GuardianSchedulerContext,
  GuardianSkill,
} from "../../types.js";

interface MantraDefinition {
  readonly rootId: number;
  readonly rootName: string;
  readonly normalId: number;
  readonly finalId: number;
}

const MANTRAS: readonly MantraDefinition[] = Object.freeze([
  {
    rootId: ID.MANTRA_OF_SOLACE,
    rootName: "Mantra of Solace",
    normalId: ID.RESTORING_REPRIEVE,
    finalId: ID.REJUVENATING_RESPITE,
  },
  {
    rootId: ID.MANTRA_OF_FLAME,
    rootName: "Mantra of Flame",
    normalId: ID.FLAME_RUSH,
    finalId: ID.FLAME_SURGE,
  },
  {
    rootId: ID.MANTRA_OF_POTENCE,
    rootName: "Mantra of Potence",
    normalId: ID.POTENT_HASTE,
    finalId: ID.OVERWHELMING_CELERITY,
  },
  {
    rootId: ID.MANTRA_OF_LIBERATION,
    rootName: "Mantra of Liberation",
    normalId: ID.PORTENT_OF_FREEDOM,
    finalId: ID.UNHINDERED_DELIVERY,
  },
]);

const MANTRA_BY_ROOT_ID = new Map(
  MANTRAS.map((definition) => [definition.rootId, definition]),
);
const MANTRA_BY_NORMAL_ID = new Map(
  MANTRAS.map((definition) => [definition.normalId, definition]),
);
const MANTRA_BY_FINAL_ID = new Map(
  MANTRAS.map((definition) => [definition.finalId, definition]),
);

function selectedMantras(
  context: GuardianSchedulerContext,
): readonly MantraDefinition[] {
  const configured = context.config.selectedSkills;
  if (!Array.isArray(configured) || configured.length === 0) return MANTRAS;
  const names = new Set(
    configured.map((skill) =>
      typeof skill === "string"
        ? skill
        : String((skill as { readonly name?: string })?.name || ""),
    ),
  );
  return MANTRAS.filter((definition) => names.has(definition.rootName));
}

function mantraFlipActive(
  context: GuardianPrecastContext | GuardianSchedulerContext,
  definition: MantraDefinition,
): boolean {
  const flips = professionCoreState(context).availableFlips;
  return Boolean(flips[definition.normalId] || flips[definition.finalId]);
}

function armMantra(
  context: GuardianSchedulerContext,
  definition: MantraDefinition,
  at: number,
): void {
  const normal = context.catalog.skillsById.get(definition.normalId);
  if (!normal) return;
  const core = professionCoreState(context);
  delete core.availableFlips[definition.finalId];
  core.availableFlips[definition.normalId] = Number.POSITIVE_INFINITY;
  context.state.ammo.delete(normal.id);
  context.state.cooldowns.delete(normal.id);
  context.cooldownController.ensureAmmo(normal, at);
  context.state.cooldowns.delete(definition.rootId);
  firebrandState.from(context).mantraRechargeReadyAt[definition.rootId] = at;
}

function syncMantraFlip(
  context: GuardianSchedulerContext,
  definition: MantraDefinition,
  at: number,
): void {
  const normal = context.catalog.skillsById.get(definition.normalId);
  if (!normal || !context.state.ammo.has(normal.id)) return;
  const ammo = context.cooldownController.refreshAmmo(normal, at);
  if (!ammo) return;
  const flips = professionCoreState(context).availableFlips;
  if (ammo.charges > 1) {
    delete flips[definition.finalId];
    flips[definition.normalId] = Number.POSITIVE_INFINITY;
  } else if (ammo.charges === 1) {
    delete flips[definition.normalId];
    flips[definition.finalId] = Number.POSITIVE_INFINITY;
  }
}

function startFullRecharge(
  context: GuardianSchedulerContext,
  definition: MantraDefinition,
  at: number,
): void {
  const root = context.catalog.skillsById.get(definition.rootId);
  const normal = context.catalog.skillsById.get(definition.normalId);
  if (!root || !normal) return;
  const flips = professionCoreState(context).availableFlips;
  delete flips[definition.normalId];
  delete flips[definition.finalId];
  context.state.ammo.delete(normal.id);
  context.state.cooldowns.delete(normal.id);
  const readyAt = at + context.rechargeDurationFor(root, at);
  context.state.cooldowns.set(root.id, readyAt);
  firebrandState.from(context).mantraRechargeReadyAt[root.id] = readyAt;
}

/** Starts selected PvE Firebrand mantras in their automatically prepared form. */
export function initializeFirebrandMantras(
  context: GuardianSchedulerContext,
): void {
  for (const definition of selectedMantras(context)) {
    armMantra(context, definition, context.state.time);
  }
}

/** Refreshes individual charges and automatically prepares a fully recharged mantra. */
export function advanceFirebrandMantras(
  context: GuardianSchedulerContext,
  target: number,
): void {
  for (const definition of MANTRAS) {
    const readyAt = Number(
      firebrandState.from(context).mantraRechargeReadyAt[definition.rootId],
    );
    if (
      readyAt > 0 &&
      readyAt <= target + context.epsilon &&
      context.state.cooldowns.has(definition.rootId)
    ) {
      armMantra(context, definition, readyAt);
    }
    syncMantraFlip(context, definition, target);
  }
}

/** Gates preparation, normal charges, and the distinct final-charge flip. */
export function firebrandMantraAvailability(
  context: GuardianPrecastContext,
  skill: GuardianSkill,
): boolean | AvailabilityResult {
  const root = MANTRA_BY_ROOT_ID.get(Number(skill.id));
  if (root) {
    return mantraFlipActive(context, root)
      ? {
          ready: false,
          retryAt: null,
          code: "guardian.mantra-prepared",
          reason: `${skill.name} is already prepared.`,
        }
      : true;
  }

  const normal = MANTRA_BY_NORMAL_ID.get(Number(skill.id));
  const final = MANTRA_BY_FINAL_ID.get(Number(skill.id));
  const definition = normal || final;
  if (!definition) return true;
  const expectedId = normal ? definition.normalId : definition.finalId;
  const preparedAt = Number(
    firebrandState.from(context).mantraRechargeReadyAt[definition.rootId],
  );
  if (preparedAt > context.start + context.epsilon) {
    return {
      ready: false,
      retryAt: preparedAt,
      code: "guardian.mantra-charge",
      reason: `${skill.name} is unavailable until ${definition.rootName} is prepared.`,
    };
  }
  if (professionCoreState(context).availableFlips[expectedId]) return true;
  return {
    ready: false,
    retryAt: null,
    code: "guardian.mantra-charge",
    reason: `${skill.name} is unavailable until ${definition.rootName} is prepared.`,
  };
}

/** Commits mantra preparation, charge flipping, and final-charge recharge. */
export function completeFirebrandMantra(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
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
