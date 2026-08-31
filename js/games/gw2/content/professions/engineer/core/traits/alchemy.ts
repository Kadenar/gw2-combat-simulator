/** Owns HGH's elixir cast effects and scheduled-event duration extension. */
import { emitSkillBuff, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/engineer/data/ids.js';
import type { SimulationEvent } from '#gw2/platform/engine/types.js';
import type {
  EngineerCastContext,
  EngineerSchedulerContext,
  EngineerSkill
} from '#gw2/content/professions/engineer/types.js';

function isElixirSkill(skill: EngineerSkill | undefined): boolean {
  return Boolean(skill?.categories?.some((category) => String(category).toLowerCase() === 'elixir'));
}

/** Applies HGH cast boons and Acid Bomb's extended final pulse to eligible elixirs. */
export function applyHgh(context: EngineerCastContext, skill: EngineerSkill, at: number): void {
  if (
    !hasTrait(context.config, TRAIT.HGH) ||
    !isElixirSkill(skill) ||
    context.effectiveEnd < context.fullEnd - context.epsilon
  )
    return;

  // HGH grants fixed-duration boons and extends Acid Bomb far enough for one additional pulse.
  emitSkillBuff(context, skill, {
    at,
    source: 'Trait',
    sourceId: TRAIT.HGH,
    actorType: 'player',
    name: 'HGH — might',
    kind: 'might',
    duration: 12,
    stacks: 2
  });
  emitSkillBuff(context, skill, {
    at,
    source: 'Trait',
    sourceId: TRAIT.HGH,
    actorType: 'player',
    name: 'HGH — fury',
    kind: 'fury',
    duration: 4,
    stacks: 1
  });
  if (skill.id === ID.ACID_BOMB) {
    emitSkillDamage(context, skill, {
      at: context.fullEnd + 6,
      activationId: context.action.activationId,
      coefficient: 0.85,
      hits: 1,
      name: 'Acid Bomb',
      actorType: 'player'
    });
  }
}

/** Extends scheduled elixir fields, boons, and conditions while HGH is selected. */
export function observeEngineerHghEvent(context: EngineerSchedulerContext, event: SimulationEvent): void {
  if (!hasTrait(context.config, TRAIT.HGH) || event.sourceId === TRAIT.HGH) return;
  const skill = context.catalog.skillsById.get(event.skillId ?? event.sourceId) as EngineerSkill | undefined;
  if (!isElixirSkill(skill)) return;

  if (event.type === 'combo_field') {
    const duration = Number(event.expiresAt) - event.at;
    if (duration > 0) context.replaceEvent(event, { expiresAt: event.at + duration * 1.2 });
  } else if ((event.type === 'buff' || event.type === 'condition') && Number(event.duration) > 0) {
    context.replaceEvent(event, { duration: Number(event.duration) * 1.2 });
  }
}
