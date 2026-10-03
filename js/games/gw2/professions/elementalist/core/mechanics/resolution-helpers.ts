import { resolverSourceSkill, buildResolverCondition, buildResolverBuff } from '#gw2/platform/resolver/packets.js';
/** Shared resolver-side state, attribution, boon, and condition helpers for Elementalist behavior. */
import { isTimeInWindow } from '#kernel/core/clock.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';

// Apply derived conditions immediately so same-timestamp reactions observe the canonical resolver state.
export function applyElementalistDerivedCondition(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  {
    source,
    sourceId = event.skillId ?? event.sourceId,
    condition,
    stacks,
    duration,
    procCount
  }: {
    readonly source: string;
    readonly sourceId?: SkillId;
    readonly condition: string;
    readonly stacks: number;
    readonly duration: number;
    readonly procCount?: number;
  }
): void {
  const application = buildResolverCondition({
    at: event.at,
    source,
    sourceId,
    actorType: 'player',
    skillName: source,

    condition,
    stacks,
    duration,
    triggeredBy: resolverSourceSkill(event),
    ...(procCount == null ? {} : { metadata: { procCount } })
  });
  context.applyCondition(application);
}

/** Trait grants retain the granting trait's identity separately from the attack or aura that triggered them. */
export function queueElementalistBuff(
  context: Gw2ResolverRuntime,
  event: Gw2ResolverEvent,
  kind: string,
  stacks: number,
  duration: number,
  traitId: SkillId
): void {
  const profile = requireBalanceProfileFromContext(context, traitId);
  // The shared buff handler records the application when it actually resolves.
  queueResolverBoon(
    context,
    event,
    buildResolverBuff({
      at: event.at,
      source: 'Trait',
      sourceId: traitId,
      actorType: 'player',
      skillName: profile.name,

      kind: kind.toLowerCase(),
      stacks,
      duration,
      triggeredBy: resolverSourceSkill(event),
      ...(Number(event.priority || 0) ? { priority: Number(event.priority) } : {})
    })
  );
}

/** Returns active resolver-side applications of one boon kind at a timestamp. */
export function activeElementalistBuffs(context: Gw2ResolverRuntime, kind: string, at: number) {
  return (context.boons.get(kind.toLowerCase()) || []).filter((application) =>
    isTimeInWindow(at, application.at, application.expiresAt)
  );
}

/** Rewrites active applications of a boon kind while preserving inactive applications. */
export function refreshElementalistBuffs(
  context: Gw2ResolverRuntime,
  kind: string,
  at: number,
  expiresAt: (currentExpiresAt: number) => number
): void {
  const normalized = kind.toLowerCase();
  const applications = context.boons.get(normalized) || [];
  const active = new Set(activeElementalistBuffs(context, normalized, at));
  context.boons.set(
    normalized,
    applications.map((application) =>
      active.has(application)
        ? {
            ...application,
            expiresAt: expiresAt(application.expiresAt)
          }
        : application
    )
  );
}

/** Records a trait proc attributed to the skill whose event triggered it. */
export function recordElementalistTraitProc(context: Gw2ResolverRuntime, event: Gw2ResolverEvent, name: string): void {
  context.recordProc('trait', name, event.at, resolverSourceSkill(event));
}
