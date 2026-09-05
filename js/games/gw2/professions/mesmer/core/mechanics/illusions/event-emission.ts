import { gw2ActorTypeForSource } from '#gw2/platform/combat/state/event-ownership.js';
import { canonicalTargetConditionName } from '#gw2/platform/combat/state/targets.js';
import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '#gw2/platform/scheduler/skill-events.js';

import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { SimulationActorType, SimulationEvent, SimulationEventInput } from '#gw2/platform/engine/events/types.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type {
  MesmerAddCondition,
  MesmerAddDamage,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerSchedulerContext
} from '#gw2/professions/mesmer/types.js';
import type { MesmerEventExtra, MesmerSummonKind } from '#gw2/professions/mesmer/data/types.js';

interface MesmerEventEmitterOptions {
  readonly context: MesmerSchedulerContext;
  readonly emit: (event: SimulationEventInput) => SimulationEvent | null;
  readonly activePrimaryWeapon: () => string;
  readonly weaponStrength: Readonly<Record<string, number>>;
}

/** Keeps display labels optional while making canonical actor and summon ownership authoritative. */
function ownership(source: string, explicitActor: unknown, explicitSummon: unknown) {
  const summonKind: MesmerSummonKind | undefined =
    explicitSummon === 'clone' || explicitSummon === 'phantasm'
      ? explicitSummon
      : source === 'Clone'
        ? 'clone'
        : source === 'Phantasm'
          ? 'phantasm'
          : undefined;
  return {
    actorType: (explicitActor || (summonKind ? 'summon' : gw2ActorTypeForSource(source))) as SimulationActorType,
    ...(summonKind ? { summonKind } : {})
  };
}

/** Removes authoring controls after they have been converted to standard helper arguments. */
function supplementalFields(source: SchedulerRecord, fields: readonly string[]): SchedulerRecord {
  const result = { ...source };
  for (const field of fields) delete result[field];
  return result;
}

/** Adapts Mesmer's existing controller call signatures to the platform's canonical procedural emitters. */
export function createMesmerEventEmitters({
  context,
  emit,
  activePrimaryWeapon,
  weaponStrength
}: MesmerEventEmitterOptions): Readonly<{
  addEvent: MesmerAddEvent;
  addTraitProc: MesmerAddTraitProc;
  addCondition: MesmerAddCondition;
  addDamage: MesmerAddDamage;
}> {
  const emissionContext = Object.assign(Object.create(context) as MesmerSchedulerContext, { emit });
  const addEvent: MesmerAddEvent = (event) => {
    const source = String(event.source || context.profession.id);
    const sourceId = event.sourceId ?? event.skillId ?? event.skillName ?? event.name ?? event.type;
    const canonical = { ...event, source, sourceId };
    if (event.type === 'buff') return emitSkillBuff(emissionContext, canonical as never);
    if (event.type === 'control') return emitSkillControl(emissionContext, canonical as never);
    return emit(canonical as SimulationEventInput);
  };

  const addTraitProc: MesmerAddTraitProc = (name, at, sourceSkill = '', detail = '') =>
    addEvent({
      type: 'proc',
      procType: 'trait',
      at,
      name,
      sourceSkill,
      source: 'Trait',
      sourceId: name,
      actorType: 'effect',
      detail
    });

  const skillForCondition = (skillName: string, extra: MesmerEventExtra): Skill =>
    context.catalog.skillsById.get(extra.skillId ?? '') ||
    context.catalog.skillsByName.get(skillName) || {
      id: extra.skillId ?? extra.sourceId ?? `mesmer.effect:${skillName}`,
      name: skillName
    };

  const addCondition: MesmerAddCondition = (skillName, at, condition, source = 'Player', label = '', extra = {}) => {
    const skill = skillForCondition(skillName, extra);
    const baseOwnership = ownership(
      String(extra.source || source),
      extra.actorType,
      extra.summonKind ?? condition.summonKind
    );
    const fields = supplementalFields(extra, ['actorType', 'skillId', 'skillName', 'source', 'sourceId', 'summonKind']);
    const ticks = condition.ticks?.length
      ? condition.ticks
      : Array.from({ length: Math.max(1, Math.trunc(Number(condition.applications ?? 1))) }, (_, index) => ({
          atMs: Number(condition.atMs || 0) + index * Number(condition.intervalMs || 0),
          condition: condition.name,
          duration: condition.duration,
          stacks: Number(condition.stacks ?? 1)
        }));

    return ticks.flatMap((tick, index) => {
      const name = canonicalTargetConditionName(tick.condition);
      if (!(Number(tick.duration) > 0)) return [];
      const emitted = emitSkillCondition(emissionContext, skill, {
        ...fields,
        ...baseOwnership,
        at: at + Number(tick.atMs || 0) / 1000,
        condition: name,
        duration: Number(tick.duration),
        stacks: Number(tick.stacks ?? 1),
        name: label || `${skillName} — ${name}`,
        source: String(extra.source || source),
        sourceId: extra.sourceId ?? skill.id,
        skillId: extra.skillId ?? skill.id,
        skillName,
        applicationIndex: index + 1,
        totalApplications: ticks.length
      });
      return emitted ? [emitted] : [];
    });
  };

  const addDamage: MesmerAddDamage = (skill, at, group, extra = {}) => {
    const source = String(group.source || extra.source || 'Player');
    const baseOwnership = ownership(source, group.actorType || extra.actorType, group.summonKind || extra.summonKind);
    const explicit = String(group.weapon || '');
    const normalized = explicit.charAt(0).toUpperCase() + explicit.slice(1).toLowerCase();
    const strength = baseOwnership.actorType === 'summon' ? weaponStrength[normalized] : undefined;
    const fields = supplementalFields({ ...group, ...extra }, [
      'actorType',
      'atMs',
      'canCrit',
      'coefficient',
      'hits',
      'intervalMs',
      'name',
      'skillId',
      'skillName',
      'source',
      'sourceId',
      'summonKind',
      'ticks',
      'timingAnchor',
      'timingScale',
      'type',
      'weapon'
    ]);
    const ticks = group.ticks?.length
      ? group.ticks
      : Array.from({ length: Math.max(1, Math.trunc(Number(group.hits ?? 1))) }, (_, index) => ({
          atMs: Number(group.atMs || 0) + index * Number(group.intervalMs || 0),
          coefficient: Number(group.coefficient || 0) / Math.max(1, Math.trunc(Number(group.hits ?? 1)))
        }));
    const slotSkill = ['Heal', 'Utility', 'Elite'].includes(String(skill.type || ''));

    return ticks.flatMap((tick, index) =>
      emitSkillDamage(emissionContext, skill, {
        ...fields,
        ...baseOwnership,
        at: at + Number(tick.atMs || 0) / 1000,
        coefficient: Number(tick.coefficient || 0),
        hits: 1,
        hitIndex: index + 1,
        totalHits: ticks.length,
        name: String(extra.name || group.name || skill.name),
        source,
        sourceId: extra.sourceId ?? skill.id,
        skillId: extra.skillId ?? skill.id,
        skillName: String(extra.skillName || skill.name),
        skillWeapon: skill.weapon || (slotSkill ? 'Utility' : activePrimaryWeapon()),
        canCrit: group.canCrit,
        blade: Boolean(extra.blade ?? skill.blade),
        ...(strength == null ? {} : { weaponStrength: strength })
      }).filter((event): event is SimulationEvent => Boolean(event))
    );
  };

  return Object.freeze({ addEvent, addTraitProc, addCondition, addDamage });
}
