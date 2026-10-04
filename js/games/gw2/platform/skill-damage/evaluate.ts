import { EPSILON } from '#kernel/core/clock.js';
import { CONDITION_FORMULAS } from '#gw2/platform/combat/formulas.js';
import type { Gw2DamageCalculation } from '#gw2/platform/engine/events/events.js';
import type { CastCommand, RotationCommand, SimulationStep } from '#gw2/platform/execution/types.js';
import type { Gw2ResolvedConditionApplication } from '#gw2/platform/resolver/condition-resolution.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';
import type {
  SkillDamageConditionRow,
  SkillDamageEvaluation,
  SkillDamageMeasurement,
  SkillDamageProbe,
  SkillDamageProbeConfig,
  SkillDamageProbeResult,
  SkillDamageProcResult,
  SkillDamageRequest,
  SkillDamageStrikeBreakdown
} from '#gw2/platform/skill-damage/types.js';

/** Runs one probe rotation through the engine; workers and the main thread inject the same entry. */
export type SkillDamageSimulate = (
  rotation: readonly RotationCommand[],
  config: Gw2Config,
  tailMs: number
) => Gw2SimulationResult;

/** Reaction sources that own their packets: they become proc rows, never part of the casting skill's row. */
const PROC_SOURCES: ReadonlySet<string> = new Set(['Trait', 'Relic', 'Sigil', 'Rune', 'Food']);

/** The proc a packet belongs to, if any. */
interface ProcIdentity {
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly icon: string;
}

type ProcClassifier = (event: Gw2ResolverEvent) => ProcIdentity | null;

/** The part of a packet name before its condition suffix, as in "Dhuumfire - Burning". */
const packetOwnerName = (name: string): string => name.split(/ [—-] /)[0];

/**
 * Identifies proc packets. A packet names its owner through its source, source id, skill name, or the part of its own
 * name before a condition suffix; some traits emit with their own name as the source rather than "Trait". Unmatched
 * reaction sources still become procs, labelled by their own packet name.
 */
function procClassifier(owners: SkillDamageRequest['procOwners']): ProcClassifier {
  type Owner = NonNullable<SkillDamageRequest['procOwners']>[number];
  const byMatch = new Map<string, Owner>();
  for (const owner of owners ?? []) for (const match of owner.matches) byMatch.set(match, owner);
  // An owner's identity is fixed by its first packet, so every later packet joins the same row and name.
  const identities = new Map<Owner, ProcIdentity>();
  return (event) => {
    if (event.actorType === 'summon' || event.summonOwner != null) return null;
    const name = event.name ?? '';
    const label = String(event.skillName || packetOwnerName(name) || event.sourceId);
    // Profession reactions retain their causal activation but own their damage, just like trait and gear procs.
    if (event.procType === 'profession') {
      const mode = / [—-] (Active|Passive)\b/.exec(name)?.[1];
      return {
        id: `Profession|${event.sourceId}`,
        // Multi-condition procs use their owner name, retaining an explicit active/passive mode when supplied.
        name: mode ? `${packetOwnerName(label)} (${mode.toLowerCase()})` : label,
        source: 'Profession',
        icon: event.icon ?? ''
      };
    }

    for (const candidate of [
      String(event.metadata?.procOwnerId),
      event.source,
      String(event.sourceId),
      String(event.skillId),
      event.skillName,
      packetOwnerName(name)
    ]) {
      const owner = typeof candidate === 'string' ? byMatch.get(candidate) : undefined;
      if (!owner) continue;
      let identity = identities.get(owner);
      if (!identity) {
        identity = {
          id: `${owner.source}|${owner.key}`,
          name: owner.name ?? label,
          source: owner.source,
          icon: owner.icon
        };
        identities.set(owner, identity);
      }

      return identity;
    }

    if (!PROC_SOURCES.has(event.source)) return null;
    return { id: `${event.source}|${label}`, name: label, source: event.source, icon: event.icon ?? '' };
  };
}

