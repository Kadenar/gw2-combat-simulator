import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { mountRotationWarnings, type RotationWarning } from '#ui/rotation/warnings.js';
import { formatResultTimelineTime } from '#gw2/app/shared/result-clock.js';
import { currentTimelineResults } from '#gw2/app/rotation/timeline/model.js';
import {
  createPaletteContext,
  projectPalette,
  rotationSelectedSlotSkills,
  weaponSkills
} from '#gw2/app/rotation/palette/model.js';

export interface LocatedRotationWarning extends RotationWarning {
  readonly rotationIndex?: number;
}

/** Projects diagnostics onto authored steps; deduplicated failures lead to their first occurrence. */
export function rotationWarningItems(result: Gw2SimulationResult | null | undefined): LocatedRotationWarning[] {
  const rejectedSteps = (result?.steps || []).filter((step) => step.invalid && step.ri >= 0);
  return (result?.warnings || []).map((rawWarning) => {
    const message = String(rawWarning);
    const rejectedStep = rejectedSteps.find(
      (step) => `${step.skill} at ${(step.start / 1000).toFixed(3)}s: ${step.invalidReason}` === message
    );
    // Runtime diagnostics carry absolute simulation time; display it on the same combat-relative clock as the rotation.
    const embeddedTime = message.match(/(?:^|\s)at\s+(-?\d+(?:\.\d+)?)s(?=[:;.,\s]|$)/i);

    if (!embeddedTime) return { message, time: '' };

    const matchIndex = embeddedTime.index ?? 0;
    const cleanedMessage = `${message.slice(
      0,
      matchIndex
    )}${message.slice(matchIndex + embeddedTime[0].length)}`.trim();
    const timeSeconds = Number(embeddedTime[1]);
    // Combo warnings can occur after a cast ends; follow the finisher's activation instead of the nearest skill.
    const comboLabel = message.slice(0, matchIndex).match(/combo field.* for (.+)$/i)?.[1];
    const comboActivations = new Set(
      (comboLabel ? result?.events || [] : [])
        .filter(
          (event) =>
            event.type === 'combo_finisher' &&
            String(event.skillName || event.name || event.source || event.sourceId) === comboLabel &&
            Number(event.fieldSelectionAt ?? event.at).toFixed(3) === timeSeconds.toFixed(3)
        )
        .map((event) => event.activationId)
        .filter(Boolean)
    );
    const skippedSkill = message.slice(0, matchIndex).match(/^(.+) skipped$/)?.[1];
    const candidates = (rejectedStep || (!comboLabel && !skippedSkill) ? [] : result?.steps || []).filter(
      (step) =>
        step.ri >= 0 &&
        ((step.activationId && comboActivations.has(step.activationId)) ||
          (skippedSkill === step.skill && (step.end / 1000).toFixed(3) === timeSeconds.toFixed(3)))
    );
    const source = rejectedStep ?? (candidates.length === 1 ? candidates[0] : undefined);
    return {
      message: cleanedMessage,
      time: formatResultTimelineTime(timeSeconds * 1000, result),
      ...(source ? { rotationIndex: source.ri } : {})
    };
  });
}

/** Reveals and focuses a warning's source without clicking it or changing the authored rotation. */
function revealWarningSource(element: HTMLElement): void {
  document.querySelectorAll('.rotation-warning-source').forEach((source) => {
    source.classList.remove('rotation-warning-source');
  });
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
  }

  if (!element.hasAttribute('tabindex')) element.tabIndex = -1;

  element.classList.add('rotation-warning-source');
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  element.addEventListener('blur', () => element.classList.remove('rotation-warning-source'), { once: true });
}

/** Flags equipped skills whose API-style cast time likely still needs simulator calibration. */
function equippedSkillCastTimeWarnings(app: ProfessionAppState): RotationWarning[] {
  const context = createPaletteContext(app);
  const palette = projectPalette(app, context);
  const equippedSkills = [
    ...weaponSkills(app, 1),
    ...weaponSkills(app, 2),
    ...rotationSelectedSlotSkills(app),
    ...palette.renderedProfessionGroups.flatMap((group) => group.skills),
    ...palette.renderedLoadoutGroups.flatMap((group) => group.skills)
  ];
  const suspectSkills = [
    ...new Set(
      equippedSkills.flatMap((skill) => {
        // Validate authored pet timing, rather than the derived duration without Quickness.
        const castTimeMs = Number(skill.quicknessCastTimeMs ?? skill.castTimeMs ?? 0);
        return castTimeMs > 0 && Number.isFinite(castTimeMs) && castTimeMs % 40 !== 0
          ? [`${skill.name} (${castTimeMs} ms)`]
          : [];
      })
    )
  ];
  return suspectSkills.length
    ? [
        {
          message: `These equipped skills have cast times that are not divisible by 40 ms and may be missing simulator implementation: ${suspectSkills.join(', ')}.`,
          time: '',
          action: {
            label: 'Show equipped skills',
            activate: () => {
              const palette = document.getElementById('rotation-palette');

              if (palette) revealWarningSource(palette);
            }
          }
        }
      ]
    : [];
}

/** Displays skill calibration and simulation warnings while preserving the panel's open state. */
export function renderWarnings(app: ProfessionAppState): void {
  const element = document.getElementById('rotation-warnings');

  if (!element) return;

  const details = element.querySelector<HTMLDetailsElement>('.rotation-warnings-wrap');
  const wasOpen = details?.open ?? false;
  const result = currentTimelineResults(app);
  const warnings = [
    ...equippedSkillCastTimeWarnings(app),
    ...(app.build.rotation.length && result
      ? rotationWarningItems(result).map((warning): RotationWarning => {
          const index = warning.rotationIndex;

          if (index == null || index >= app.build.rotation.length) return warning;

          return {
            ...warning,
            action: {
              label: `Go to rotation step ${index + 1}`,
              activate: () => {
                // Results may become stale between rendering the warning and activating it.
                if (currentTimelineResults(app) !== result) return;

                const source = document.querySelector<HTMLElement>(
                  `#rotation-timeline .rot-skill[data-idx="${index}"]`
                );

                if (source) revealWarningSource(source);
              }
            }
          };
        })
      : [])
  ];
  mountRotationWarnings(element, warnings, { open: wasOpen });
}
