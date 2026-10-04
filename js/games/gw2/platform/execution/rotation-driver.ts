import { isGw2WeaponSkillEquipped } from '#gw2/platform/equipment/weapons/skill-matcher.js';
import { RotationCursor } from '#gw2/platform/execution/rotation-cursor.js';
import { normalizeRotation } from '#gw2/platform/execution/rotation.js';
import { autoattackChainAvailability } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
import type { RuntimeDriver } from '#gw2/platform/simulation/execution.js';
import type { RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Rotation commands enter through equipment, resource, and timing gates at each live boundary. */
export function createRotationDriver<T extends object>(
  profession: RuntimeProfession<T>,
  rotation: readonly unknown[]
): RuntimeDriver<T> {
  const cursor = new RotationCursor(normalizeRotation(rotation, profession.catalog, { strict: true }));
  return {
    cursor,
    rotation,
    advance({ runtime, cooldowns, inFlightEnd, advanceFrontier, acceptCast, reject }) {
      const config = runtime.config;
      const command = cursor.command;
      let nextCommandAt = Infinity;
      if (command) {
        // Reevaluate transformed actions after every actual boundary, before accepting their reservation.
        const skill =
          command.type === 'cast'
            ? profession.catalog.skillsById.get(profession.modifySkillId?.(runtime, command.skillId) ?? command.skillId)
            : undefined;
        // A forbidden overlap is permanently invalid, so it cannot reserve a lane or wait for cooldown readiness.
        if (command.type === 'cast' && command.concurrentOffsetMs != null && skill?.canCastConcurrently === false) {
          advanceFrontier('command rejection');
          reject(`${skill.name} cannot be cast concurrently.`);
          return 'handled';
        }

        const requested = cursor.requestAt(runtime.time, skill);
        if (requested < runtime.time || (command.type === 'cast' && !skill)) {
          advanceFrontier('command rejection');
          reject(skill ? 'Concurrent command cannot backdate the clock.' : 'Unknown skill.');
          return 'handled';
        }

        nextCommandAt = Math.max(
          requested,
          command.type === 'cast' ? runtime.inputReadyAt : 0,
          skill && !skill.independentCast && Number(skill.castTimeMs) > 0 && !skill.stunbreak ? cursor.selfStunUntil : 0
        );
        if (nextCommandAt <= runtime.time) {
          advanceFrontier('command');
          if (command.type === 'wait') {
            const end = canonicalTime(runtime.time + command.durationMs / 1000);
            // Every authored command retains its timeline row, including waits and environment controls.
            if (runtime.reporting)
              runtime.steps.push({
                ri: cursor.index,
                skill: 'Wait',
                start: Math.round(runtime.time * 1000),
                end: Math.round(end * 1000)
              });
            cursor.acceptWait(end);
            return 'handled';
          }

          if (command.type === 'combat-start') {
            if (runtime.reporting)
              runtime.steps.push({
                ri: cursor.index,
                skill: 'Combat Start',
                start: Math.round(runtime.time * 1000),
                end: Math.round(runtime.time * 1000)
              });
            runtime.combatStartPending = false;
            runtime.combatStartTime = runtime.time;
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'combat_start',
                at: runtime.time,
                source: 'Runtime',
                sourceId: 'combat-start',
                actorType: 'environment'
              }
            });
            cursor.consume();
            return 'handled';
          }

          if (command.type === 'cooldown-reset') {
            if (runtime.reporting)
              runtime.steps.push({
                ri: cursor.index,
                skill: 'Cooldown Reset',
                start: Math.round(runtime.time * 1000),
                end: Math.round(runtime.time * 1000)
              });
            runtime.cooldowns.clear();
            runtime.rechargeProgress.clear();
            runtime.ammo.clear();
            runtime.lockouts.clear();
            profession.onCooldownReset?.(runtime);
            // Publish the accepted reset after its resource and recharge transitions.
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'marker',
                at: runtime.time,
                source: 'platform',
                sourceId: 'cooldown-reset',
                actorType: 'environment',
                action: 'cooldown-reset',
                name: 'Cooldown Reset'
              }
            });
            cursor.consume();
            return 'handled';
          }

          if (!skill) throw new Error('Cast has no skill.');
          if (
            !isGw2WeaponSkillEquipped(
              { config, weaponSet: runtime.activeWeaponSet, state: runtime, catalog: profession.catalog },
              skill,
              profession.weaponSkillMatchesSet
            )
          ) {
            reject(`${skill.name} is unavailable — its required weapon is not equipped.`);
            return 'handled';
          }

          // A wrong chain command is invalid now; waiting for recharge must not let its flip expire into validity.
          const chainAvailability = autoattackChainAvailability(runtime, profession.catalog, skill);
          if (!chainAvailability.ready) {
            reject(chainAvailability.reason);
            return 'handled';
          }

          cooldowns.refresh(runtime.time);
          const ammo = cooldowns.refreshAmmo(skill, runtime.time);
          nextCommandAt = Math.max(
            runtime.time,
            skill.usableWhileRecharging && !(ammo && ammo.charges <= 0)
              ? 0
              : gw2CooldownReadyAt(runtime.cooldowns.get(skill.id) ?? 0),
            ...[...(skill.independentCastCanOverlap ? [] : (runtime.inFlight.get(skill.id) ?? []))].map((id) =>
              inFlightEnd(id)
            ),
            ...(skill.lockouts ?? []).map((lockout) => runtime.lockouts.get(lockout.group) ?? 0)
          );
          // Cooldown, lane, and lockout waits settle first: intervening actual hits may change resource or form legality.
          if (nextCommandAt <= runtime.time) {
            const availability = profession.availability?.(runtime, skill, command) ?? { ready: true };
            if (!availability.ready && availability.retryAt == null) {
              reject(availability.reason);
              return 'handled';
            }

            if (!availability.ready) {
              if (!Number.isFinite(availability.retryAt) || canonicalTime(availability.retryAt) <= runtime.time) {
                reject(`${availability.reason} (no future retry boundary).`);
                return 'handled';
              }

              nextCommandAt = canonicalTime(availability.retryAt);
            } else {
              acceptCast(skill, command);
              return 'handled';
            }
          }
        }
      }

      return nextCommandAt;
    }
  };
}