const MIN_TAIL_MS = 1_000;
export const SKILL_DAMAGE_TAIL_MS = MIN_TAIL_MS;
const MAX_TAIL_MS = 120_000;
// Condition remainders pay out on the next whole-second pulse after expiry.
const CONDITION_PAYOUT_MARGIN_SECONDS = 1.5;

type ConditionApplication = Gw2ResolvedConditionApplication;

/** A resolved strike packet, with the hit facts the resolver copied onto it. */
type StrikeHit = Gw2ResolverEvent & {
  readonly damage: number;
  readonly damageCalculation?: Gw2DamageCalculation;
  readonly hits?: number;
  readonly coefficient?: number;
  readonly criticalChance?: number;
  readonly criticalDamage?: number;
  readonly resolvedWeaponStrength?: number;
};

interface ProbeRun {
  readonly result: Gw2SimulationResult;
  readonly step: SimulationStep;
  readonly ambientEndTime: number;
}

interface ProcAccumulator extends ProcIdentity {
  triggers: number;
  readonly strikes: StrikeHit[];
  readonly conditions: ConditionApplication[];
  readonly observedOn: Set<string>;
}

/** Small worker-owned cache of isolated measurements; keys include the full config and proc ownership contract. */
export type SkillDamageCache = Map<
  string,
  {
    readonly result: SkillDamageProbeResult;
    readonly procs: readonly ProcAccumulator[];
  }
>;

/**
 * Measures every probe in isolation, so condition stacks, cooldowns, and buffs never leak between skills. Each row is
 * produced by the real runtime; this module only attributes and sums what the resolver already recorded.
 */
export function evaluateSkillDamage(
  request: SkillDamageRequest,
  simulate: SkillDamageSimulate,
  cache?: SkillDamageCache
): SkillDamageEvaluation {
  const procs = new Map<string, ProcAccumulator>();
  const classify = procClassifier(request.procOwners);
  const configKey = JSON.stringify([request.config, request.procOwners]);
  const probes = request.probes.map((probe) => {
    const key = `${configKey}|${JSON.stringify(probe)}`;
    let cached = cache?.get(key);
    if (!cached) {
      const isolatedProcs = new Map<string, ProcAccumulator>();
      const result = evaluateProbe(probe, request.config, simulate, classify, isolatedProcs);
      cached = { result, procs: [...isolatedProcs.values()] };
    }

    // Refresh insertion order for bounded LRU eviction, including cache hits.
    if (cache) {
      cache.delete(key);
      cache.set(key, cached);
      if (cache.size > 256) cache.delete(cache.keys().next().value!);
    }

    for (const entry of cached.procs) {
      const total = procs.get(entry.id) ?? {
        ...entry,
        triggers: 0,
        strikes: [],
        conditions: [],
        observedOn: new Set<string>()
      };
      total.triggers += entry.triggers;
      total.strikes.push(...entry.strikes);
      total.conditions.push(...entry.conditions);
      for (const name of entry.observedOn) total.observedOn.add(name);
      procs.set(entry.id, total);
    }

    return cached.result;
  });
  return {
    probes,
    procs: [...procs.values()]
      .flatMap((accumulator): SkillDamageProcResult[] => {
        const perTrigger = scaleMeasurement(
          measureEvents(accumulator.strikes, accumulator.conditions, 0),
          1 / accumulator.triggers
        );
        return perTrigger.total > 0
          ? [
              {
                id: accumulator.id,
                name: accumulator.name,
                source: accumulator.source,
                icon: accumulator.icon,
                triggers: accumulator.triggers,
                perTrigger,
                observedOn: [...accumulator.observedOn]
              }
            ]
          : [];
      })
      .sort((left, right) => right.perTrigger.total - left.perTrigger.total)
  };
}

