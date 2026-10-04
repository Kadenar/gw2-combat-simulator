import { canonicalTime } from '#kernel/core/clock.js';
import { armSkillFlip, consumeSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import { gw2BaseRecharge } from '#gw2/platform/execution/recharge.js';
import { mesmerRechargeWork } from '#gw2/professions/mesmer/core/mechanics/recharge.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';

/** Arm the parent's exact authored window without extending a cast-start deadline. */
export function armMesmerSkillFlip(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const arm = cast.skill.flipArm!;
  const at = context.time;
  const start = arm.anchor === 'castCommit' ? at : cast.start;
  const availableAt = canonicalTime(start + (arm.delay ?? 0));
  const expiresAt = canonicalTime(start + arm.duration);
  if (expiresAt <= canonicalTime(at)) return;
  armSkillFlip(
    context.profession.core.availableFlips,
    arm.skillId,
    availableAt,
    expiresAt,
    Math.min(at, availableAt),
    cast.id
  );
  context.schedule('mesmer.flip-expire', expiresAt, { id: arm.skillId, identity: cast.id }, undefined, 50);
}

/** A prepared mantra replaces the entire pool, including old recharge and independent lockout. */
export function prepareMesmerMantra(context: MesmerRuntime, flipId: number): void {
  const flip = context.helpers.skillsById.get(flipId)!;
  armSkillFlip(context.profession.core.availableFlips, flipId, context.time);
  context.cooldownController.retireAmmo(flipId);
  context.cooldownController.clear(flipId);
  context.cooldownController.ensureAmmo(flip);
}

/** Exhausting the final mantra charge closes its flip and discards the spent pool atomically. */
export function exhaustMesmerMantra(context: MesmerRuntime, skill: MesmerSkill): void {
  if ((context.cooldownController.readAmmo(skill.id)?.charges ?? 0) > 0) return;
  consumeSkillFlip(context.profession.core.availableFlips, skill.id);
  context.cooldownController.retireAmmo(skill.id);
  context.cooldownController.clear(skill.id);
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
