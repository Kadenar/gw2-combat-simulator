/** Shared execution owns recharge work and magazine identity; availability is derived without a second ammo deadline. */
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { projectRecharge, type RechargeProgress } from '#gw2/platform/combat/recharge.js';
import type { RateInterval } from '#gw2/platform/combat/resources/pool.js';
import { RECIPIENT } from '#gw2/platform/constants.js';
import type {
  AmmoObservation,
  CooldownController,
  CooldownQueries,
  MechanicCooldownController,
  RechargeCheckpoint,
  RechargeTimerSnapshot,
  RechargeWorkSnapshot
} from '#gw2/platform/execution/cooldown-contracts.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { clamp } from '#kernel/core/numeric.js';

interface CooldownControllerOptions {
  readonly clock: { readonly time: number };
  readonly rechargeDuration: (skill: Skill, at: number, companionId?: string) => number;
  readonly rechargeIntervals?: (
    skill: Skill,
    start: number,
    end: number,
    companionId?: string
  ) => Iterable<RateInterval>;
  readonly skillFor?: (id: SkillId) => Skill | undefined;
  readonly maximumAmmo?: (skill: Skill) => number;
}

/** Fixed deadlines are authority; work deadlines are caches owned by the same record as their progress. */
type RechargeTimer =
  { kind: 'fixed'; readyAt: number } | { kind: 'work'; progress: RechargeProgress; projectedReadyAt: number };

interface AmmoPool {
  readonly skill: Skill;
  charges: number;
  maximum: number;
  recharges: RechargeProgress[];
  lockout?: RechargeTimer;
}

