import { gw2BaseRecharge } from '#gw2/platform/combat/recharge.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import {
  closePreparedMagazine,
  openPreparedMagazine,
  type PreparedMagazine
} from '#gw2/platform/execution/prepared-magazines.js';
import { mesmerRechargeWork } from '#gw2/professions/mesmer/core/mechanics/recharge.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Keep the parent's authored window while the shared runtime owns identity-safe expiry. */
export function armMesmerSkillFlip(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const arm = cast.skill.flipArm!;
  const at = context.time;
  const start = arm.anchor === 'castCommit' ? at : cast.start;
  const availableAt = canonicalTime(start + (arm.delay ?? 0));
  const expiresAt = canonicalTime(start + arm.duration);

  if (expiresAt <= canonicalTime(at)) return;

  context.armFlip(arm.skillId, {
    availableAt,
    expiresAt,
    visibleAt: Math.min(at, availableAt),
    identity: cast.id,
    expiryPriority: 50
  });
}

/** A Mesmer mantra's prepared flip owns its charges and is the magazine's only face. */
export function mesmerMantraMagazine(flip: MesmerSkill): PreparedMagazine<MesmerSkill> {
  return { pool: flip, faceIds: [flip.id] };
}

/** A prepared mantra replaces the entire pool, including old recharge and independent lockout. */
export function prepareMesmerMantra(context: MesmerRuntime, flipId: number): void {
  const flip = context.helpers.skillsById.get(flipId)!;
  openPreparedMagazine(
    context.profession.core.availableFlips,
    context.cooldownController,
    mesmerMantraMagazine(flip),
    flipId,
    context.time
  );
}

/** Exhausting the final mantra charge closes its flip and discards the spent pool atomically. */
export function exhaustMesmerMantra(context: MesmerRuntime, skill: MesmerSkill): void {
  if ((context.cooldownController.readAmmo(skill.id)?.charges ?? 0) > 0) return;

  closePreparedMagazine(
    context.profession.core.availableFlips,
    context.cooldownController,
    mesmerMantraMagazine(skill)
  );
}

/** Add trait-adjusted base work to the parent's remaining recharge instead of restarting it. */
export function extendMesmerParentRecharge(context: MesmerRuntime, skill: MesmerSkill): void {
  const at = context.time;
  const parent = context.helpers.skillsById.get(skill.flipParentId!);
  const readyAt = parent ? context.cooldownController.readyAt(parent.id) : null;

  if (!parent || readyAt == null) return;

  const progress = context.cooldownController.rechargeFor(parent.id);
  const work = progress
    ? context.cooldownController.remaining(parent, progress, at)
    : Math.max(0, readyAt - at) * context.cooldownController.rate(parent);
  context.cooldownController.startRecharge(
    parent,
    at,
    work + mesmerRechargeWork(context, parent, gw2BaseRecharge(parent)) * skill.parentCooldownIncrease!
  );
}
