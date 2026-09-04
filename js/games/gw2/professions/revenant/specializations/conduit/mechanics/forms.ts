import { emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { conduitState, revenantConduitFormIsActive } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { strikeEffectCoefficient } from '#gw2/platform/engine/effects/timelines.js';
import type { SkillEffect } from '#gw2/platform/engine/skills/types.js';
import type { RevenantCastContext, RevenantSchedulerContext, RevenantSkill } from '#gw2/professions/revenant/types.js';

function strikeCoefficient(effect: SkillEffect | undefined): number {
  return effect?.type === 'strike' ? strikeEffectCoefficient(effect) : 0;
}

/** Emits Form of the Dervish's normal or elite triggered attack. */
export function emitDervishFormAttack(
  context: RevenantCastContext,
  skill: RevenantSkill,
  { elite = false }: { readonly elite?: boolean } = {}
): void {
  const state = conduitState.from(context);
  if (
    context.config.specialization !== 'Conduit' ||
    state.conduitForm !== 'Dervish' ||
    Number(state.cosmicWisdomUntil || 0) <= context.start
  )
    return;
  const skillId = elite ? ID.FORM_OF_THE_DERVISH_ATTACK_ELITE : ID.FORM_OF_THE_DERVISH_ATTACK;
  const attack =
    context.catalog.skillsById.get(skillId) ||
    ({ id: skillId, name: 'Form of the Dervish', type: 'Profession' } as RevenantSkill);
  emitSkillDamage(context, attack, {
    at: context.effectiveEnd,
    source: 'revenant',
    skillName: 'Form of the Dervish',
    name: elite ? 'Form of the Dervish (Attack - Elite)' : 'Form of the Dervish (Attack)',
    coefficient: strikeCoefficient(balanceProfileEffect(attack, 'strike')),
    skillWeapon: 'Unequipped',
    canCrit: null,
    triggeredBy: skill.name,
    icon: attack.icon || ''
  });
}

/** Emits Form of the Assassin's one-second or legend-skill dagger strike. */
export function emitLesserEnchantedDaggers(
  context: RevenantSchedulerContext,
  sourceSkill: RevenantSkill,
  at: number
): void {
  if (!revenantConduitFormIsActive(conduitState.from(context), 'Assassin', at)) return;
  const skill = context.catalog.skillsById.get(ID.LESSER_ENCHANTED_DAGGERS);
  if (!skill) return;
  emitSkillDamage(context, skill, {
    at,
    source: 'revenant',
    name: 'Lesser Enchanted Daggers',
    coefficient: strikeCoefficient(balanceProfileEffect(skill, 'strike')),
    skillWeapon: 'Unequipped',
    canCrit: null,
    triggeredBy: sourceSkill.name,
    icon: skill.icon || ''
  });
}

/** Applies the active Assassin or Dervish form after a legend skill cast. */
export function applyCosmicWisdomAfterCast(context: RevenantCastContext, skill: RevenantSkill): void {
  const at = context.effectiveEnd;
  if (skill.legendId === LEGEND.ASSASSIN && revenantConduitFormIsActive(conduitState.from(context), 'Assassin', at)) {
    emitLesserEnchantedDaggers(context, skill, at);
  }

  if (skill.legendId !== LEGEND.ENTITY || !revenantConduitFormIsActive(conduitState.from(context), 'Dervish', at))
    return;
  emitDervishFormAttack(context, skill);
  if (([ID.TWIN_MOON_SWEEP, ID.TWIN_MOON_SWEEP_ID_77001] as readonly number[]).includes(Number(skill.id))) {
    emitDervishFormAttack(context, skill, { elite: true });
  }
}
