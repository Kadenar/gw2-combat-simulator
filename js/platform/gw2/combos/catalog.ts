import { normalizeComboFieldType, normalizeComboFinisherType } from './events.js';
import type { SchedulerRecord, SkillEffect, SkillFragment } from '../../engine/types.js';

function positiveInteger(value: unknown, fallback: number, label: string): number {
  const normalized = Number(value ?? fallback);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new TypeError(`${label} must be a positive integer.`);
  }

  return normalized;
}

function normalizeFieldDescriptors(value: unknown): readonly Readonly<SchedulerRecord>[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('comboFields must be a non-empty array.');
  }

  return Object.freeze(
    value.map((raw, index) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new TypeError(`comboFields entry ${index + 1} must be an object.`);
      }

      const descriptor = raw as SchedulerRecord;
      const duration = Number(descriptor.duration);
      if (!(duration > 0) || !Number.isFinite(duration)) {
        throw new TypeError(`comboFields entry ${index + 1} requires a positive duration.`);
      }

      const startMs = Number(descriptor.startMs ?? 0);
      if (!(startMs >= 0) || !Number.isFinite(startMs)) {
        throw new TypeError(`comboFields entry ${index + 1} requires a non-negative startMs.`);
      }

      const startAnchor = descriptor.startAnchor ?? 'castStart';
      if (!['castStart', 'castEnd', 'event'].includes(String(startAnchor))) {
        throw new TypeError(`comboFields entry ${index + 1} has an invalid startAnchor.`);
      }

      return Object.freeze({
        ...descriptor,
        fieldType: normalizeComboFieldType(descriptor.fieldType ?? descriptor.type),
        duration,
        startMs,
        startAnchor
      });
    })
  );
}

function normalizeFinisherDescriptors(value: unknown, attemptGroup?: string): readonly Readonly<SchedulerRecord>[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('comboFinishers must be a non-empty array.');
  }

  return Object.freeze(
    value.map((raw, index) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new TypeError(`comboFinishers entry ${index + 1} must be an object.`);
      }

      const descriptor = raw as SchedulerRecord;
      const chance = Number(descriptor.chance ?? 1);
      if (!Number.isFinite(chance)) {
        throw new TypeError(`comboFinishers entry ${index + 1} requires a finite chance.`);
      }

      const effectDelay = Number(descriptor.effectDelay ?? 0);
      if (!(effectDelay >= 0) || !Number.isFinite(effectDelay)) {
        throw new TypeError(`comboFinishers entry ${index + 1} requires a non-negative effectDelay.`);
      }

      return Object.freeze({
        ...descriptor,
        ...(descriptor.attemptGroup == null && attemptGroup ? { attemptGroup } : {}),
        finisherType: normalizeComboFinisherType(descriptor.finisherType ?? descriptor.type),
        chance: Math.max(0, Math.min(1, chance)),
        attempts: positiveInteger(descriptor.attempts, 1, `comboFinishers entry ${index + 1} attempts`),
        applications: positiveInteger(descriptor.applications, 1, `comboFinishers entry ${index + 1} applications`),
        successfulCombos: positiveInteger(
          descriptor.successfulCombos,
          1,
          `comboFinishers entry ${index + 1} successfulCombos`
        ),
        effectDelay
      });
    })
  );
}

// Legacy data encoded finisherValue with type-specific semantics:
//   Projectile → chance (0..1)
//   Whirl      → number of applications (hits that each trigger a combo)
//   Blast      → successfulCombos (combos produced on a single success)
function legacyFinisher(
  finisherType: unknown,
  finisherValue: unknown,
  attemptGroup?: string
): readonly Readonly<SchedulerRecord>[] | undefined {
  if (!finisherType) return;
  const type = normalizeComboFinisherType(finisherType);
  const value = Math.max(0, Number(finisherValue ?? 1));
  return normalizeFinisherDescriptors(
    [
      {
        finisherType: type,
        chance: type === 'Projectile' ? value : 1,
        applications: type === 'Whirl' ? Math.max(1, Math.floor(value)) : 1,
        successfulCombos: type === 'Blast' ? Math.max(1, Math.floor(value)) : 1
      }
    ],
    attemptGroup
  );
}

