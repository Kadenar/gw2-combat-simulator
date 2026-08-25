import { materializeSkillEffectApplications } from '../../../platform/engine/effects/materializer.js';
import { gw2ActorTypeForSource } from '../../../platform/gw2/combat/state/event-ownership.js';

import type {
  ConditionEffect,
  SimulationEvent,
  SimulationEventInput,
  Skill,
  StrikeEffect
} from '../../../platform/engine/types.js';
import type { MesmerAddCondition, MesmerAddDamage, MesmerAddEvent, MesmerAddTraitProc } from '../types.js';

interface MesmerEventMaterializerOptions {
  readonly emit: (event: SimulationEventInput) => SimulationEvent | null;
  readonly activePrimaryWeapon: () => string;
  readonly weaponStrength: Readonly<Record<string, number>>;
}

function conditionName(value: unknown): string {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'poison' || normalized === 'poisoned') return 'Poisoned';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/**
 * Adapts Mesmer-owned source and illusion metadata around the shared canonical
 * effect materializer. Packet expansion remains profession-neutral.
 */
export function createMesmerEventMaterializer({
  emit,
  activePrimaryWeapon,
  weaponStrength
}: MesmerEventMaterializerOptions): Readonly<{
  addEvent: MesmerAddEvent;
  addTraitProc: MesmerAddTraitProc;
  addCondition: MesmerAddCondition;
  addDamage: MesmerAddDamage;
}> {
  const addEvent: MesmerAddEvent = (event) =>
    emit({
      ...event,
      source: String(event.source || 'Mesmer'),
      sourceId: event.sourceId ?? event.skillId ?? event.skillName ?? event.name ?? event.type
    } as SimulationEventInput);

  const addTraitProc: MesmerAddTraitProc = (name, at, sourceSkill = '', detail = '') =>
    addEvent({
      type: 'proc',
      procType: 'trait',
      at,
      name,
      sourceSkill,
      source: 'Trait',
      sourceId: name,
      detail
    });

  const addCondition: MesmerAddCondition = (skillName, at, condition, source = 'Player', label = '', extra = {}) => {
    const name = conditionName(condition.name);
    if (!condition.duration) return [];
    const eventSource = String(extra.source || source);
    const sourceId = extra.sourceId ?? skillName;
    const actorType = extra.actorType || gw2ActorTypeForSource(eventSource);
    const pseudoSkill: Skill = {
      id: extra.skillId ?? skillName,
      name: skillName
    };
    const ticks = Array.isArray(condition.ticks)
      ? condition.ticks.map((tick) => ({
          ...tick,
          condition: conditionName(tick.condition)
        }))
      : undefined;
    const effect: ConditionEffect = ticks?.length
      ? {
          type: 'condition',
          name: label || `${skillName} — ${name}`,
          ticks,
          timingAnchor: condition.timingAnchor || 'castStart',
          timingScale: condition.timingScale || 'fixed'
        }
      : {
          type: 'condition',
          name: label || `${skillName} — ${name}`,
          condition: name,
          duration: Number(condition.duration),
          stacks: Number(condition.stacks || 1),
          applications: condition.applications,
          atMs: condition.atMs,
          intervalMs: condition.intervalMs,
          timingAnchor: condition.timingAnchor,
          timingScale: condition.timingScale
        };
    const applications = materializeSkillEffectApplications({
      skill: pseudoSkill,
      effect,
      start: at,
      fullEnd: at,
      baseEvent: {
        source: eventSource,
        sourceId,
        actorType,
        skillId: extra.skillId ?? null,
        skillName
      }
    });
    return applications.flatMap((application) => {
      const emitted = emit({
        ...application.event,
        // Preserve the existing public Mesmer event contract while packet
        // expansion moves to the canonical engine representation.
        applicationIndex: undefined,
        totalApplications: undefined,
        ...extra,
        source: eventSource,
        sourceId
      });
      return emitted ? [emitted] : [];
    });
  };

  const addDamage: MesmerAddDamage = (skill, at, group, extra = {}) => {
    const source = String(group.source || extra.source || 'Player');
    const sourceId = extra.sourceId ?? skill.id ?? skill.name;
    const actorType = group.actorType || extra.actorType || gw2ActorTypeForSource(source);
    const hasExplicitTiming =
      group.atMs != null || group.intervalMs != null || (Array.isArray(group.ticks) && group.ticks.length > 0);
    const effect: StrikeEffect = {
      ...group,
      type: 'strike',
      name: String(extra.name || skill.name),
      // Mesmer's historical `weapon` value selects an illusion strength
      // profile; the cast skill still owns the canonical skillWeapon field.
      weapon: undefined,
      ...(hasExplicitTiming && group.timingAnchor == null ? { timingAnchor: 'castStart' as const } : {}),
      ...(hasExplicitTiming && group.timingScale == null ? { timingScale: 'fixed' as const } : {})
    };
    const slotSkill = ['Heal', 'Utility', 'Elite'].includes(String(skill.type || ''));
    const applications = materializeSkillEffectApplications({
      skill,
      effect,
      start: at,
      fullEnd: at,
      baseEvent: {
        source,
        sourceId,
        actorType,
        skillId: extra.skillId ?? skill.id ?? null,
        skillName: skill.name,
        // Preserve a committed packet's interrupt lifetime through Mesmer's custom materializer.
        ...(group.persistsAfterInterrupt === true ? { persistsAfterInterrupt: true } : {})
      },
      skillWeaponFallback: slotSkill ? 'Utility' : activePrimaryWeapon()
    });
    const individuallyTimed = Array.isArray(group.ticks) || Number(group.intervalMs || 0) > 0;
    return applications.flatMap((application) => {
      const explicit = String(group.weapon || '');
      const normalized = explicit.charAt(0).toUpperCase() + explicit.slice(1).toLowerCase();
      const independentStrength =
        actorType === 'phantasm' || actorType === 'summon' ? weaponStrength[normalized] : undefined;
      const emitted = emit({
        ...application.event,
        // Timed Mesmer packets were individually materialized before this
        // consolidation. Keep their stable public identity fields.
        hitIndex: individuallyTimed ? 1 : application.event.hitIndex,
        totalHits: individuallyTimed ? 1 : application.event.totalHits,
        weapon: group.weapon || '',
        canCrit: group.canCrit,
        ...extra,
        source,
        sourceId,
        blade: Boolean(extra.blade ?? skill.blade),
        weaponStrength: application.event.weaponStrength ?? independentStrength
      });
      return emitted ? [emitted] : [];
    });
  };

  return Object.freeze({ addEvent, addTraitProc, addCondition, addDamage });
}
