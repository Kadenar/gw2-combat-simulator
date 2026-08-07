import { professionCoreState } from "../../../platform/engine/profession.js";
import { CANONICAL_TARGET_CONDITIONS } from "../../../platform/gw2/target-state.js";
import type {
  SchedulerRecord,
  SkillId,
} from "../../../platform/engine/types.js";
import type {
  Gw2ModifierContext,
  Gw2TimedBuffApplication,
} from "../../../platform/gw2/types.js";
import type {
  EngineerConfig,
  EngineerMechAttributes,
  EngineerRuntimeState,
  EngineerSimulationEvent,
  EngineerSkill,
  EngineerState,
} from "../types.js";

export function engineerEvent(
  context: Gw2ModifierContext,
): EngineerSimulationEvent | undefined {
  return (context.event || undefined) as EngineerSimulationEvent | undefined;
}

export function engineerRuntimeState(
  context: Gw2ModifierContext,
): Partial<EngineerState> {
  return professionCoreState(context) as Partial<EngineerState>;
}

export function engineerSchedulerState(
  context: Gw2ModifierContext,
): Partial<EngineerState> {
  return professionCoreState(context) as Partial<EngineerState>;
}

export function engineerSpecializationState(
  context: Gw2ModifierContext,
  expectedKind: string,
): Partial<EngineerState> {
  const state = (
    context.runtime?.profession
    ?? (context.state as { readonly profession?: unknown } | undefined)
      ?.profession
  ) as EngineerRuntimeState | undefined;
  if (state?.specialization.kind !== expectedKind) return {};
  return state.specialization.state as Partial<EngineerState>;
}

export function targetConditionCount(context: Gw2ModifierContext): number {
  return CANONICAL_TARGET_CONDITIONS.filter((condition) =>
    context.query?.targetHasCondition(
      condition,
      context.time,
      context.runtime,
    ),
  ).length;
}

export function vulnerability(context: Gw2ModifierContext): number {
  return Number(
    context.query?.targetConditionStacks(
      "Vulnerability",
      context.time,
      context.runtime,
    ) || 0,
  );
}

export function playerStrike(context: Gw2ModifierContext): boolean {
  return context.event?.actorType !== "summon";
}

export function eventSkill(
  context: Gw2ModifierContext,
): EngineerSkill | undefined {
  const profession = context.profession as
    | {
        readonly catalog?: {
          readonly skillsById?: ReadonlyMap<SkillId, EngineerSkill>;
        };
      }
    | undefined;
  const event = engineerEvent(context);
  const skillId = event?.skillId ?? event?.application?.skillId;
  if (skillId == null) return;
  return profession?.catalog?.skillsById?.get(skillId);
}

export function selectedSkillNames(
  context: Gw2ModifierContext,
): Set<string> {
  const config = (context.config || {}) as EngineerConfig;
  const selected = config.selectedSkills || [];
  return new Set(
    (Array.isArray(selected) ? selected : Object.values(selected)).map(String),
  );
}

export function playerHealthFraction(context: Gw2ModifierContext): number {
  return Math.max(
    0,
    Math.min(1, Number(context.config?.playerHealthFraction ?? 1)),
  );
}

export function targetHealthFraction(context: Gw2ModifierContext): number {
  const configured = Number(
    context.config?.targetHealthFraction
      ?? context.config?.target?.healthFraction,
  );
  if (Number.isFinite(configured)) {
    return Math.max(0, Math.min(1, configured));
  }
  const maximum = Number(context.config?.target?.health ?? 0);
  if (!(maximum > 0)) return 1;
  const totals = context.runtime?.totals as
    | { readonly strike?: number; readonly condition?: number }
    | undefined;
  const damage =
    Number(totals?.strike || 0)
    + Number(totals?.condition || 0);
  return Math.max(0, Math.min(1, 1 - damage / maximum));
}

export function heavyMetalBonus(context: Gw2ModifierContext): number {
  const fraction = targetHealthFraction(context);
  if (fraction < 0.25) return 0.15;
  if (fraction < 0.5) return 0.1;
  if (fraction < 0.75) return 0.05;
  return 0;
}

export function activeBoonStacks(
  context: Gw2ModifierContext,
  kind: string,
  maximum = 25,
): number {
  const permanent = context.config?.boons?.[kind];
  const base = permanent === true ? 1 : Number(permanent || 0);
  const schedulerState = context.state as
    | { readonly boons?: Map<string, Gw2TimedBuffApplication[]> }
    | undefined;
  const boons = context.runtime?.boons ?? schedulerState?.boons;
  const dynamic = (boons?.get(kind) || [])
    .filter(
      (application) =>
        application.at <= context.time
        && application.expiresAt > context.time,
    )
    .reduce(
      (sum, application) => sum + Number(application.stacks || 1),
      0,
    );
  return Math.max(0, Math.min(maximum, base + dynamic));
}

export function activeEngineerSpecializationState(
  context: Gw2ModifierContext,
  expectedKind: string,
  field: keyof EngineerState,
): boolean {
  const state = engineerSpecializationState(context, expectedKind);
  return Number(state?.[field] || 0) > context.time;
}

export function cloneEngineerAttributes(
  attributes: SchedulerRecord,
): EngineerMechAttributes & SchedulerRecord {
  return { ...attributes } as EngineerMechAttributes & SchedulerRecord;
}
