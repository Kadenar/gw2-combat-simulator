/**
 * Owns Primordial Stance's scheduled pulses against the live Weaver attunement pair.
 * Skill packet templates remain in `skills/slot-skills.ts`.
 */
import { balanceProfileEffectFromContext, balanceProfileValue } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { ScheduledTask, SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { WEAVER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/weaver/profiles.js';
import { weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import type { ElementalistCastContext, ElementalistSchedulerContext } from '#gw2/professions/elementalist/types.js';

const PRIMORDIAL_STANCE_SKILL_IDS = new Set([
  ID.PRIMORDIAL_STANCE_FIRE,
  ID.PRIMORDIAL_STANCE_WATER,
  ID.PRIMORDIAL_STANCE_AIR,
  ID.PRIMORDIAL_STANCE_EARTH
]);

/** Replaces authored fixed pulses with tasks that inspect the live attunement pair. */
export function schedulePrimordialStance(context: ElementalistCastContext, skill: Skill): void {
  if (!PRIMORDIAL_STANCE_SKILL_IDS.has(Number(skill.id))) return;
  const tickTimes = new Set<number>();
  for (const event of context.events) {
    if (event.activationId !== context.reservationId) continue;
    if (event.type === 'condition') {
      if (event.at > context.effectiveEnd + context.epsilon) tickTimes.add(event.at);
      context.replaceEvent(event, {
        type: 'marker',
        cancelled: true,
        detail: 'replaced by dynamic Primordial Stance attunements'
      });
    } else if (event.type === 'damage') {
      context.replaceEvent(event, {
        type: 'marker',
        cancelled: true,
        detail: 'replaced by chronological Primordial Stance pulses'
      });
    }
  }

  for (const at of tickTimes) {
    context.tasks.schedule({
      type: 'elementalist.primordial-stance',
      at,
      ownerId: context.reservationId,
      payload: { sourceId: skill.id }
    });
  }
}

/** Resolves one Primordial Stance pulse against the attunements live at its timestamp. */
export function handlePrimordialStanceTick(
  context: ElementalistSchedulerContext,
  task: ScheduledTask<SchedulerRecord>
): void {
  const core = professionCoreState(context);
  const state = weaverState.from(context);
  const sourceId = (task.payload?.sourceId || 'primordial-stance') as Skill['id'];
  const attunements = state.secondaryAttunement
    ? [core.primaryAttunement, state.secondaryAttunement]
    : [core.primaryAttunement];
  const effects: Readonly<Record<string, readonly [string, number, number]>> = {
    Fire: ['Burning', 1, 2],
    Water: ['Chilled', 1, 1],
    Air: ['Vulnerability', 8, 3],
    Earth: ['Bleeding', 2, 6]
  };
  emitSkillDamage(context, {
    at: task.at,
    source: 'elementalist',
    sourceId,
    actorType: 'player',
    skillName: 'Primordial Stance',
    skillId: sourceId,
    coefficient: balanceProfileValue(
      balanceProfileEffectFromContext(context, PROFILE.primordialStance, 'strike'),
      'coefficient',
      0.33
    ),
    skillWeapon: 'Unequipped',
    damageKind: 'field-tick'
  });
  for (const attunement of attunements) {
    const [condition, stacks, duration] = effects[attunement];
    const effect = balanceProfileEffectFromContext(context, PROFILE.primordialStance, 'condition', 0, attunement);
    emitSkillCondition(context, {
      at: task.at,
      source: 'Primordial Stance',
      sourceId,
      actorType: 'player',
      skillName: 'Primordial Stance',
      condition: String(effect?.condition || condition),
      stacks: Number(effect?.stacks ?? stacks),
      duration: Number(effect?.duration ?? duration)
    });
  }
}
