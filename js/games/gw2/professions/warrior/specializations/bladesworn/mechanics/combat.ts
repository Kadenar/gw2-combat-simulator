import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { warriorAmmunition } from '#gw2/professions/warrior/core/mechanics/ammunition.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { cartridgeExplosion } from '#gw2/professions/warrior/specializations/bladesworn/skills/index.js';
import type { WarriorRuntime, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Completed ammunition rewards use the spend captured before the magazine transaction. */
export const ammunitionCommitted = defineTriggerPoint<{
  readonly cast: RuntimeCast<WarriorSkill>;
  readonly spent: { readonly rounds: number; readonly startedFull: boolean };
}>('warrior.ammunition-committed', [TRAIT.FIERCE_AS_FIRE, TRAIT.LUSH_FOREST]);

/** Explosion Glory extends before cartridge effects inspect the accepted strike. */
export const explosionAccepted = defineTriggerPoint<{ readonly event: Gw2ResolverEvent }>(
  'warrior.explosion-accepted',
  [TRAIT.GUNS_AND_GLORY]
);

/** Capture the magazine before the cast spends its ammunition so completion sees the accepted balance. */
export function prepareBladeswornAmmunition(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  if (cast.ammo) {
    const ammo = runtime.cooldownController.readAmmo(cast.skill.id)!;
    warriorAmmunition.set(cast, { rounds: 1, startedFull: ammo.charges >= ammo.maximum });
  }
}

/** Completed ammunition casts publish their captured spend before Dragon Slash and bar completion work. */
export function completeBladeswornAmmunition(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  // Successful ammunition commitment earns its reward even when the remaining animation is interrupted.
  const spent = warriorAmmunition.get(cast);

  if (spent) runtime.fireTrigger(ammunitionCommitted, { cast, spent });
}

/** Only actual player explosions extend Glory or create cartridge Burning; neither derived condition can recurse. */
export function reactToBladeswornExplosion(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || event.damageKind !== 'explosion' || !(Number(event.coefficient) > 0)) return;

  runtime.fireTrigger(explosionAccepted, { event });

  cartridgeExplosion(runtime, event);
}
