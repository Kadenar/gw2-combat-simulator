import { professionCoreState } from "../../../platform/engine/profession.js";
/**
 * Revenant Core upkeep and pulse state machines.
 *
 * Toggles and releases upkeep skills and handles the recurring
 * revenant.upkeep-pulse task. Active elites add their own pulse side effects
 * through specialization-local scheduler hooks.
 */
import { emitRevenantState } from "./shared.js";
import { emitRevenantBoon } from "./boons.js";
import { REVENANT_SKILL_IDS as ID } from "../data/ids.js";
import type {
  SchedulerRecord,
  SimulationActorType,
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  RevenantCastContext,
  RevenantCoreState,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSkill,
  RevenantUpkeepState,
} from "../types.js";

const VENGEFUL_HAMMERS_IDS = new Set<SkillId>([
  ID.VENGEFUL_HAMMERS,
  ID.VENGEFUL_HAMMERS_ID_56752,
]);

interface UpkeepDamageOptions {
  readonly actorType?: SimulationActorType;
  readonly name?: string;
  readonly hitIndex?: number;
  readonly totalHits?: number;
}

interface UpkeepTaskPayload extends SchedulerRecord {
  readonly skillId: SkillId;
}

export function emitDamage(
  context: RevenantSchedulerContext,
  skill: RevenantSkill,
  at: number,
  coefficient: number,
  options: UpkeepDamageOptions = {},
): void {
  context.emit({
    type: "damage",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: options.actorType || "player",
    skillId: skill.id,
    skillName: skill.name,
    name: options.name || skill.name,
    coefficient,
    hits: 1,
    hitIndex: options.hitIndex || 1,
    totalHits: options.totalHits || 1,
    skillWeapon: "Unequipped",
  });
}

export function emitCondition(
  context: RevenantSchedulerContext,
  skill: RevenantSkill,
  at: number,
  condition: string,
  stacks: number,
  duration: number,
): void {
  context.emit({
    type: "condition",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: `${skill.name} — ${condition}`,
    condition,
    stacks,
    duration,
  });
}

function upkeepPulseInterval(skill: RevenantSkill | undefined): number {
  return Math.max(0, Number(skill?.upkeepPulseInterval ?? 1));
}

function facetConsumeId(
  skill: RevenantSkill,
  state: RevenantCoreState,
): SkillId | undefined {
  return (
    skill.upkeepConsumeByLegendId?.[state.activeLegendId] ??
    skill.upkeepConsumeId ??
    skill.flipSkillId ??
    undefined
  );
}

function emitEmbraceTheDarknessPulse(
  context: RevenantSchedulerContext,
  skill: RevenantSkill,
  active: RevenantUpkeepState,
  at: number,
): void {
  const strike = skill.effects?.find((effect) => effect.type === "strike");
  const torment = skill.effects?.find(
    (effect) =>
      effect.type === "condition" &&
      String(effect.metadata?.trigger || "") ===
        (active.empoweredNextPulse ? "empowered-upkeep-pulse" : ""),
  );
  if (!strike || !torment) {
    throw new Error("Embrace the Darkness is missing its pulse effects.");
  }
  emitDamage(context, skill, at, Number(strike.coefficient || 0));
  emitCondition(
    context,
    skill,
    at,
    "Torment",
    Number(torment.stacks || 0),
    Number(torment.duration || 0),
  );
  active.empoweredNextPulse = false;
}

