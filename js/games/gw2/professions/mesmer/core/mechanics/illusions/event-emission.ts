import { requireBalanceNumber } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { canonicalTargetConditionName } from '#gw2/platform/combat/state/targets.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { normalizeEffectMetadata } from '#gw2/platform/engine/effects/contracts.js';

import type { SimulationEvent, SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { SimulationActorType } from '#gw2/platform/engine/events/actors.js';
import type { ConditionTick, Skill, StrikeTick } from '#gw2/platform/engine/skills/types.js';
import type {
  MesmerAddCondition,
  MesmerAddDamage,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerRuntime
} from '#gw2/professions/mesmer/types.js';
import type { MesmerEventExtra, MesmerSummonKind } from '#gw2/professions/mesmer/data/types.js';

interface MesmerEventEmitterOptions {
  readonly context: MesmerRuntime;
  readonly emit: (event: SimulationEventBase) => SimulationEvent | null;
  readonly activePrimaryWeapon: () => string;
  readonly weaponStrength: Readonly<Record<string, number>>;
}

/** Player events are the default; explicit summon metadata keeps ownership independent of display labels. */
function ownership(actorType: SimulationActorType | undefined, summonKind: MesmerSummonKind | undefined) {
  return {
    actorType: (actorType ?? (summonKind ? 'summon' : 'player')) as SimulationActorType,
    ...(summonKind ? { summonKind } : {})
  };
}

/** Removes authoring controls after they have been converted to standard helper arguments. */
function supplementalFields<T extends object>(source: T, fields: readonly (keyof T)[]): Partial<T> {
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
  const addEvent: MesmerAddEvent = (event) => {
    const source = String(event.source || 'mesmer');
    const sourceId = event.sourceId ?? event.skillId ?? event.skillName ?? event.name ?? event.type;
    const canonical = { ...event, source, sourceId, ...ownership(event.actorType, event.summonKind) };
    return emit(canonical as SimulationEventBase);
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
    context.helpers.skillsById.get(extra.skillId ?? '') ||
    context.helpers.skillsByName.get(skillName) || {
      id: extra.skillId ?? extra.sourceId ?? `mesmer.effect:${skillName}`,
      name: skillName
    };

  const addCondition: MesmerAddCondition = (skillName, at, condition, source = 'Player', label = '', extra = {}) => {
    const skill = skillForCondition(skillName, extra);
    const baseOwnership = ownership(extra.actorType, extra.summonKind ?? condition.summonKind);
    const fields = supplementalFields(extra, ['actorType', 'skillId', 'skillName', 'source', 'sourceId', 'summonKind']);
    const ticks: readonly ConditionTick[] = condition.ticks?.length
      ? condition.ticks
      : Array.from({ length: Math.max(1, Math.trunc(Number(condition.applications ?? 1))) }, (_, index) => ({
          atMs: Number(condition.atMs || 0) + index * Number(condition.intervalMs || 0),
          condition: condition.name,
          duration: requireBalanceNumber(condition.duration, `${skillName} condition duration`),
          stacks: Number(condition.stacks ?? 1)
        }));

    return ticks.flatMap((tick, index) => {
      const name = canonicalTargetConditionName(tick.condition);
      if (!(Number(tick.duration) > 0)) return [];
      const packet = {
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
        totalApplications: ticks.length,
        // Packet annotations override application defaults; explicit call annotations win last.
        metadata: normalizeEffectMetadata({ ...condition.metadata, ...tick.metadata, ...extra.metadata })
      };
      const emitted = emit(buildResolverCondition(packet));
      return emitted ? [emitted] : [];
    });
  };

  const addDamage: MesmerAddDamage = (skill, at, group, extra = {}) => {
    const source = String(group.source || extra.source || 'Player');
    const baseOwnership = ownership(group.actorType ?? extra.actorType, group.summonKind ?? extra.summonKind);
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
    const ticks: readonly StrikeTick[] = group.ticks?.length
      ? group.ticks
      : Array.from({ length: Math.max(1, Math.trunc(Number(group.hits ?? 1))) }, (_, index) => ({
          atMs: Number(group.atMs || 0) + index * Number(group.intervalMs || 0),
          coefficient: Number(group.coefficient || 0) / Math.max(1, Math.trunc(Number(group.hits ?? 1)))
        }));
    const slotSkill = ['Heal', 'Utility', 'Elite'].includes(String(skill.type || ''));

    return ticks.flatMap((tick, index) => {
      const packet = {
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
        // Keep the skill fallback while preserving false, zero, and unrelated packet annotations.
        metadata: normalizeEffectMetadata({
          blade: Boolean(skill.blade),
          ...group.metadata,
          ...tick.metadata,
          ...extra.metadata
        }),
        ...(strength == null ? {} : { weaponStrength: strength })
      };
      return [emit(buildResolverStrike(packet))].filter((event): event is SimulationEvent => Boolean(event));
    });
  };

  return Object.freeze({ addEvent, addTraitProc, addCondition, addDamage });
}
