import { criticalProcHandler } from '#gw2/platform/profession-definition/critical-proc-handler.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { applyActiveVenoms } from '#gw2/professions/thief/core/mechanics/venoms.js';
import {
  applyUnrelentingStrikes,
  noQuarterCriticalReaction
} from '#gw2/professions/thief/core/traits/critical-strikes/critical-boons.js';
import { applyDeadlyAmbition, applyPanicStrike } from '#gw2/professions/thief/core/traits/deadly-arts/poison.js';
import { applyLeechingVenoms } from '#gw2/professions/thief/core/traits/shadow-arts/leeching-venoms.js';

const noQuarter = criticalProcHandler(noQuarterCriticalReaction);

/** Landed strikes drive critical Fury traits, Deadly Arts, venoms, and Shadow Arts siphons in their established order. */
export function reactThiefCoreDamage(
  runtime: ThiefRuntime,
  event: Gw2ResolverEvent,
  details: Record<string, unknown>
): void {
  const context = runtime;
  const resolved = details as unknown as NativeResolvedDamageDetails;
  applyUnrelentingStrikes(context, event, resolved);
  noQuarter(context, event, resolved);
  // Returned projectile damage keeps its original skill label while the dual-wield recall owns this trait proc.
  const recallId = event.metadata?.recallSkillId;
  applyDeadlyAmbition(
    context,
    recallId == null ? event : { ...event, skillId: Number(recallId), sourceId: Number(recallId) }
  );
  // Multiple venom types consume their charges but share one siphon per player strike.
  if (applyActiveVenoms(context, event) > 0) applyLeechingVenoms(context, event);
  applyPanicStrike(context, event);
}