/** Toggles an upkeep instance and schedules/cancels its recurring pulse task. */
export function toggleRevenantUpkeep(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const index = state.activeUpkeeps.findIndex(
    (upkeep) => upkeep.skillId === skill.id,
  );
  if (index >= 0) {
    state.activeUpkeeps.splice(index, 1);
    const consumeId = facetConsumeId(skill, state);
    const consume =
      consumeId == null ? undefined : context.catalog.skillsById.get(consumeId);
    if (consume) delete state.availableFlips[consume.id];
    context.tasks.cancelOwner(`revenant.upkeep:${skill.id}`);
    emitRevenantState(context, at, "upkeep-disabled");
    return;
  }
  const active: RevenantUpkeepState = {
    skillId: skill.id,
    upkeepCost: Number(skill.upkeepCost || 0),
    empoweredNextPulse: false,
    nextAlliedProcAt: null,
    nextAffinityAt: null,
  };
  state.activeUpkeeps.push(active);
  const consumeId = facetConsumeId(skill, state);
  const consume =
    consumeId == null ? undefined : context.catalog.skillsById.get(consumeId);
  if (consume) state.availableFlips[consume.id] = true;
  const release =
    skill.flipSkillId == null
      ? null
      : context.catalog.skillsById.get(skill.flipSkillId);
  if (release) state.availableFlips[release.id] = true;
  if (skill.id === ID.EMBRACE_THE_DARKNESS) {
    const strike = skill.effects?.find((effect) => effect.type === "strike");
    if (!strike) {
      throw new Error("Embrace the Darkness is missing its strike effect.");
    }
    emitEmbraceTheDarknessPulse(
      context,
      skill,
      active,
      context.start + Number(strike.atMs || 0) / 1000,
    );
  }
  context.tasks.schedule({
    type: "revenant.upkeep-pulse",
    at:
      skill.id === ID.EMBRACE_THE_DARKNESS
        ? Math.floor(at + context.epsilon) + 1
        : at + upkeepPulseInterval(skill),
    ownerId: `revenant.upkeep:${skill.id}`,
    payload: { skillId: skill.id },
  });
  emitRevenantState(context, at, "upkeep-enabled");
}

/** Releases an upkeep parent and applies its manual-release cooldown. */
export function releaseRevenantUpkeep(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const parent =
    skill.flipParentId == null
      ? null
      : context.catalog.skillsById.get(skill.flipParentId);
  if (!parent) return;
  state.activeUpkeeps = state.activeUpkeeps.filter(
    (upkeep) => upkeep.skillId !== parent.id,
  );
  delete state.availableFlips[skill.id];
  context.tasks.cancelOwner(`revenant.upkeep:${parent.id}`);
  const cooldown = Math.max(0, Number(parent.manualReleaseCooldown || 0));
  if (cooldown > 0) {
    context.state.cooldowns.set(parent.id, at + cooldown);
  }
  emitRevenantState(context, at, "upkeep-released");
}

/** Resolves one recurring upkeep pulse and schedules the next occurrence. */
export function handleRevenantUpkeepPulse(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<UpkeepTaskPayload>,
): void {
  if (!task.payload) return;
  const payload = task.payload;
  const active = professionCoreState(context).activeUpkeeps.find(
    (upkeep) => upkeep.skillId === payload.skillId,
  );
  if (!active) return;
  const skill = context.catalog.skillsById.get(payload.skillId);
  if (skill?.id === ID.EMBRACE_THE_DARKNESS) {
    emitEmbraceTheDarknessPulse(context, skill, active, task.at);
  } else if (skill && VENGEFUL_HAMMERS_IDS.has(skill.id)) {
    const strike = skill.effects?.find((effect) => effect.type === "strike");
    if (!strike)
      throw new Error("Vengeful Hammers is missing its strike effect.");
    const hammers = Math.max(0, Math.trunc(Number(strike.hits || 0)));
    const coefficient = Number(strike.coefficient || 0);
    for (let hammer = 1; hammer <= hammers; hammer += 1) {
      emitDamage(context, skill, task.at, coefficient, {
        name: `Vengeful Hammers — Hammer ${hammer}`,
        hitIndex: hammer,
        totalHits: hammers,
      });
    }
  } else if (skill?.upkeepPulse) {
    const pulse = skill.upkeepPulse as {
      readonly kind: string;
      readonly duration: number;
      readonly stacks: number;
    };
    if (pulse) {
      emitRevenantBoon(
        context,
        skill,
        pulse.kind,
        pulse.duration,
        pulse.stacks,
        { at: task.at },
      );
    }
  }
  context.tasks.schedule({
    type: "revenant.upkeep-pulse",
    at: task.at + upkeepPulseInterval(skill),
    ownerId: `revenant.upkeep:${payload.skillId}`,
    payload,
  });
}

/** Raw Core upkeep callbacks consumed by the Core handler registry. */
export const revenantUpkeepSkillHandlers = Object.freeze({
  "revenant.upkeep": toggleRevenantUpkeep,
  "revenant.upkeep-release": releaseRevenantUpkeep,
});
