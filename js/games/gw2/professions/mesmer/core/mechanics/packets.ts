import { materializeSkillEffectApplications } from '#gw2/platform/effects/materializer.js';
import { canonicalTargetConditionName } from '#gw2/platform/combat/state/targets.js';

import { normalizeEffectMetadata } from '#gw2/platform/effects/audience-metadata-validation.js';
import type { SimulationEventBase } from '#gw2/platform/events/events.js';
import type { SimulationActorType } from '#gw2/platform/events/actors.js';
import type { ConditionEffect } from '#gw2/platform/effects/types.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type { MesmerEventExtra, MesmerStrikeEffect } from '#gw2/professions/mesmer/data/types.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { MESMER_CORE_WEAPON_STRENGTH } from '#gw2/professions/mesmer/core/mechanics/definitions.js';
import type { WorkOwner } from '#gw2/platform/simulation/work-contract.js';
/** Player events are the default; explicit summon metadata keeps ownership independent of display labels. */
function ownership(actorType: SimulationActorType | undefined, summonKind: string | undefined) {
  return {
    actorType: actorType ?? (summonKind ? 'summon' : 'player'),
    ...(summonKind ? { summonKind } : {})
  };
}

/** Removes authoring controls after they have been converted to standard helper arguments. */
function supplementalFields<T extends object>(source: T, fields: readonly (keyof T)[]): Partial<T> {
  const result = { ...source };
  for (const field of fields) delete result[field];
  return result;
}

/** Author packet ownership without submitting work or mutating the live runtime. */
export function buildMesmerPacket(
  event: MesmerEventExtra & { readonly type: string; readonly at: number; readonly instrument?: string }
): SimulationEventBase {
  const source = event.source || 'mesmer';
  // Non-skill events use their semantic event type, independent of translated labels.
  const sourceId = event.sourceId ?? event.skillId ?? event.type;
  const canonical = { ...event, source, sourceId, ...ownership(event.actorType, event.summonKind) };
  return canonical;
}

/** Catalog skills and effect sources retain explicit identities; names only label their packets. */
function skillForCondition(context: MesmerRuntime, skillName: string, extra: MesmerEventExtra): Skill {
  const id = extra.skillId ?? extra.sourceId;
  if (id == null) throw new TypeError('Mesmer condition packets require a skillId or sourceId.');
  return context.helpers.skillsById.get(id) ?? { id, name: skillName };
}

/** Plan the complete condition sequence independently of admission and combat resolution. */
export function buildMesmerConditions(
  context: MesmerRuntime,
  skillName: string,
  at: number,
  condition: ConditionEffect,
  source = 'Player',
  label = '',
  extra: MesmerEventExtra = {}
): readonly SimulationEventBase[] {
  const skill = skillForCondition(context, skillName, extra);
  // A mechanic may filter every application from a derived timeline before asking for materialization.
  if (condition.ticks?.length === 0) return [];
  const baseOwnership = ownership(extra.actorType, extra.summonKind ?? condition.summonKind);
  const fields = supplementalFields(extra, ['actorType', 'skillId', 'skillName', 'source', 'sourceId', 'summonKind']);
  // The shared materializer owns authored payload expansion; Mesmer keeps canonical labels and companion delivery.
  return materializeSkillEffectApplications({
    skill,
    effect: condition,
    start: at,
    fullEnd: at,
    baseEvent: {
      ...baseOwnership,
      source: extra.source || source,
      sourceId: extra.sourceId ?? skill.id,
      skillId: extra.skillId ?? skill.id,
      skillName
    }
  }).flatMap(({ event }) => {
    if (!(Number(event.duration) > 0)) return [];
    const conditionName = canonicalTargetConditionName(event.condition);
    return [
      {
        ...fields,
        ...event,
        condition: conditionName,
        name: label || skillName + ' — ' + conditionName,
        metadata: normalizeEffectMetadata({ ...event.metadata, ...extra.metadata })
      }
    ];
  });
}

/** Plan strike timing and summon strength independently of queue admission and later combat resolution. */
export function buildMesmerStrikes(
  context: MesmerRuntime,
  skill: Skill,
  at: number,
  group: Partial<MesmerStrikeEffect>,
  extra: MesmerEventExtra = {}
): readonly SimulationEventBase[] {
  // Empty derived timelines suppress the selected variant, while authored catalog effects remain nonempty.
  if (group.ticks?.length === 0) return [];
  const source = group.source || extra.source || 'Player';
  const baseOwnership = ownership(group.actorType ?? extra.actorType, group.summonKind ?? extra.summonKind);
  const explicit = group.weapon || '';
  const normalized = explicit.charAt(0).toUpperCase() + explicit.slice(1).toLowerCase();
  const strength = baseOwnership.actorType === 'summon' ? MESMER_CORE_WEAPON_STRENGTH[normalized] : undefined;
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
  // Shared materialization owns all strike fields; this adapter only supplies Mesmer weapon and summon policy.
  const slotSkill = ['Heal', 'Utility', 'Elite'].includes(skill.type || '');
  return materializeSkillEffectApplications({
    skill,
    effect: { ...group, type: 'strike' },
    start: at,
    fullEnd: at,
    baseEvent: {
      ...baseOwnership,
      source,
      sourceId: extra.sourceId ?? skill.id,
      skillId: extra.skillId ?? skill.id,
      skillName: extra.skillName || skill.name,
      metadata: { blade: Boolean(skill.blade) }
    }
  }).map(({ event }) => ({
    ...fields,
    ...event,
    name: extra.name || group.name || skill.name,
    skillWeapon:
      skill.weapon || (slotSkill ? 'Utility' : gw2ActivePrimaryWeapon(context.config, context.activeWeaponSet) || ''),
    metadata: normalizeEffectMetadata({ ...event.metadata, ...extra.metadata }),
    ...(strength == null ? {} : { weaponStrength: strength })
  }));
}

/** Clone lifetime belongs to its owner independently of attribution and the triggering cast. */
export function mesmerPacketOwner(event: SimulationEventBase): WorkOwner | undefined {
  const id =
    typeof event.summonOwner === 'string' && event.summonOwner.startsWith('mesmer.clone:')
      ? event.summonOwner
      : event.metadata?.cloneId != null
        ? `mesmer.clone:${event.metadata.cloneId}`
        : undefined;
  return id ? { id, generation: 0 } : undefined;
}