function evaluateProbe(
  probe: SkillDamageProbe,
  baseConfig: Gw2Config,
  simulate: SkillDamageSimulate,
  classify: ProcClassifier,
  procs: Map<string, ProcAccumulator>
): SkillDamageProbeResult {
  const config = probeConfig(baseConfig, probe.config);
  if (!probe.variants?.length) {
    const run = runProbe(probe, config, probe.cast, simulate, classify);
    if (typeof run === 'string') return { id: probe.id, measurement: null, variants: [], rejected: run };
    observeProcs(run, probe, classify, procs);
    return { id: probe.id, measurement: measureRun(run, classify), variants: [] };
  }

  const runs = probe.variants.map((variant) => ({
    variant,
    run: runProbe(probe, config, { ...probe.cast, ...variant.cast }, simulate, classify)
  }));
  const primary = runs.find(({ variant }) => variant.id === probe.primaryVariantId) ?? runs.at(-1)!;
  if (typeof primary.run === 'string') return { id: probe.id, measurement: null, variants: [], rejected: primary.run };
  // Only the displayed variant feeds proc averages, so a ladder does not weight its skill's procs ten times.
  observeProcs(primary.run, probe, classify, procs);
  const variants = runs.map(({ variant, run }) => ({
    id: variant.id,
    label: variant.label,
    measurement: typeof run === 'string' ? null : measureRun(run, classify)
  }));
  return {
    id: probe.id,
    measurement: variants.find((variant) => variant.id === primary.variant.id)!.measurement,
    variants,
    primaryVariantId: primary.variant.id
  };
}

/** Applies a probe's weapon set, resource, and slot selection without touching the shared configuration. */
function probeConfig(config: Gw2Config, overrides: SkillDamageProbeConfig | undefined): Gw2Config {
  if (!overrides) return config;
  return {
    ...config,
    ...overrides.profession,
    ...(overrides.targetConditions
      ? { target: { ...config.target, conditions: { ...config.target?.conditions, ...overrides.targetConditions } } }
      : {}),
    ...(overrides.procRateOverrides ? { procRateOverrides: overrides.procRateOverrides } : {}),
    ...(overrides.startingWeaponSet != null ? { startingWeaponSet: overrides.startingWeaponSet } : {}),
    ...(overrides.initialResource != null ? { initialResource: overrides.initialResource } : {}),
    ...(overrides.selectedSkills ? { selectedSkills: overrides.selectedSkills } : {})
  };
}

/** Runs setup off-target, then the measured cast; returns the refusal reason when the runtime rejects any step. */
function runProbe(
  probe: SkillDamageProbe,
  config: Gw2Config,
  cast: Partial<CastCommand> | undefined,
  simulate: SkillDamageSimulate,
  classify: ProcClassifier
): ProbeRun | string {
  const rotation: RotationCommand[] = [
    ...probe.setup.map((command) =>
      command.type === 'cast' ? { ...command, offTarget: command.offTarget ?? true } : command
    ),
    { ...cast, type: 'cast', skillId: probe.skillId }
  ];
  let tailMs = Math.min(MAX_TAIL_MS, Math.max(MIN_TAIL_MS, probe.tailMs));
  let result = simulate(rotation, config, tailMs);
  const ambientEndTime = result.rotationEndTime + MIN_TAIL_MS / 1000;
  const refused = result.steps.find((step) => step.invalid);
  const step = result.steps.at(-1);
  if (refused || !step || step.ri !== rotation.length - 1 || step.activationId == null) {
    return refused?.invalidReason || result.warnings[0] || 'The skill could not be cast.';
  }

  // Follow actual queued effects and their condition payouts; unrelated ambient attacks cannot extend a skill row.
  for (;;) {
    const owned = activationMatcher(step.activationId, result, probe.procOnly);
    const sampled = probe.procOnly ? activationMatcher(step.activationId, result, true, ambientEndTime) : owned;
    const relevant = (event: Gw2ResolverEvent): boolean => {
      if (event.actorType === 'summon' || event.summonOwner != null) return false;
      if (owned(event)) return true;
      const proc = probe.procOnly ? classify(event) : null;
      return sampled(event) && !!proc && (!probe.procOwnerIds || probe.procOwnerIds.includes(proc.id));
    };

    const latestExpiry = Math.max(
      0,
      ...result.resolvedEvents
        .filter((event) => relevant(event) && isConditionApplication(event))
        .map((event) => Number(event.naturalExpiresAt))
    );
    const pendingAt = Math.max(
      0,
      ...(result.pendingEffects ?? []).filter((pending) => relevant(pending.cause)).map((pending) => pending.at)
    );
    const neededEnd = Math.max(pendingAt, latestExpiry ? latestExpiry + CONDITION_PAYOUT_MARGIN_SECONDS : 0);
    if (neededEnd <= result.observationEndTime + EPSILON) break;
    const neededMs = Math.ceil((neededEnd - result.rotationEndTime) * 1000);
    if (neededMs > MAX_TAIL_MS || tailMs >= MAX_TAIL_MS)
      return 'The skill continues beyond the supported two-minute preview window.';
    // Geometric growth bounds reruns when fine-grained native work (such as heat ticks) reveals one deadline at a time.
    tailMs = Math.min(MAX_TAIL_MS, Math.max(tailMs * 2, neededMs));
    result = simulate(rotation, config, tailMs);
  }

  return { result, step: result.steps.at(-1)!, ambientEndTime };
}

