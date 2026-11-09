/** Own the family's shatter transactions while Core and elite resolvers retain their packet rules. */
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { mesmerCastDelivery } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { buildMesmerPacket } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import {
  mesmerProfessionActionCommitted,
  mesmerShatterCompleted,
  mesmerShatterResolved
} from '#gw2/professions/mesmer/core/mechanics/profession-actions.js';
import type { MesmerResourceSpendDetails } from '#gw2/professions/mesmer/core/mechanics/resource-types.js';
import { mesmerSelectedShatter } from '#gw2/professions/mesmer/core/mechanics/selected-shatter.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { resolveCloneShatter } from '#gw2/professions/mesmer/core/mechanics/shatters.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { mesmerShatterDefinition } from '#gw2/professions/mesmer/family-mechanics.js';
import { destroyClone } from '#gw2/professions/mesmer/family-resources.js';
import { mesmerResourceDefinition, mesmerResourceKind } from '#gw2/professions/mesmer/family-state.js';
import { resolveBladesong } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/bladesongs.js';
import type { MesmerRuntime, MesmerRuntimeState, MesmerShatterResolver } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { boundedNumber } from '#kernel/core/numeric.js';

interface ShatterTransaction {
  phase: 'reserved' | 'committed' | 'resolved';
  spent: number | null;
  readonly packetAt: number | undefined;
}

// This module owns pending transactions, keyed by each run's stable Core state across context rebinding.
const transactions = new WeakMap<MesmerRuntimeState['core'], Map<string, ShatterTransaction>>();
const SHATTER_SPEND = 'mesmer.shatter-spend';
const resolvers: Readonly<Record<string, MesmerShatterResolver>> = {
  'mesmer.core.clone-shatter': resolveCloneShatter,
  'mesmer.virtuoso.bladesong': resolveBladesong
};

function currentResource(runtime: MesmerRuntime): number {
  const kind = mesmerResourceKind(runtime.profession.specialization.kind);
  return kind === 'clones' ? runtime.profession.core.clones.length : runtime.resourceController.value(kind);
}

/** Report only committed spending, retaining the activation and the balance left after payment. */
function recordSpend(runtime: MesmerRuntime, at: number, spent: number, details: MesmerResourceSpendDetails): number {
  const kind = mesmerResourceKind(runtime.profession.specialization.kind);
  const definition = mesmerResourceDefinition(runtime.profession.specialization.kind, runtime.helpers);
  runtime.effects.emit({
    kind: 'packet',
    event: buildMesmerPacket({
      type: 'resource',
      at,
      amount: -spent,
      value: currentResource(runtime),
      resource: definition.plural,
      ...(kind !== 'clones' ? { maximum: definition.maximum } : {}),
      reason: 'profession mechanic',
      activationId: details.activationId
    })
  });
  return spent;
}

/** Continuum and instruments share immediate spending without acquiring a shatter reservation. */
export function consumeMesmerResources(
  runtime: MesmerRuntime,
  at: number,
  details: MesmerResourceSpendDetails = {}
): number {
  const kind = mesmerResourceKind(runtime.profession.specialization.kind);
  const spent = currentResource(runtime);

  if (kind === 'clones') {
    for (const clone of runtime.profession.core.clones) destroyClone(runtime, clone);
    runtime.profession.core.clones = [];
  } else runtime.resourceController.spend(kind, spent);

  return recordSpend(runtime, at, spent, details);
}

/** Both the scheduled spend and declared shatter action settle this reservation at most once. */
function commitReservation(runtime: MesmerRuntime, id: string, transaction: ShatterTransaction): void {
  if (transaction.phase !== 'reserved') return;

  const kind = mesmerResourceKind(runtime.profession.specialization.kind);

  if (kind === 'clones') throw new Error('Clone resources cannot be committed from a reservation.');

  const maximum = mesmerResourceDefinition(runtime.profession.specialization.kind, runtime.helpers).maximum;
  const reserved = boundedNumber(transaction.spent, 0, 0, maximum);
  const additional = Math.min(currentResource(runtime), maximum - reserved);
  runtime.resourceController.spend(kind, additional);
  transaction.spent = reserved + additional;
  transaction.phase = 'committed';
  recordSpend(runtime, runtime.time, transaction.spent, { activationId: id });
}

