import type {
  SkillDamageGroupKind,
  SkillDamagePlan,
  SkillDamageRowDefinition
} from '#gw2/app/build/skill-damage/plan.js';
import type { Gw2ModifierContribution } from '#gw2/platform/combat/modifiers.js';
import type {
  SkillDamageConditionRow,
  SkillDamageEvaluation,
  SkillDamageMeasurement
} from '#gw2/platform/skill-damage/types.js';

export type SkillDamageFilter = 'all' | 'equipped' | 'unslotted' | 'procs';

export interface SkillDamageViewState {
  readonly filter: SkillDamageFilter;
  readonly expanded: string | null;
  readonly closedGroups: ReadonlySet<string>;
  readonly targetArmor: number;
}

export interface SkillDamageVariantView {
  readonly id: string;
  readonly label: string;
  readonly total: number;
  readonly heightPercent: number;
  readonly primary: boolean;
}

export interface SkillDamageRowView {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly badge: string;
  readonly context: string;
  readonly status: 'equipped' | 'unslotted' | 'proc';
  readonly expanded: boolean;
  readonly measurement: SkillDamageMeasurement;
  /** Seconds of cast time, or null for procs, which have no cast. */
  readonly castSeconds: number | null;
  readonly perCastSecond: number | null;
  readonly variants: readonly SkillDamageVariantView[];
}

export interface SkillDamageGroupView {
  readonly id: string;
  readonly title: string;
  readonly kind: SkillDamageGroupKind | 'proc';
  readonly open: boolean;
  readonly rows: readonly SkillDamageRowView[];
}

export interface SkillDamageViewModel {
  readonly unavailable: readonly { name: string; reason: string }[];
  readonly groups: readonly SkillDamageGroupView[];
  readonly counts: Readonly<Record<SkillDamageFilter, number>>;
  readonly showStrikeColumns: boolean;
  readonly showAppliedColumn: boolean;
  readonly targetArmor: number;
}

const PROC_GROUP_ID = 'procs';

/** Projects a plan and its latest evaluation into rows; skills without measurable damage are simply left out. */
export function createSkillDamageViewModel(
  plan: SkillDamagePlan,
  evaluation: SkillDamageEvaluation | null,
  state: SkillDamageViewState
): SkillDamageViewModel {
  const results = new Map((evaluation?.probes ?? []).map((probe) => [probe.id, probe]));
  const all: { group: SkillDamagePlan['groups'][number] | null; row: SkillDamageRowView }[] = [];
  for (const group of plan.groups) {
    for (const rowId of group.rowIds) {
      const definition = plan.rows.get(rowId)!;
      const result = results.get(rowId);
      if (!result?.measurement || !(result.measurement.total > 0)) continue;
      all.push({
        group,
        row: skillRow(definition, result.measurement, result.variants, result.primaryVariantId, state)
      });
    }
  }

  for (const proc of evaluation?.procs ?? []) {
    const id = `proc:${proc.id}`;
    all.push({
      group: null,
      row: {
        id,
        name: proc.name,
        icon: proc.icon,
        badge: proc.source.charAt(0),
        context: proc.source,
        status: 'proc',
        expanded: state.expanded === id,
        measurement: proc.perTrigger,
        castSeconds: null,
        perCastSecond: null,
        variants: []
      }
    });
  }

  const matches = (row: SkillDamageRowView, filter: SkillDamageFilter): boolean =>
    filter === 'all' ||
    (filter === 'equipped' && row.status === 'equipped') ||
    (filter === 'unslotted' && row.status === 'unslotted') ||
    (filter === 'procs' && row.status === 'proc');
  const counts = Object.fromEntries(
    (['all', 'equipped', 'unslotted', 'procs'] as const).map((filter) => [
      filter,
      all.filter(({ row }) => matches(row, filter)).length
    ])
  ) as Record<SkillDamageFilter, number>;
  const shown = all.filter(({ row }) => matches(row, state.filter));
  const groups: SkillDamageGroupView[] = [
    ...plan.groups.map((group) => ({
      id: group.id,
      title: group.title,
      kind: group.kind,
      open: !state.closedGroups.has(group.id),
      rows: shown.filter((entry) => entry.group?.id === group.id).map(({ row }) => row)
    })),
    {
      id: PROC_GROUP_ID,
      title: 'Procs',
      kind: 'proc' as const,
      open: !state.closedGroups.has(PROC_GROUP_ID),
      rows: shown.filter((entry) => entry.group === null).map(({ row }) => row)
    }
  ].filter((group) => group.rows.length);
  const visible = groups.flatMap((group) => group.rows);
  // A declared damage owner that never fired is an uncovered trigger, not a measured zero-damage result.
  const unobserved = evaluation
    ? (plan.request.procOwners ?? [])
        .filter(
          (owner) =>
            owner.triggerRequirement && !evaluation.procs.some((proc) => proc.id === `${owner.source}|${owner.key}`)
        )
        .map((owner) => ({
          name: owner.name ?? `${owner.source}: ${owner.key}`,
          reason: `Not observed. ${owner.triggerRequirement}`
        }))
    : [];
  return {
    // Discovery refusals must remain inspectable too; otherwise a missing trigger looks like a zero-damage proc.
    unavailable: [
      ...(evaluation?.probes ?? [])
        .filter((probe) => probe.rejected)
        .map((probe) => ({
          name:
            plan.rows.get(probe.id)?.name ??
            `Proc discovery: ${plan.request.probes.find((entry) => entry.id === probe.id)?.name ?? probe.id}`,
          reason: probe.rejected!
        })),
      ...unobserved
    ],
    groups,
    counts,
    showStrikeColumns: visible.some((row) => row.measurement.strike > 0),
    showAppliedColumn: visible.some((row) => row.measurement.conditions.length > 0),
    targetArmor: state.targetArmor
  };
}