function isConditionApplication(event: Gw2ResolverEvent): event is ConditionApplication {
  return typeof event.condition === 'string' && typeof event.effectiveDuration === 'number';
}

function isStrikeHit(event: Gw2ResolverEvent): event is StrikeHit {
  // Flat condition-kind packets (Agony) are independent damage, unlike ticks already paid into condition applications.
  return (
    event.type === 'damage' &&
    (event.damageKind !== 'condition' || event.flatDamage != null) &&
    typeof event.damage === 'number'
  );
}

/** Matches the cast's activation and the derived ids of entities it spawned, such as `guardian.symbol:<id>:cast:3:1.6`. */
function activationMatcher(
  activationId: string,
  result: Gw2SimulationResult,
  includeSetup = false,
  ambientEndTime = -Infinity
): (event: Gw2ResolverEvent) => boolean {
  // Dedicated proc sequences also own setup casts and their Combat Start reactions, including delayed follow-ups.
  const ids = includeSetup
    ? result.steps.flatMap((step) => (step.activationId ? [step.activationId] : []))
    : [activationId];
  const escaped = ids.map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const pattern = new RegExp(`(^|:)(?:${escaped})(:|$)`);
  const byOrder = new Map([...result.events, ...result.resolvedEvents].map((event) => [event.eventOrder, event]));
  const castIds = new Set(result.steps.flatMap((step) => (step.activationId ? [step.activationId] : [])));
  // Follow recorded causes for reactions that intentionally have no activation of their own.
  return (event) => {
    let current: Gw2ResolverEvent | undefined = event;
    const visited = new Set<number>();
    while (current) {
      // A sampled ambient hit may cause delayed procs, such as a summon-triggered Shackles tether.
      if (current.at <= ambientEndTime + EPSILON) return true;
      if (includeSetup && current.type === 'combat_start') return true;
      // A different commanded cast owns its packets; generated effect activations still follow their recorded cause.
      if (current.activationId != null) {
        if (pattern.test(current.activationId)) return true;
        if (castIds.has(current.activationId)) return false;
      }

      const parent = current.parentEventOrder;
      if (typeof parent !== 'number' || visited.has(parent)) return false;
      visited.add(parent);
      current = byOrder.get(parent);
    }

    return false;
  };
}

