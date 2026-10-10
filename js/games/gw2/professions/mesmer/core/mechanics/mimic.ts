import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { requireBalanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/mesmer/core/profiles.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { gw2BaseRecharge } from '#gw2/platform/combat/recharge.js';

/** Successful completion claims the current grant against the utility's start, including exact expiry. */
export function completeMimicCast(context: MesmerRuntime, cast: RuntimeCast<MesmerSkill>): void {
  const skill = cast.skill;
  if (cast.cancelled) return;

  const at = canonicalTime(context.time);
  const core = professionCoreState(context);
  if (
    skill.id === ID.MIMIC ||
    skill.type !== 'Utility' ||
    skill.flipParentId ||
    !consumeCharge(core.mimic, cast.start, 0, true)
  ) {
    return;
  }

  // Replace the utility's recharge with one base second without replenishing spent ammunition.
  context.cooldownController.replaceSkillRecharge(skill, 1, at);

  // Add the utility's original recharge to Mimic while preserving work already earned on its base cooldown.
  const mimic = context.helpers.skillsById.get(ID.MIMIC)!;
  const progress = context.cooldownController.rechargeFor(ID.MIMIC);
  const remaining = progress ? context.cooldownController.remaining(mimic, progress, at) : 0;
  context.cooldownController.startRecharge(mimic, at, remaining + gw2BaseRecharge(skill));
  context.effects.emit({
    kind: 'announcement',
    log: true,
    attribution: { source: 'Mimic', sourceId: ID.MIMIC, skillId: ID.MIMIC, skillName: 'Mimic', actorType: 'player' },
    announcement: { type: 'skill', at, name: 'Mimic' }
  });
}

/** Mimic owns arming; the shared observer only consumes later eligible utilities. */
export function armMimic(context: MesmerRuntime): void {
  const profile = requireBalanceProfileFromContext(context, PROFILE.mimic);
  const expiresAt = canonicalTime(context.time + balanceProfileNumber(profile, 'durationMultiplier'));
  // Keep the grant after expiry: an in-flight utility can still claim it using its earlier start.
  professionCoreState(context).mimic = grantCharges(expiresAt > 0 ? 1 : 0, expiresAt);
}