function skillRow(
  definition: SkillDamageRowDefinition,
  measurement: SkillDamageMeasurement,
  variants: readonly {
    readonly id: string;
    readonly label: string;
    readonly measurement: SkillDamageMeasurement | null;
  }[],
  primaryVariantId: string | undefined,
  state: SkillDamageViewState
): SkillDamageRowView {
  const measured = variants.filter((variant) => variant.measurement);
  const highest = Math.max(1, ...measured.map((variant) => variant.measurement!.total));
  return {
    id: definition.id,
    name: definition.name,
    icon: definition.icon,
    badge: definition.badge,
    context: definition.context,
    status: definition.status,
    expanded: state.expanded === definition.id,
    measurement,
    castSeconds: measurement.castSeconds,
    perCastSecond: measurement.castSeconds > 0 ? measurement.total / measurement.castSeconds : null,
    variants: measured.map((variant) => ({
      id: variant.id,
      label: variant.label,
      total: variant.measurement!.total,
      heightPercent: (variant.measurement!.total / highest) * 100,
      primary: variant.id === primaryVariantId
    }))
  };
}

/** GW2 sums additive modifiers into one bucket and applies multipliers separately; the breakdown shows both. */
export function contributionBuckets(contributors: readonly Gw2ModifierContribution[]): {
  readonly additive: readonly Gw2ModifierContribution[];
  readonly multipliers: readonly Gw2ModifierContribution[];
  readonly additiveTotal: number;
} {
  const additive = contributors.filter((contribution) => contribution.bucket === 'additive');
  return {
    additive,
    multipliers: contributors.filter((contribution) => contribution.bucket === 'multiplier'),
    additiveTotal: additive.reduce((total, contribution) => total + contribution.value, 0)
  };
}

/** Damage per stack-second including outgoing modifiers, from the condition's first damaging sample. */
export function conditionPerSecond(row: SkillDamageConditionRow): number | null {
  return row.rate != null && row.multiplier != null ? row.rate * row.multiplier : null;
}

/** The game's display names for resolver condition keys. */
export function conditionLabel(condition: string): string {
  return condition === 'Poisoned' ? 'Poison' : condition;
}