function measureRun({ result, step }: ProbeRun, classify: ProcClassifier): SkillDamageMeasurement {
  const owned = activationMatcher(step.activationId!, result);
  const strikes: StrikeHit[] = [];
  const conditions: ConditionApplication[] = [];
  for (const event of result.resolvedEvents) {
    // Summon lanes are not yet linked to their summoning cast, so their damage is left out of every row.
    if (!owned(event) || event.actorType === 'summon' || event.summonOwner != null || classify(event)) continue;
    if (isStrikeHit(event)) strikes.push(event);
    else if (isConditionApplication(event)) conditions.push(event);
  }

  return measureEvents(strikes, conditions, Math.max(0, step.end - step.start) / 1000);
}

function measureEvents(
  strikes: readonly StrikeHit[],
  applications: readonly ConditionApplication[],
  castSeconds: number
): SkillDamageMeasurement {
  const strikeHits = strikes.filter((hit) => hit.damageKind !== 'condition');
  const strike = strikeHits.reduce((total, hit) => total + hit.damage, 0);
  const conditions = conditionRows(applications);
  const conditionDamage =
    conditions.reduce((total, row) => total + row.damage, 0) +
    strikes.filter((hit) => hit.damageKind === 'condition').reduce((total, hit) => total + hit.damage, 0);
  return {
    castSeconds,
    hits: strikeHits.reduce((total, hit) => total + (Number(hit.hits) || 1), 0),
    coefficient: strikeHits.reduce((total, hit) => total + (Number(hit.coefficient) || 0), 0),
    strike,
    conditionDamage,
    total: strike + conditionDamage,
    strikeBreakdown: strikeBreakdown(strikeHits),
    conditions
  };
}

/** Sums counted hits; the factor list comes from the first hit, and a flag says when later hits differed. */
function strikeBreakdown(strikes: readonly StrikeHit[]): SkillDamageStrikeBreakdown | null {
  const calculated = strikes.filter((hit) => hit.damageCalculation);
  const first = calculated[0];
  if (!first?.damageCalculation) return null;
  const calculation = first.damageCalculation;
  let baseDamage = 0;
  let nonCriticalDamage = 0;
  let criticalDamage = 0;
  for (const hit of calculated) {
    const facts = hit.damageCalculation!;
    baseDamage += facts.baseDamage;
    nonCriticalDamage += facts.baseDamage * facts.outgoingMultiplier;
    criticalDamage += facts.baseDamage * (hit.criticalDamage ?? 1) * facts.outgoingMultiplier;
  }

  return {
    weaponStrength: Number.isFinite(Number(first.resolvedWeaponStrength)) ? Number(first.resolvedWeaponStrength) : null,
    power: calculation.power,
    baseDamage,
    nonCriticalDamage,
    criticalDamage,
    averageDamage: calculated.reduce((total, hit) => total + hit.damage, 0),
    criticalChance: first.criticalChance ?? 0,
    criticalDamageMultiplier: first.criticalDamage ?? 1,
    averagedCriticalMultiplier: calculation.criticalMultiplier,
    outgoingMultiplier: calculation.outgoingMultiplier,
    contributors: calculation.outgoingContributors ?? [],
    variesAcrossHits: calculated.some(
      (hit) => Math.abs(hit.damageCalculation!.outgoingMultiplier - calculation.outgoingMultiplier) > 1e-9
    )
  };
}

/** Groups applications by condition; durations and factors come from the condition's first application. */
function conditionRows(applications: readonly ConditionApplication[]): SkillDamageConditionRow[] {
  const rows = new Map<string, { first: ConditionApplication; stacks: number; damage: number }>();
  for (const application of applications) {
    // Only conditions with a damage formula belong in a damage table; control conditions deal nothing.
    if (!Object.hasOwn(CONDITION_FORMULAS, application.condition) && !(application.damage > 0)) continue;
    const row = rows.get(application.condition);
    if (row) {
      row.stacks += application.stacks;
      row.damage += application.damage;
    } else
      rows.set(application.condition, { first: application, stacks: application.stacks, damage: application.damage });
  }

  return [...rows.entries()].map(([condition, { first, stacks, damage }]) => {
    const calculation = first.conditionCalculation;
    return {
      condition,
      stacks,
      baseDurationSeconds: calculation?.baseDuration ?? first.duration ?? 0,
      effectiveDurationSeconds: first.effectiveDuration,
      durationMultiplier: calculation?.durationMultiplier ?? 1,
      baseDurationMultiplier: calculation?.baseDurationMultiplier ?? 1,
      durationContributors: calculation?.durationContributors ?? [],
      conditionDamage: calculation?.conditionDamage ?? null,
      rate: calculation?.rate ?? null,
      multiplier: calculation?.multiplier ?? null,
      damageContributors: calculation?.damageContributors ?? [],
      damage
    };
  });
}

