import { ACTOR } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { composeRuntimeHooks, type RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { coreAdrenalinePolicy } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { warriorAmmunition } from '#gw2/professions/warrior/core/mechanics/ammunition.js';
import {
  bladeswornBuffPolicies,
  bladeswornEffectStates
} from '#gw2/professions/warrior/specializations/bladesworn/effect-state.js';
import { gunsaberDragonTriggerLifecycle } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';
import { bladeswornFlowLifecycle } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/flow.js';
import {
  ammunitionCommitted,
  explosionAccepted
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/trigger-points.js';
import {
  bladeswornSkillLifecycle,
  cartridgeExplosion
} from '#gw2/professions/warrior/specializations/bladesworn/skills/index.js';
import type { WarriorRuntime, WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Capture the magazine before the cast spends its ammunition so completion sees the accepted balance. */
function prepareBladeswornAmmunition(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  if (cast.usesAmmo) {
    const ammo = runtime.cooldownController.readAmmo(cast.skill.id)!;
    warriorAmmunition.set(cast, { rounds: 1, startedFull: ammo.charges >= ammo.maximum });
  }
}

/** Completed ammunition casts publish their captured spend before Dragon Slash and bar completion work. */
function completeBladeswornAmmunition(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  // Successful ammunition commitment earns its reward even when the remaining animation is interrupted.
  const spent = warriorAmmunition.get(cast);

  if (spent) runtime.fireTrigger(ammunitionCommitted, { cast, spent });
}

/** Only actual player explosions extend Glory or create cartridge Burning; neither derived condition can recurse. */
function reactToBladeswornExplosion(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== ACTOR.PLAYER || event.damageKind !== 'explosion' || !(Number(event.coefficient) > 0)) return;

  runtime.fireTrigger(explosionAccepted, { event });

  cartridgeExplosion(runtime, event);
}

/** Native declarations own actual resources, bar transitions, completed ammunition rewards, and accepted explosions. */
export const bladeswornHooks: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = composeRuntimeHooks([
  // Capture ammunition before mode exit; publish its rewards before Slash release observers and chain cleanup.
  { onCastStart: prepareBladeswornAmmunition, onCastCommit: completeBladeswornAmmunition },
  gunsaberDragonTriggerLifecycle,
  bladeswornSkillLifecycle,
  bladeswornFlowLifecycle,
  {
    // Bladesworn disables adrenaline at initialization; authored rewards select the Flow pool its lifecycle registers.
    resources: { adrenaline: { ...coreAdrenalinePolicy, maximum: () => 0 } },
    buffPolicies: (runtime) => bladeswornBuffPolicies(runtime.helpers),
    observeEffects: bladeswornEffectStates,
    reactions: { 'damage.resolved': reactToBladeswornExplosion }
  }
]);
