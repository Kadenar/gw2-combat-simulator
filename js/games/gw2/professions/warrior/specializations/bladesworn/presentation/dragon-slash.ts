/** Owns Dragon Slash editor choices, command intent, and interpretation of recorded release outcomes. */
import { GW2_ACTION_TICK_MS } from '#gw2/platform/combat/action-tick.js';
import type { CastEditorPreparation, ProfessionCastEditor } from '#gw2/platform/profession-presentation/cast-editor.js';
import type {
  ProfessionTimelineAnnotation,
  ProfessionTimelineAnnotationContext,
  ProfessionTimelineOccupancyContext,
  TimelineOccupiedInterval
} from '#gw2/platform/profession-presentation/types.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import {
  DRAGON_TRIGGER_ENTRY_RESOURCE_REASON,
  ENTER_DRAGON_TRIGGER_REASON
} from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

/** Recognize the editor without executing a prefix; the caller prepares it only when opened. */
export function dragonSlashEditor(skill: WarriorSkill): ProfessionCastEditor | null {
  if (!skill.dragonSlash) return null;

  return {
    prepare({ command, preview, formatTime }) {
      const projection = dragonChargeReleaseProjection(skill, (candidate) =>
        preview(candidate ? { ...command, ...candidate, releaseDelayMs: undefined } : undefined)
      );
      const choices = [
        { id: 'maximum', label: 'Release at maximum', disabled: false, reason: '' },
        ...projection.rows.map((row) => ({
          id: String(row.charges),
          label: row.disabled
            ? `${row.charges} charges · unavailable`
            : `${row.charges} charges · ${formatTime(row.at * 1000)} (+${row.delta.toFixed(3)}s) · ${row.flowAfter == null ? '-' : row.flowAfter.toFixed(2)} Flow · ${row.coefficient.toFixed(2)} coefficient`,
          disabled: row.disabled,
          reason: row.reason
        }))
      ];
      const selected = String(command?.releaseAtCharges);
      return {
        heading: 'Release Dragon Slash',
        accessibleLabel: `Edit ${skill.displayName || skill.name} charge release`,
        choiceLabel: 'Release after',
        choices,
        selectedChoiceId: choices.some((choice) => !choice.disabled && choice.id === selected) ? selected : 'maximum',
        unavailableMessage: projection.unavailableMessage,
        delay: {
          label: 'Additional release delay (ms)',
          help: 'Optional hold after the selected charges are ready. No additional Flow is consumed by charging.',
          valueMs: command?.releaseDelayMs ?? 0,
          minimumMs: 0,
          stepMs: GW2_ACTION_TICK_MS
        },
        apply(choiceId, delayMs) {
          if (
            !choices.some((choice) => choice.id === choiceId && !choice.disabled) ||
            !Number.isFinite(delayMs) ||
            delayMs < 0 ||
            delayMs % GW2_ACTION_TICK_MS !== 0
          )
            return null;

          return {
            releaseAtCharges: choiceId === 'maximum' ? undefined : Number(choiceId),
            releaseDelayMs: delayMs > 0 ? delayMs : undefined
          };
        }
      };
    }
  };
}