// Strips the old finisherType/finisherValue fields from tick/effect metadata
// so they aren't re-processed now that we have an explicit comboFinishers array.
function withoutLegacyFinisherAliases(metadata: SchedulerRecord | undefined): SchedulerRecord | undefined {
  if (!metadata) return metadata;
  const { finisherType: _finisherType, finisherValue: _finisherValue, ...rest } = metadata;
  return rest;
}

function normalizeTick(
  tick: SchedulerRecord,
  effectIndex: number,
  tickIndex: number,
  allowLegacy: boolean
): SchedulerRecord {
  const attemptGroup = `effect:${effectIndex + 1}:tick:${tickIndex + 1}`;
  // Legacy finisher metadata is only promoted on strike ticks (allowLegacy=true).
  // Non-strike ticks instead have the old fields stripped from their metadata.
  const comboFinishers =
    tick.comboFinishers == null
      ? allowLegacy
        ? legacyFinisher(
            (tick.metadata as SchedulerRecord | undefined)?.finisherType,
            (tick.metadata as SchedulerRecord | undefined)?.finisherValue,
            attemptGroup
          )
        : undefined
      : normalizeFinisherDescriptors(tick.comboFinishers, attemptGroup);
  const normalizedTick = allowLegacy
    ? tick
    : {
        ...tick,
        ...(tick.metadata
          ? {
              metadata: withoutLegacyFinisherAliases(tick.metadata as SchedulerRecord)
            }
          : {})
      };
  return comboFinishers ? { ...normalizedTick, comboFinishers } : normalizedTick;
}

function normalizeEffect(effect: SkillEffect, effectIndex: number): SkillEffect {
  const metadata = effect.metadata as SchedulerRecord | undefined;
  const comboFields = effect.comboFields == null ? undefined : normalizeFieldDescriptors(effect.comboFields);
  // Legacy finisher fields in metadata are only promoted to comboFinishers on
  // strike effects. Non-strike effects (buffs, conditions, etc.) have them stripped.
  const comboFinishers =
    effect.comboFinishers == null
      ? effect.type === 'strike'
        ? legacyFinisher(metadata?.finisherType, metadata?.finisherValue, `effect:${effectIndex + 1}`)
        : undefined
      : normalizeFinisherDescriptors(effect.comboFinishers, `effect:${effectIndex + 1}`);
  const ticks = Array.isArray(effect.ticks)
    ? Object.freeze(
        effect.ticks.map((tick, tickIndex) =>
          Object.freeze(normalizeTick(tick as SchedulerRecord, effectIndex, tickIndex, effect.type === 'strike'))
        )
      )
    : effect.ticks;
  return {
    ...effect,
    ...(effect.type !== 'strike' && metadata ? { metadata: withoutLegacyFinisherAliases(metadata) } : {}),
    ...(comboFields ? { comboFields } : {}),
    ...(comboFinishers ? { comboFinishers } : {}),
    ...(ticks ? { ticks } : {})
  } as SkillEffect;
}

/** Normalizes GW2 combo aliases at native catalog assembly time. */
export function normalizeGw2ComboCatalogSkill(skill: SkillFragment): SkillFragment {
  const legacyDuration = Number(skill.comboFieldDuration ?? skill.fieldDuration ?? skill.duration ?? 0);
  // When comboFieldStartMs is absent the field activates at the end of the cast
  // animation rather than the beginning. Most fields use this implicit behavior.
  const comboFields =
    skill.comboFields != null
      ? normalizeFieldDescriptors(skill.comboFields)
      : skill.comboField && legacyDuration > 0
        ? normalizeFieldDescriptors([
            {
              fieldType: skill.comboField,
              duration: legacyDuration,
              startMs: Number(skill.comboFieldStartMs ?? 0),
              startAnchor: skill.comboFieldStartMs == null ? 'castEnd' : 'castStart'
            }
          ])
        : undefined;
  const comboFinishers =
    skill.comboFinishers != null
      ? normalizeFinisherDescriptors(skill.comboFinishers, 'skill')
      : legacyFinisher(skill.finisherType, skill.finisherValue, 'skill');
  return {
    ...skill,
    ...(comboFields ? { comboFields } : {}),
    ...(comboFinishers ? { comboFinishers } : {}),
    ...(skill.effects ? { effects: skill.effects.map(normalizeEffect) } : {})
  };
}