/** Records proc packets with their trigger count: distinct causing events, or distinct times without a recorded cause. */
function observeProcs(
  { result, step, ambientEndTime }: ProbeRun,
  probe: SkillDamageProbe,
  classify: ProcClassifier,
  procs: Map<string, ProcAccumulator>
): void {
  const triggersByProc = new Map<ProcAccumulator, Map<string, { declared: number }>>();
  const owned = activationMatcher(
    step.activationId!,
    result,
    probe.procOnly,
    probe.procOnly ? ambientEndTime : -Infinity
  );
  for (const event of result.resolvedEvents) {
    if (!owned(event)) continue;
    const strike = isStrikeHit(event);
    if (!strike && !isConditionApplication(event)) continue;
    const identity = classify(event);
    if (!identity) continue;
    if (probe.procOwnerIds && !probe.procOwnerIds.includes(identity.id)) continue;
    let accumulator = procs.get(identity.id);
    if (!accumulator) {
      accumulator = { ...identity, triggers: 0, strikes: [], conditions: [], observedOn: new Set() };
      procs.set(identity.id, accumulator);
    }

    if (strike) accumulator.strikes.push(event);
    else accumulator.conditions.push(event);
    accumulator.observedOn.add(probe.name ?? String(probe.skillId));
    const triggers = triggersByProc.get(accumulator) ?? new Map<string, { declared: number }>();
    const cause = event.parentEventOrder != null ? `cause:${event.parentEventOrder}` : `at:${event.at}`;
    // Allied charges and periodic profession pulses can share a granting cause but are distinct opportunities.
    const opportunity =
      event.procType === 'profession' || event.metadata?.triggeredByAlly != null
        ? `${cause}|at:${event.at}|ally:${event.metadata?.triggeredByAlly ?? 'self'}`
        : cause;
    // Aggregated chance packets and multi-entity procs already declare their actual quantity in engine metadata.
    const trigger = triggers.get(opportunity) ?? { declared: 0 };
    trigger.declared += Math.max(0, Number(event.metadata?.procCount) || 0);
    triggers.set(opportunity, trigger);
    triggersByProc.set(accumulator, triggers);
  }

  for (const [accumulator, triggers] of triggersByProc)
    accumulator.triggers += [...triggers.values()].reduce((total, trigger) => total + (trigger.declared || 1), 0);
}

/** Expresses an aggregate per trigger; contributor lists and durations are unchanged by the scale. */
function scaleMeasurement(measurement: SkillDamageMeasurement, factor: number): SkillDamageMeasurement {
  const scale = (value: number): number => value * factor;
  const breakdown = measurement.strikeBreakdown;
  return {
    ...measurement,
    hits: scale(measurement.hits),
    coefficient: scale(measurement.coefficient),
    strike: scale(measurement.strike),
    conditionDamage: scale(measurement.conditionDamage),
    total: scale(measurement.total),
    strikeBreakdown: breakdown
      ? {
          ...breakdown,
          baseDamage: scale(breakdown.baseDamage),
          nonCriticalDamage: scale(breakdown.nonCriticalDamage),
          criticalDamage: scale(breakdown.criticalDamage),
          averageDamage: scale(breakdown.averageDamage)
        }
      : null,
    conditions: measurement.conditions.map((row) => ({
      ...row,
      stacks: scale(row.stacks),
      damage: scale(row.damage)
    }))
  };
}
