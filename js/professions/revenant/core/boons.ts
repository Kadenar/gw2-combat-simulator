import type {
  SchedulerRecord,
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  RevenantSchedulerContext,
  RevenantSkill,
} from "../types.js";

type RevenantBoonContext = RevenantSchedulerContext & {
  readonly effectiveEnd?: number;
};

interface RevenantBoonOptions extends SchedulerRecord {
  readonly at?: number;
  readonly sourceId?: SkillId;
  readonly name?: string;
  readonly recipients?: string;
  readonly extendsResolutionHorizon?: boolean;
}

/** Emits a profession-owned boon with optional recipient/horizon metadata. */
export function emitRevenantBoon(
  context: RevenantBoonContext,
  skill: RevenantSkill,
  boon: string,
  duration: number,
  stacks = 1,
  options: RevenantBoonOptions = {},
): void {
  context.emit({
    type: "buff",
    at: options.at ?? context.effectiveEnd ?? context.state.time,
    source: "revenant",
    sourceId: options.sourceId ?? skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name: options.name ?? `${skill.name} — ${boon}`,
    kind: boon,
    duration,
    stacks,
    ...(options.recipients ? { recipients: options.recipients } : {}),
    ...(options.extendsResolutionHorizon
      ? { extendsResolutionHorizon: true }
      : {}),
  });
}