export function createCooldownController({
  clock,
  rechargeDuration,
  rechargeIntervals = (_skill, start, end) => [{ start, end, rate: 1 }],
  skillFor = () => undefined,
  maximumAmmo = (skill) => skill.ammo || 0
}: CooldownControllerOptions): Readonly<CooldownController> {
  const timers = new Map<SkillId, RechargeTimer>();
  const ammoPools = new Map<SkillId, AmmoPool>();

  // Only received summon Alacrity can change a running recharge's projected deadline.
  const hasVariableRechargeRate = (skill: Skill): boolean =>
    skill.rechargeBuffAudience === RECIPIENT.SUMMONS && !skill.rechargeIgnoresAlacrity;

  if (typeof rechargeDuration !== 'function') {
    throw new TypeError('Cooldown controller requires rechargeDuration.');
  }

  const requireSkill = (id: SkillId): Skill => {
    const skill = skillFor(id);

    if (!skill) throw new Error(`Missing recharging skill ${id}`);

    return skill;
  };

  const rate = (skill: Skill, at = clock.time, companionId?: string): number => {
    for (const interval of rechargeIntervals(skill, at, Infinity, companionId)) return interval.rate;
    return 1;
  };

  // Integrate elapsed work so later boon changes never alter progress already earned.
  const remaining = (skill: Skill, progress: RechargeProgress, at: number): number => {
    let work = progress.work;
    for (const interval of rechargeIntervals(
      skill,
      progress.workAnchorAt,
      Math.max(progress.workAnchorAt, at),
      progress.companionId
    )) {
      work -= (interval.end - interval.start) * interval.rate;
    }

    return Math.max(0, work);
  };

  const project = (skill: Skill, progress: RechargeProgress): number => {
    const deadline = projectRecharge(
      progress,
      rechargeIntervals(skill, progress.workAnchorAt, Infinity, progress.companionId)
    );
    return Number.isFinite(deadline) ? canonicalTime(deadline) : deadline;
  };

  const workTimer = (skill: Skill, progress: RechargeProgress): RechargeTimer => ({
    kind: 'work',
    progress,
    projectedReadyAt: project(skill, progress)
  });
  const deadline = (timer: RechargeTimer): number => (timer.kind === 'fixed' ? timer.readyAt : timer.projectedReadyAt);
  const liveDeadline = (skill: Skill, timer: RechargeTimer): number =>
    timer.kind === 'work' && hasVariableRechargeRate(skill) ? project(skill, timer.progress) : deadline(timer);
  const cloneTimer = (timer: RechargeTimer): RechargeTimer =>
    timer.kind === 'fixed' ? { ...timer } : { ...timer, progress: { ...timer.progress } };

  const startRecharge = (skill: Skill, at: number, work?: number, companionId?: string): number => {
    const timer = workTimer(skill, {
      workAnchorAt: at,
      work: Math.max(0, work ?? rechargeDuration(skill, at, companionId) * rate(skill, at, companionId)),
      ...(companionId == null ? {} : { companionId })
    });
    timers.set(skill.id, timer);
    return deadline(timer);
  };

  const fixedTimer = (readyAt: number): RechargeTimer => ({
    kind: 'fixed',
    readyAt: Number.isFinite(readyAt) ? canonicalTime(readyAt) : readyAt
  });
  const setReadyAt = (id: SkillId, readyAt: number): void => {
    timers.set(id, fixedTimer(readyAt));
  };

  const clear = (id: SkillId): void => {
    timers.delete(id);
  };

  const copy = (sourceId: SkillId, targetId: SkillId): void => {
    if (sourceId === targetId) return;

    const timer = timers.get(sourceId);

    if (timer) timers.set(targetId, cloneTimer(timer));
    else clear(targetId);
  };

  const nextRechargeAt = (ammo: AmmoPool): number | null =>
    ammo.recharges.length ? project(ammo.skill, ammo.recharges[0]!) : null;

  // Availability belongs to the pool, including every linked face, rather than to an ordinary timer mirror.
  const ammoReadyAt = (ammo: AmmoPool, at: number): number | undefined => {
    const lockout = ammo.lockout ? liveDeadline(ammo.skill, ammo.lockout) : 0;
    const ready = Math.max(
      gw2CooldownReadyAt(lockout) > at ? lockout : 0,
      ammo.charges === 0 ? (nextRechargeAt(ammo) ?? 0) : 0
    );
    return gw2CooldownReadyAt(ready) > at ? ready : undefined;
  };

  const readyAt = (id: SkillId): number | undefined => {
    const ammo = ammoPools.get(id);

    if (ammo) return ammoReadyAt(ammo, clock.time);

    const timer = timers.get(id);
    return timer ? deadline(timer) : undefined;
  };

  // Observations are detached so a caller cannot mutate the resource or retain a hidden writable queue.
  const observeAmmo = (ammo: AmmoPool): AmmoObservation => ({
    charges: ammo.charges,
    maximum: ammo.maximum,
    recharges: ammo.recharges.map((progress) => ({ ...progress })),
    nextRechargeAt: nextRechargeAt(ammo)
  });

  const ensurePool = (skill: Skill): AmmoPool | null => {
    // Capacity gates read current profession state even when a previously prepared pool exists.
    const maximum = Math.max(0, maximumAmmo(skill) || 0);

    if (!maximum) return null;

    const existing = ammoPools.get(skill.id);

    if (existing) return existing;

    const ammo: AmmoPool = { skill, charges: maximum, maximum, recharges: [] };
    ammoPools.set(skill.id, ammo);
    return ammo;
  };

  // The next round starts only after the front completes; reservations may impose a later minimum anchor.
  const settleAmmo = (ammo: AmmoPool, at: number): void => {
    while (ammo.recharges.length) {
      const completedAt = gw2CooldownReadyAt(project(ammo.skill, ammo.recharges[0]!));

      if (completedAt > at) break;

      ammo.charges = Math.min(ammo.maximum, ammo.charges + 1);
      ammo.recharges.shift();
      const next = ammo.recharges[0];

      if (next) next.workAnchorAt = Math.max(next.workAnchorAt, completedAt);
    }

    if (ammo.charges >= ammo.maximum) ammo.recharges = [];
  };

  const refreshPool = (skill: Skill, at: number): AmmoPool | null => {
    const ammo = ensurePool(skill);

    if (ammo) settleAmmo(ammo, at);

    return ammo;
  };

  const spendAmmo = (skill: Skill, at: number, committedRechargeWork?: number): void => {
    const ammo = refreshPool(skill, at);

    if (!ammo || ammo.charges <= 0) return;

    ammo.charges -= 1;
    // A committed cast retains its selected work; direct resource spends calculate work at their own anchor.
    const work = Math.max(0, committedRechargeWork ?? rechargeDuration(skill, at) * rate(skill, at));
    ammo.recharges.push({ workAnchorAt: at, work });
  };

  // Restore waiting rounds first, preserving the active round's earned work.
  const restoreAmmo = (skill: Skill, count: number, at: number): number => {
    const ammo = refreshPool(skill, at);

    if (!ammo) return 0;

    const restored = clamp(Math.floor(count || 0), 0, ammo.maximum - ammo.charges);

    if (!restored) return 0;

    ammo.charges += restored;
    ammo.recharges.splice(Math.max(0, ammo.recharges.length - restored));
    return restored;
  };

  // Apply reduction once across the queue; only the front round has earned elapsed work.
  const reduceAmmoRecharge = (skill: Skill, requested: number, at: number): number => {
    const ammo = refreshPool(skill, at);

    if (!ammo || !ammo.recharges.length) return 0;

    const rechargeRate = rate(ammo.skill, at, ammo.recharges[0]!.companionId);
    let reducedWork = 0;
    let remainingReduction = requested;
    ammo.recharges = ammo.recharges.map((progress, index) => {
      // Reservations may precede their recharge anchor; reductions cannot advance a timer that has not started.
      if (progress.workAnchorAt > at) return progress;

      const work = index === 0 ? remaining(ammo.skill, progress, at) : progress.work;
      const reduction = Math.min(remainingReduction, work);
      remainingReduction -= reduction;
      reducedWork += reduction;
      return { ...progress, workAnchorAt: index === 0 ? at : progress.workAnchorAt, work: work - reduction };
    });
    settleAmmo(ammo, at);
    return reducedWork / rechargeRate;
  };

  const reduceSkillRecharge = (skill: Skill, reduction: number, at = clock.time): number => {
    const requested = Math.max(0, reduction || 0);

    if (requested <= 0) return 0;

    if (ammoPools.has(skill.id)) return reduceAmmoRecharge(skill, requested, at);

    const timer = timers.get(skill.id);

    if (!timer) return 0;

    if (timer.kind === 'fixed') {
      // Fixed summon deadlines have no boon owner (including retired pets); ordinary fixed timers keep player scaling.
      const rechargeRate = skill.rechargeBuffAudience === RECIPIENT.SUMMONS ? 1 : rate(skill, at);
      const reducedBy = clamp(requested / rechargeRate, 0, timer.readyAt - at);

      if (reducedBy) setReadyAt(skill.id, timer.readyAt - reducedBy);

      return reducedBy;
    }

    const work = remaining(skill, timer.progress, at);
    const reducedWork = Math.min(requested, work);

    if (!reducedWork) return 0;

    // Query the captured incarnation before mutation so a failed rate lookup cannot partially apply the reduction.
    const rechargeRate = rate(skill, at, timer.progress.companionId);
    startRecharge(skill, at, work - reducedWork, timer.progress.companionId);
    return reducedWork / rechargeRate;
  };

  // Between-use recharge is independent of the serial resource queue and keeps the longer active timer.
  const setAmmoLockout = (skill: Skill, work: number, at = clock.time): void => {
    const ammo = ensurePool(skill);

    if (!ammo) return;

    const timer = workTimer(ammo.skill, { workAnchorAt: at, work: Math.max(0, work) });

    if (!ammo.lockout || deadline(timer) >= liveDeadline(ammo.skill, ammo.lockout)) ammo.lockout = timer;
  };

  // Only ordinary timers and the front ammo round earn elapsed work; waiting rounds retain their full queued work.
  const snapshotWork = (skill: Skill, progress: RechargeProgress, at: number, active = true): RechargeWorkSnapshot => ({
    work: active ? remaining(skill, progress, at) : progress.work,
    startDelay: Math.max(0, progress.workAnchorAt - at),
    ...(progress.companionId == null ? {} : { companionId: progress.companionId })
  });
  const restoreWork = (snapshot: RechargeWorkSnapshot, at: number): RechargeProgress => ({
    workAnchorAt: at + snapshot.startDelay,
    work: snapshot.work,
    ...(snapshot.companionId == null ? {} : { companionId: snapshot.companionId })
  });
  const snapshotTimer = (skillId: SkillId, timer: RechargeTimer, at: number): RechargeTimerSnapshot =>
    timer.kind === 'fixed'
      ? { kind: 'fixed', remaining: Math.max(0, timer.readyAt - at) }
      : { kind: 'work', progress: snapshotWork(requireSkill(skillId), timer.progress, at) };
  const restoreTimer = (skillId: SkillId, snapshot: RechargeTimerSnapshot, at: number): RechargeTimer =>
    snapshot.kind === 'fixed'
      ? fixedTimer(at + snapshot.remaining)
      : workTimer(requireSkill(skillId), restoreWork(snapshot.progress, at));

  // Narrow capabilities own their operations; wider views reuse them without exposing owner back-references.
  const queries = Object.freeze({
    readyAt,
    hasCooldown: (id: SkillId) => readyAt(id) !== undefined,
    hasAmmo: (id: SkillId) => ammoPools.has(id),
    readAmmo(id: SkillId) {
      const ammo = ammoPools.get(id);
      return ammo ? observeAmmo(ammo) : undefined;
    },
    rechargeFor(id: SkillId) {
      const timer = timers.get(id);
      return timer?.kind === 'work' ? timer.progress : undefined;
    },
    rate,
    project,
    remaining
  } satisfies CooldownQueries);
  const mechanics = Object.freeze({
    ...queries,
    // Live formula reads settle only the requested pool and retain unrounded deadline comparisons.
    isOnCooldown(id: SkillId, at = clock.time) {
      if (at !== clock.time) throw new RangeError('Live cooldown queries must use the current clock.');

      const ammo = ammoPools.get(id);

      if (ammo) {
        settleAmmo(ammo, at);
        return (ammoReadyAt(ammo, at) ?? 0) > at;
      }

      const timer = timers.get(id);
      const skill = skillFor(id);
      return timer ? (skill ? liveDeadline(skill, timer) : deadline(timer)) > at : false;
    },
    *cooldownSkillIds() {
      for (const id of timers.keys()) if (!ammoPools.has(id)) yield id;
      for (const [id, ammo] of ammoPools) if (ammoReadyAt(ammo, clock.time) !== undefined) yield id;
    },
    ammoSkillIds: () => ammoPools.keys(),
    retireAmmo(id: SkillId) {
      ammoPools.delete(id);
      clear(id);
    },
    linkAmmo(sourceId: SkillId, targetId: SkillId) {
      const ammo = ammoPools.get(sourceId);

      if (!ammo || sourceId === targetId) return;

      const target = requireSkill(targetId);

      // Linked faces may select different work at acceptance, but their running work must use the same rate policy.
      if (
        Boolean(ammo.skill.rechargeIgnoresAlacrity) !== Boolean(target.rechargeIgnoresAlacrity) ||
        (ammo.skill.rechargeBuffAudience === RECIPIENT.SUMMONS) !== (target.rechargeBuffAudience === RECIPIENT.SUMMONS)
      ) {
        throw new Error(`Cannot link ammo with different recharge policies: ${sourceId}, ${targetId}`);
      }

      ammoPools.set(targetId, ammo);
    },
    replaceSkillRecharge(skill: Skill, work: number, at: number) {
      const ammo = ammoPools.get(skill.id);

      if (ammo) ammo.lockout = workTimer(ammo.skill, { workAnchorAt: at, work: Math.max(0, work) });
      else startRecharge(skill, at, work);
    },
    reserveAmmo(skill: Skill, count: number, recharge: RechargeProgress) {
      const ammo = ammoPools.get(skill.id);

      if (!ammo) return 0;

      const reserved = clamp(Math.floor(count), 0, ammo.charges);
      ammo.charges -= reserved;
      for (let index = 0; index < reserved; index++) ammo.recharges.push({ ...recharge });

      // Acceptance precedes future recharge anchors; only the live clock may settle existing rounds.
      if (reserved) settleAmmo(ammo, clock.time);

      return reserved;
    },
    replaceAmmoCharges(skill: Skill, maximum: number, charges: number, recharges: readonly RechargeProgress[]) {
      const ammo = ammoPools.get(skill.id);

      if (!ammo) return;

      ammo.maximum = maximum;
      ammo.charges = charges;
      ammo.recharges = recharges.map((progress) => ({ ...progress }));
    },
    checkpoint(
      at: number,
      preservedCooldownIds: ReadonlySet<SkillId>,
      independentCooldownId: SkillId
    ): RechargeCheckpoint {
      if (preservedCooldownIds.has(independentCooldownId))
        throw new Error('Independent and preserved cooldowns must be disjoint.');

      const capturedTimers = new Map<SkillId, RechargeTimerSnapshot>();
      for (const [id, timer] of timers) {
        if (id === independentCooldownId || preservedCooldownIds.has(id)) continue;

        const ready = timer.kind === 'work' ? liveDeadline(requireSkill(id), timer) : deadline(timer);

        if (gw2CooldownReadyAt(ready) > at) capturedTimers.set(id, snapshotTimer(id, timer, at));
      }

      // Settle detached copies: capturing a future boundary must not consume live charges or advance the clock.
      const pools: RechargeCheckpoint['pools'][number][] = [];
      const poolIndexes = new Map<AmmoPool, number>();
      const ammoBindings = new Map<SkillId, number>();
      for (const [id, ammo] of ammoPools) {
        let index = poolIndexes.get(ammo);

        if (index === undefined) {
          index = pools.length;
          poolIndexes.set(ammo, index);
          const settled = { ...ammo, recharges: ammo.recharges.map((progress) => ({ ...progress })) };
          settleAmmo(settled, at);
          pools.push({
            skillId: ammo.skill.id,
            charges: settled.charges,
            maximum: settled.maximum,
            recharges: settled.recharges.map((progress, position) =>
              snapshotWork(ammo.skill, progress, at, position === 0)
            ),
            ...(ammo.lockout && gw2CooldownReadyAt(liveDeadline(ammo.skill, ammo.lockout)) > at
              ? { lockout: snapshotTimer(ammo.skill.id, ammo.lockout, at) }
              : {})
          });
        }

        ammoBindings.set(id, index);
      }

      return { timers: capturedTimers, pools, ammoBindings };
    },
    restoreCheckpoint(
      checkpoint: RechargeCheckpoint,
      at: number,
      preservedCooldownIds: ReadonlySet<SkillId>,
      deadlines: readonly { readonly skillId: SkillId; readonly readyAt: number }[]
    ) {
      // Build authoritative objects before publishing; preserved timers and explicit deadlines have unambiguous precedence.
      if (deadlines.some(({ skillId }) => preservedCooldownIds.has(skillId))) {
        throw new Error('Independent and preserved cooldowns must be disjoint.');
      }

      const restoredTimers = new Map([...timers].filter(([id]) => preservedCooldownIds.has(id)));
      const independentIds = new Set(deadlines.map(({ skillId }) => skillId));
      for (const [id, snapshot] of checkpoint.timers) {
        if (!preservedCooldownIds.has(id) && !independentIds.has(id))
          restoredTimers.set(id, restoreTimer(id, snapshot, at));
      }

      for (const { skillId, readyAt: ready } of deadlines) restoredTimers.set(skillId, fixedTimer(ready));
      const pools = checkpoint.pools.map((snapshot): AmmoPool => {
        const pool: AmmoPool = {
          skill: requireSkill(snapshot.skillId),
          charges: snapshot.charges,
          maximum: snapshot.maximum,
          recharges: snapshot.recharges.map((progress) => restoreWork(progress, at)),
          ...(snapshot.lockout ? { lockout: restoreTimer(snapshot.skillId, snapshot.lockout, at) } : {})
        };
        settleAmmo(pool, at);
        return pool;
      });
      const bindings = new Map<SkillId, AmmoPool>();
      for (const [id, index] of checkpoint.ammoBindings) {
        const pool = pools[index];

        if (!pool) throw new Error(`Missing checkpoint ammo pool ${index}`);

        bindings.set(id, pool);
      }

      timers.clear();
      for (const [id, timer] of restoredTimers) timers.set(id, timer);
      ammoPools.clear();
      for (const [id, pool] of bindings) ammoPools.set(id, pool);
    },
    retireCompanion(companionId: string, at: number) {
      // Freeze remaining pet work at the normal rate before its received-boon history is discarded.
      for (const [id, timer] of timers) {
        if (timer.kind === 'work' && timer.progress.companionId === companionId) {
          setReadyAt(id, at + remaining(requireSkill(id), timer.progress, at));
        }
      }
    },
    startRecharge,
    setReadyAt,
    clear,
    copy,
    refresh(at: number) {
      // Keep completed ordinary work for mechanics, reuse constant-rate caches, and settle each shared pool once.
      for (const [id, timer] of timers) {
        const skill = skillFor(id);

        if (timer.kind === 'work' && skill && hasVariableRechargeRate(skill))
          timer.projectedReadyAt = project(skill, timer.progress);
      }

      for (const ammo of new Set(ammoPools.values())) settleAmmo(ammo, at);
    },
    ensureAmmo(skill: Skill) {
      // Initialization checks capacity without copying observations or projecting recharge deadlines.
      return ensurePool(skill) !== null;
    },
    reduceSkillRecharge,
    refreshAmmo(skill: Skill, at: number) {
      const ammo = refreshPool(skill, at);
      return ammo ? observeAmmo(ammo) : null;
    },
    restoreAmmo
  } satisfies MechanicCooldownController);
  return Object.freeze({
    ...mechanics,
    resetAll() {
      timers.clear();
      ammoPools.clear();
    },
    spendAmmo,
    setAmmoLockout,
    queries,
    mechanics
  } satisfies CooldownController);
}