/** Release choices are actual independent prefix runs, including their pending effects, cooldowns, and charge stalls. */
function dragonChargeReleaseProjection(skill: WarriorSkill, preview: CastEditorPreparation['preview']) {
  const unavailable = { rows: [], unavailableMessage: ENTER_DRAGON_TRIGGER_REASON };

  const prefix = preview();
  const state = prefix.planningState.profession as { readonly [STATE.DRAGON_TRIGGER_ACTIVE]?: boolean } | null;

  if (!state?.[STATE.DRAGON_TRIGGER_ACTIVE]) return unavailable;

  const entry = prefix.events
    .filter((event) => event.type === 'resource' && event.reason === DRAGON_TRIGGER_ENTRY_RESOURCE_REASON)
    .at(-1);

  if (!entry) return unavailable;

  const maximum = Number(entry.maximumCharges);
  const interval = Number(entry.chargesPerInterval);

  if (!(Number.isInteger(maximum) && maximum > 0 && Number.isInteger(interval) && interval > 0))
    throw new TypeError('Dragon Trigger entry must record positive integer charge limits.');

  const levels: number[] = [];
  for (let charges = interval; charges < maximum; charges += interval) levels.push(charges);
  levels.push(maximum);
  const rows = levels.map((charges) => {
    const result = preview({ type: 'cast', skillId: skill.id, releaseAtCharges: charges });
    const step = result.steps.at(-1);
    const release =
      step?.activationId == null
        ? undefined
        : result.events.find(
            (event) =>
              event.type === 'resource' &&
              event.reason === 'profession mechanic' &&
              event.resource === 'dragon charges' &&
              event.activationId === step.activationId
          );
    return {
      charges: release ? Number(release.chargesReached) : charges,
      at: release?.at ?? prefix.planningState.atSeconds,
      delta: release ? release.at - entry.at : 0,
      flowAfter: release ? Number(release.flowAfter) : null,
      coefficient: release ? Number(release.coefficient) : 0,
      disabled: !release,
      reason: release ? '' : (step?.invalidReason ?? 'No release occurred at this insertion point.')
    };
  });
  // Waiting for another gate can make several thresholds release the same actual charge count.
  return {
    rows: rows.filter((row, index) => rows.findIndex((other) => other.charges === row.charges) === index),
    unavailableMessage: undefined
  };
}

/** Recorded charging occupies the entry window; overholding beyond its cap remains idle. */
export function dragonSlashOccupiedInterval({
  skill,
  step,
  spend
}: ProfessionTimelineOccupancyContext): TimelineOccupiedInterval | null {
  const warriorSkill: WarriorSkill | undefined = skill;

  if (!warriorSkill?.dragonSlash || spend?.resource !== 'dragon charges') return null;

  const chargingMs = Math.round(Number(spend.event.chargingSeconds || 0) * 1000);
  return chargingMs > 0
    ? {
        startMs: step.start - chargingMs,
        durationMs: Math.min(chargingMs, Math.round(Number(spend.event.maximumChargingSeconds ?? Infinity) * 1000))
      }
    : null;
}

/** Authored release intent and its recorded outcome supply row wording without recomputing mechanics. */
export function dragonSlashTimelineAnnotation({
  skill,
  entry,
  spend,
  formattedTime
}: ProfessionTimelineAnnotationContext): ProfessionTimelineAnnotation | null {
  const warriorSkill: WarriorSkill | undefined = skill;

  if (!warriorSkill?.dragonSlash || entry?.type !== 'cast') return null;

  const outcome = spend?.resource === 'dragon charges' ? spend.event : undefined;
  const count = spend?.count ?? 0;
  const chargingSeconds = Number(outcome?.chargingSeconds || 0);
  const requested = entry.releaseAtCharges ?? Number(outcome?.maximumCharges);
  const actual = outcome?.chargesReached == null ? count : Number(outcome.chargesReached);
  return {
    editLabel: 'charge release',
    releaseBadge: {
      label: `⚡${entry.releaseAtCharges ?? 'Max'}${formattedTime ? `\n${formattedTime}` : ''}`,
      title: `Release at ${entry.releaseAtCharges == null ? 'maximum' : entry.releaseAtCharges} charges; cast at ${formattedTime}`
    },
    outcomeMismatch: Boolean(outcome) && Number.isFinite(requested) && Number.isFinite(actual) && requested !== actual,
    resourceLabel: outcome ? `${count} ${count === 1 ? 'dragon charge' : 'dragon charges'} consumed at cast start` : '',
    details: outcome
      ? [
          `Charges reached: ${actual}`,
          `${(entry.releaseDelayMs ?? 0) > 0 ? 'Time in Dragon Trigger' : 'Time spent charging'}: ${chargingSeconds.toFixed(3)}s`,
          ...((entry.releaseDelayMs ?? 0) > 0
            ? [`Additional release delay: ${entry.releaseDelayMs} ms (no charging Flow)`]
            : []),
          `Flow spent: ${Number(outcome.flowSpent || 0).toFixed(2)}`
        ]
      : []
  };
}
