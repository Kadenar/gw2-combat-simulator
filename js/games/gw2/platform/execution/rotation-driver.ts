import { RotationCursor } from '#gw2/platform/execution/rotation-cursor.js';
import {
  createSkillSelectionContext,
  type TraitSelectionContext
} from '#gw2/platform/profession-definition/runtime-context.js';
import { normalizeRotation } from '#gw2/platform/execution/rotation.js';
import type { RuntimeDriver } from '#gw2/platform/execution/driver-contract.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { GW2_ACTION_TICK_MS, gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';

/** Rotation commands enter through equipment, resource, and timing gates at each live boundary. */
export function createRotationDriver<T extends object>(
  profession: RuntimeProfession<T>,
  rotation: readonly unknown[]
): RuntimeDriver<T> {
  const cursor = new RotationCursor(normalizeRotation(rotation, profession.catalog, { strict: true }));
  // One driver belongs to one execution; bind selected trait queries on its first live boundary.
  let selectionContext: TraitSelectionContext | undefined;
  return {
    cursor,
    advance({ runtime, evaluateReadiness, resetCooldowns, advanceFrontier, acceptCast, reject }) {
      selectionContext ??= createSkillSelectionContext(runtime.traits);
      const command = cursor.command;
      let nextCommandAt = Infinity;
      if (command) {
        // Reevaluate transformed actions after every actual boundary, before accepting their reservation.
        let skill =
          command.type === 'cast'
            ? profession.catalog.skillsById.get(
                profession.modifySkillId?.(selectionContext, command.skillId) ?? command.skillId
              )
            : undefined;
        if (skill) skill = profession.resolveCastSkill?.(runtime.mechanicQueries, skill) ?? skill;
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
        // Every cast enters on an absolute action tick, even after an off-grid wait, overlap, or resource wake.
        if (command.type === 'cast') nextCommandAt = gw2CooldownReadyAt(nextCommandAt);
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
            resetCooldowns();
            profession.onCooldownReset?.(runtime.mechanics);
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
          const availability = evaluateReadiness(skill, command);
          if (!availability.ready) {
            if (availability.retryAt == null) {
              reject(availability.reason);
              return 'handled';
            }

            if (!Number.isFinite(availability.retryAt) || availability.retryAt <= runtime.time) {
              reject(`${availability.reason} (no future retry boundary).`);
              return 'handled';
            }

            // GW2 retries wait for an absolute action tick, including deadlines less than a microsecond after a tick.
            const tickAt = gw2CooldownReadyAt(availability.retryAt);
            nextCommandAt = tickAt < availability.retryAt ? canonicalTime(tickAt + GW2_ACTION_TICK_MS / 1000) : tickAt;
          } else {
            acceptCast(skill, command);
            return 'handled';
          }
        }
      }

      return nextCommandAt;
    }
  };
}
