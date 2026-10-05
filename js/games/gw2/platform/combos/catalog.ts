import { requireComboDescriptorOwner } from '#gw2/platform/combos/ownership.js';
import type { OwnedComboDescriptor } from '#gw2/platform/combos/types.js';
import type { UnvalidatedFields } from '#kernel/core/unvalidated.js';
import {
  normalizeComboFieldType,
  normalizeComboFinisherType,
  normalizeComboFieldSelectionAnchor
} from '#gw2/platform/combos/events.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { clamp } from '#kernel/core/numeric.js';

function positiveInteger(value: unknown, fallback: number, label: string): number {
  const normalized = Number(value ?? fallback);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new TypeError(`${label} must be a positive integer.`);
  }

  return normalized;
}

function normalizeFieldDescriptors(value: unknown): readonly OwnedComboDescriptor[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('comboFields must be a non-empty array.');
  }

  return Object.freeze(
    value.map((raw, index) => {
      const descriptor = requireComboDescriptorOwner(raw, `comboFields entry ${index + 1}`);
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

function normalizeFinisherDescriptors(value: unknown, attemptGroup?: string): readonly OwnedComboDescriptor[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('comboFinishers must be a non-empty array.');
  }

  return Object.freeze(
    value.map((raw, index) => {
      const descriptor = requireComboDescriptorOwner(raw, `comboFinishers entry ${index + 1}`);
      const chance = Number(descriptor.chance ?? 1);
      if (!Number.isFinite(chance)) {
        throw new TypeError(`comboFinishers entry ${index + 1} requires a finite chance.`);
      }

      const effectDelay = Number(descriptor.effectDelay ?? 0);
      if (descriptor.excludeOwnField != null && typeof descriptor.excludeOwnField !== 'boolean') {
        throw new TypeError(`comboFinishers entry ${index + 1} excludeOwnField must be a boolean.`);
      }

      if (!(effectDelay >= 0) || !Number.isFinite(effectDelay)) {
        throw new TypeError(`comboFinishers entry ${index + 1} requires a non-negative effectDelay.`);
      }

      return Object.freeze({
        ...descriptor,
        ...(descriptor.attemptGroup == null && attemptGroup ? { attemptGroup } : {}),
        finisherType: normalizeComboFinisherType(descriptor.finisherType ?? descriptor.type),
        fieldSelectionAnchor: normalizeComboFieldSelectionAnchor(descriptor.fieldSelectionAnchor),
        chance: clamp(chance, 0, 1),
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

function normalizeTick(tick: UnvalidatedFields, effectIndex: number, tickIndex: number): UnvalidatedFields {
  const attemptGroup = `effect:${effectIndex + 1}:tick:${tickIndex + 1}`;
  const comboFinishers =
    tick.comboFinishers == null ? undefined : normalizeFinisherDescriptors(tick.comboFinishers, attemptGroup);
  return comboFinishers ? { ...tick, comboFinishers } : tick;
}

function normalizeEffect(effect: SkillEffect, effectIndex: number): SkillEffect {
  const comboFields = effect.comboFields == null ? undefined : normalizeFieldDescriptors(effect.comboFields);
  const comboFinishers =
    effect.comboFinishers == null
      ? undefined
      : normalizeFinisherDescriptors(effect.comboFinishers, `effect:${effectIndex + 1}`);
  const ticks = Array.isArray(effect.ticks)
    ? Object.freeze(
        effect.ticks.map((tick, tickIndex) =>
          Object.freeze(normalizeTick(tick as UnvalidatedFields, effectIndex, tickIndex))
        )
      )
    : effect.ticks;
  return {
    ...effect,
    ...(comboFields ? { comboFields } : {}),
    ...(comboFinishers ? { comboFinishers } : {}),
    ...(ticks ? { ticks } : {})
  } as SkillEffect;
}

/** Normalizes explicit GW2 combo descriptors at native catalog assembly time. */
export function normalizeGw2ComboCatalogSkill<TSkill extends Skill>(skill: Partial<TSkill>): Partial<TSkill> {
  // Catalog failures identify the authoring record before any simulation can start.
  try {
    const comboFields = skill.comboFields != null ? normalizeFieldDescriptors(skill.comboFields) : undefined;
    const comboFinishers =
      skill.comboFinishers != null ? normalizeFinisherDescriptors(skill.comboFinishers, 'skill') : undefined;
    return {
      ...skill,
      ...(comboFields ? { comboFields } : {}),
      ...(comboFinishers ? { comboFinishers } : {}),
      ...(skill.effects ? { effects: skill.effects.map(normalizeEffect) } : {})
    };
  } catch (error) {
    throw new TypeError(
      `Skill ${String(skill.id)} (${skill.name}): ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}
