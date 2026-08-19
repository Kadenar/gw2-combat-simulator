import { augmentSkill, replaceSkill } from '../../../platform/gw2/native-profession.js';
import { MESMER_CORE_WEAPON_STRENGTH } from './mechanics.js';
import type { SimulationEvent, Skill, SkillEffect, SkillHandlerStrategy } from '../../../platform/engine/types.js';
import type { MesmerHandlerContext } from '../types.js';

function conditionName(value: unknown): string {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'poison' || normalized === 'poisoned') return 'Poisoned';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function legacyWeaponStrength(effect: SkillEffect, skill: Skill): number | undefined {
  if (effect.weaponStrength != null) return Number(effect.weaponStrength);
  const explicit = String(effect.weapon || '');
  const normalized = explicit.charAt(0).toUpperCase() + explicit.slice(1).toLowerCase();
  return MESMER_CORE_WEAPON_STRENGTH[normalized] ?? MESMER_CORE_WEAPON_STRENGTH[String(skill.weapon || '')];
}

function observeDeclarativeEffect(
  context: MesmerHandlerContext,
  skill: Skill,
  event: SimulationEvent,
  _state: unknown,
  { effect }: { readonly effect: SkillEffect }
): void {
  if (!event) return;
  if (event.type === 'damage') {
    const individuallyTimed =
      Array.isArray(effect.ticks) || Number(effect.intervalMs || 0) > 0 || Number(skill.pulseCount || 0) > 1;
    context.replaceEvent(event, {
      source: effect.actorType === 'phantasm' ? 'Phantasm' : 'Player',
      blade: Boolean(skill.blade),
      canCrit: undefined,
      name: skill.name,
      totalHits: individuallyTimed ? 1 : event.totalHits,
      weapon: effect.weapon || '',
      weaponStrength:
        effect.weaponStrength != null || effect.actorType === 'phantasm'
          ? legacyWeaponStrength(effect, skill)
          : undefined,
      skillWeapon:
        skill.weapon ||
        (['Heal', 'Utility', 'Elite'].includes(String(skill.type || ''))
          ? 'Utility'
          : context.mesmerRuntime.activePrimaryWeapon())
    });
    return;
  }

  if (event.type === 'condition') {
    const condition = conditionName(event.condition);
    context.replaceEvent(event, {
      source: 'Player',
      sourceId: skill.name,
      skillId: null,
      condition,
      name: `${skill.name} — ${condition}`,
      applicationIndex: undefined,
      totalApplications: undefined
    });
  }
}

export const mesmerReplaceProfile = replaceSkill<MesmerHandlerContext>({ beforeEffects: () => null });

export const mesmerCoreSkillHandlers: Readonly<Record<string, Readonly<SkillHandlerStrategy<MesmerHandlerContext>>>> =
  Object.freeze({
    'mesmer.declarative': augmentSkill<MesmerHandlerContext>({
      beforeEffects: () => null,
      afterEffect: observeDeclarativeEffect
    }),
    'mesmer.weapon-swap': mesmerReplaceProfile,
    'mesmer.shatter': mesmerReplaceProfile,
    'mesmer.phantasm': mesmerReplaceProfile,
    'mesmer.resource-skill': mesmerReplaceProfile,
    'mesmer.flip': mesmerReplaceProfile,
    'mesmer.tracked-hits': mesmerReplaceProfile,
    'mesmer.special-profile': mesmerReplaceProfile
  });