/** Capture spending at the shatter start hook; only numeric resources support delayed commitment. */
function beginShatter(runtime: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  // Continuum uses its own action and immediate spending, without a shatter transaction.
  if (!cast.skill.sideEffects?.some((effect) => effect.do.type === 'mesmer.shatter')) return;

  const shatter = mesmerShatterDefinition(runtime, cast.skill.id);

  if (!shatter) return;

  let pending = transactions.get(runtime.profession.core);

  if (!pending) transactions.set(runtime.profession.core, (pending = new Map()));

  if (pending.has(cast.id)) return;

  const progress = Number(shatter.resourceSpendProgress);
  const delayed =
    shatter.consumesResources !== false &&
    Number.isFinite(progress) &&
    canonicalTime(cast.fullEnd) > canonicalTime(cast.start);
  let spent: number | null = null;

  if (delayed) {
    const kind = mesmerResourceKind(runtime.profession.specialization.kind);

    if (kind === 'clones') throw new Error('Clone resources cannot be reserved.');

    spent = currentResource(runtime);
    runtime.resourceController.spend(kind, spent);
  } else if (shatter.consumesResources !== false) {
    spent = consumeMesmerResources(runtime, cast.start, { activationId: cast.id });
  }

  pending.set(cast.id, {
    phase: delayed ? 'reserved' : 'committed',
    spent,
    packetAt: delayed ? cast.fullEnd : undefined
  });

  if (delayed && !cast.cancelledBeforeCommit)
    runtime.schedule(
      SHATTER_SPEND,
      canonicalTime(Math.min(cast.effectiveEnd, cast.start + (cast.fullEnd - cast.start) * progress)),
      cast.id,
      undefined,
      -110
    );
}

/** Resolve the selected profile once, preserving resource, packet, marker, and trait causality. */
function resolveShatter(runtime: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const transaction = transactions.get(runtime.profession.core)?.get(cast.id);

  // Declared shatter actions must have a transaction; missing metadata is an authoring error.
  if (!transaction) throw new Error(`Missing Mesmer shatter data for ${cast.skill.name}.`);

  if (transaction.phase === 'resolved') return;

  commitReservation(runtime, cast.id, transaction);
  const skill = cast.skill;
  const shatter = mesmerSelectedShatter(runtime.helpers, skill.id);
  const definition = mesmerResourceDefinition(runtime.profession.specialization.kind, runtime.helpers);

  if (transaction.spent == null && currentResource(runtime) < (shatter.minimumResource || 0)) {
    transaction.phase = 'resolved';
    runtime.combat.warn({
      message: `${skill.name} skipped: no ${definition.plural}.`,
      at: runtime.time,
      activationId: cast.id
    });
    return;
  }

  const resolver = resolvers[shatter.resolver];

  if (!resolver) throw new Error(`Missing Mesmer shatter resolver ${shatter.resolver} for ${skill.name}.`);

  const spent = transaction.spent ?? consumeMesmerResources(runtime, runtime.time, { activationId: cast.id });
  transaction.spent = spent;
  transaction.phase = 'resolved';
  const delivery = mesmerCastDelivery(cast, skill, Infinity);
  const resolution: MesmerShatterResolution = {
    delivery,
    skill,
    at: runtime.time,
    spent,
    traitHits: resolver(runtime, {
      delivery,
      skill,
      shatter,
      at: transaction.packetAt ?? runtime.time,
      castStart: cast.start,
      spent
    })
  };
  runtime.fireTrigger(mesmerShatterResolved, { shatter, resolution });
  runtime.fireTrigger(mesmerProfessionActionCommitted, {
    slot: shatter.slot,
    skill,
    at: runtime.time,
    spent,
    delivery
  });
  runtime.effects.emit({
    ...delivery,
    kind: 'packet',
    event: buildMesmerPacket({
      type: 'marker',
      at: runtime.time,
      name: skill.name,
      detail: `${spent} ${definition.plural} spent`
    })
  });
  runtime.fireTrigger(mesmerShatterCompleted, { resolution });
}

/** Cancellation restores only uncommitted reservations; retired casts cannot be spent by stale tasks. */
function retireShatter(runtime: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const pending = transactions.get(runtime.profession.core);
  const transaction = pending?.get(cast.id);

  if (!pending || !transaction) return;

  pending.delete(cast.id);

  if (cast.cancelledBeforeCommit && transaction.phase === 'reserved') {
    const kind = mesmerResourceKind(runtime.profession.specialization.kind);

    if (kind !== 'clones') runtime.resourceController.grant(kind, Math.max(0, transaction.spent ?? 0));
  }

  if (pending.size === 0) transactions.delete(runtime.profession.core);
}

/** Register the transaction as a whole so Core and elite hooks never coordinate its private state. */
export const mesmerShatterLifecycle = {
  onCastStart: beginShatter,
  onCastCommit: retireShatter,
  onCastCancel: retireShatter,
  tasks: {
    [SHATTER_SPEND](runtime, data) {
      const id = String(data);
      const transaction = transactions.get(runtime.profession.core)?.get(id);

      if (transaction) commitReservation(runtime, id, transaction);
    }
  },
  sideEffectHandlers: {
    'mesmer.shatter'(runtime, context) {
      if (context.kind === 'cast') resolveShatter(runtime, context.cast);
    }
  }
} satisfies RuntimeHooks<MesmerRuntimeState, MesmerSkill>;
