import { requireBalanceNumber } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { canonicalTargetConditionName } from '#gw2/platform/combat/state/targets.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { normalizeEffectMetadata } from '#gw2/platform/engine/effects/contracts.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { SimulationActorType } from '#gw2/platform/engine/events/actors.js';
import type { ConditionTick, Skill, StrikeTick } from '#gw2/platform/engine/skills/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import type {
  MesmerEventExtra,
  MesmerSummonKind,
  MesmerConditionApplication,
  MesmerStrikeEffect
} from '#gw2/professions/mesmer/data/types.js';
import { gw2ActivePrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { MESMER_CORE_WEAPON_STRENGTH } from '#gw2/professions/mesmer/core/mechanics/definitions.js';
import type { WorkOwner } from '#gw2/platform/simulation/internal-work.js';
/** Player events are the default; explicit summon metadata keeps ownership independent of display labels. */
function ownership(actorType: SimulationActorType | undefined, summonKind: MesmerSummonKind | undefined) {
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
  const sourceId = event.sourceId ?? event.skillId ?? event.skillName ?? event.name ?? event.type;
  const canonical = { ...event, source, sourceId, ...ownership(event.actorType, event.summonKind) };
  return canonical;
}

function skillForCondition(context: MesmerRuntime, skillName: string, extra: MesmerEventExtra): Skill {
  return (
    context.helpers.skillsById.get(extra.skillId ?? '') ||
    context.helpers.skillsByName.get(skillName) || {
      id: extra.skillId ?? extra.sourceId ?? `mesmer.effect:${skillName}`,
      name: skillName
    }
  );
}

/** Plan the complete condition sequence independently of admission and combat resolution. */
export function buildMesmerConditions(
  context: MesmerRuntime,
  skillName: string,
  at: number,
  condition: MesmerConditionApplication,
  source = 'Player',
  label = '',
  extra: MesmerEventExtra = {}
): readonly SimulationEventBase[] {
  const skill = skillForCondition(context, skillName, extra);
  const baseOwnership = ownership(extra.actorType, extra.summonKind ?? condition.summonKind);
  const fields = supplementalFields(extra, ['actorType', 'skillId', 'skillName', 'source', 'sourceId', 'summonKind']);
  const ticks: readonly ConditionTick[] = condition.ticks?.length
    ? condition.ticks
    : Array.from({ length: Math.max(1, Math.trunc(condition.applications ?? 1)) }, (_, index) => ({
        atMs: (condition.atMs || 0) + index * (condition.intervalMs || 0),
        condition: condition.name,
        duration: requireBalanceNumber(condition.duration, `${skillName} condition duration`),
        stacks: condition.stacks ?? 1
      }));

  return ticks.flatMap((tick, index) => {
    const name = canonicalTargetConditionName(tick.condition);
    if (!(tick.duration > 0)) return [];
    const packet = {
      ...fields,
      ...baseOwnership,
      at: at + (tick.atMs || 0) / 1000,
      condition: name,
      duration: tick.duration,
      stacks: tick.stacks,
      name: label || `${skillName} — ${name}`,
      source: extra.source || source,
      sourceId: extra.sourceId ?? skill.id,
      skillId: extra.skillId ?? skill.id,
      skillName,
      applicationIndex: index + 1,
      totalApplications: ticks.length,
      // Packet annotations override application defaults; explicit call annotations win last.
      metadata: normalizeEffectMetadata({ ...condition.metadata, ...tick.metadata, ...extra.metadata })
    };
    return [buildResolverCondition(packet)];
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
  const ticks: readonly StrikeTick[] = group.ticks?.length
    ? group.ticks
    : // Untimed strikes share their offset; repeated timing is authored through ticks.
      Array.from({ length: Math.max(1, Math.trunc(group.hits ?? 1)) }, () => ({
        atMs: group.atMs || 0,
        coefficient: (group.coefficient || 0) / Math.max(1, Math.trunc(group.hits ?? 1))
      }));
  const slotSkill = ['Heal', 'Utility', 'Elite'].includes(skill.type || '');

  return ticks.flatMap((tick, index) => {
    const packet = {
      ...fields,
      ...baseOwnership,
      at: at + (tick.atMs || 0) / 1000,
      coefficient: tick.coefficient || 0,
      hits: 1,
      hitIndex: index + 1,
      totalHits: ticks.length,
      name: extra.name || group.name || skill.name,
      source,
      sourceId: extra.sourceId ?? skill.id,
      skillId: extra.skillId ?? skill.id,
      skillName: extra.skillName || skill.name,
      skillWeapon:
        skill.weapon || (slotSkill ? 'Utility' : gw2ActivePrimaryWeapon(context.config, context.activeWeaponSet) || ''),
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
    return [buildResolverStrike(packet)];
  });
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
