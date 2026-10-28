import type { CooldownController } from '#gw2/platform/execution/cooldown-contracts.js';
import { armSkillFlip, consumeSkillFlip, type SkillFlipWindows } from '#gw2/platform/execution/skill-flips.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';

/**
 * A prepared magazine is a charge pool that exists only while one of its faces is on the bar. Mantras use it:
 * preparation opens a face over a fresh pool, and the final charge closes every face and discards the pool. Keeping
 * the open/close operations and the capacity gate together stops a closed magazine from holding stale or phantom
 * charges, whichever profession owns its recharge and face-selection rules.
 */
export interface PreparedMagazine<TSkill extends Skill = Skill> {
  /** The skill whose ammo pool holds the prepared charges. */
  readonly pool: TSkill;
  /**
   * Every bar face that spends or displays those charges, including the pool's own face. Other faces share the pool as
   * linked identities, so whichever face is on the bar reports the charges and the next charge's timer.
   */
  readonly faceIds: readonly SkillId[];
}

/** Retiring every face drops linked identities with the pool; the owner's own recharge decides what follows. */
function retireMagazine(cooldowns: Pick<CooldownController, 'retireAmmo'>, magazine: PreparedMagazine): void {
  cooldowns.retireAmmo(magazine.pool.id);
  for (const id of magazine.faceIds) if (id !== magazine.pool.id) cooldowns.retireAmmo(id);
}

/** While any face is open the magazine is prepared, so its preparing parent stays unavailable. */
export function preparedMagazineOpen(
  flips: Readonly<SkillFlipWindows>,
  magazine: Pick<PreparedMagazine, 'faceIds'>
): boolean {
  return magazine.faceIds.some((id) => flips[id] !== undefined);
}

/** Readiness checks create pools on demand, so a closed magazine reports no capacity and no pool appears. */
export function preparedMagazineMaximum(
  flips: Readonly<SkillFlipWindows>,
  magazine: Pick<PreparedMagazine, 'faceIds'>,
  maximum: number
): number {
  return preparedMagazineOpen(flips, magazine) ? maximum : 0;
}

/** Opens one face over a full pool, discarding spent charges, queued recharge, and cast lockout. */
export function openPreparedMagazine(
  flips: SkillFlipWindows,
  cooldowns: Pick<CooldownController, 'retireAmmo' | 'ensureAmmo' | 'linkAmmo'>,
  magazine: PreparedMagazine,
  faceId: SkillId,
  at: number
): void {
  for (const id of magazine.faceIds) if (id !== faceId) consumeSkillFlip(flips, id);

  // The face opens before the pool is created because the capacity gate reports no pool while every face is closed.
  armSkillFlip(flips, faceId, at);
  retireMagazine(cooldowns, magazine);
  cooldowns.ensureAmmo(magazine.pool);
  for (const id of magazine.faceIds) if (id !== magazine.pool.id) cooldowns.linkAmmo(magazine.pool.id, id);
}

/** Spending the final charge closes every face and discards the pool with its deadline. */
export function closePreparedMagazine(
  flips: SkillFlipWindows,
  cooldowns: Pick<CooldownController, 'retireAmmo'>,
  magazine: PreparedMagazine
): void {
  for (const id of magazine.faceIds) consumeSkillFlip(flips, id);

  retireMagazine(cooldowns, magazine);
}
