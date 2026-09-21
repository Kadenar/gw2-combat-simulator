import type { SchedulerStep } from '#gw2/platform/execution/types.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import { mountRotationWarnings } from '#ui/rotation/warnings.js';
import { formatResultTimelineTime } from '#gw2/app/shared/result-clock.js';
import {
  createPaletteContext,
  projectPalette,
  rotationSelectedSlotSkills,
  weaponSkills
} from '#gw2/app/rotation/palette/model.js';

export interface RotationWarningItem {
  readonly message: string;
  readonly time: string;
}

export function rotationWarningItems(result: Gw2SimulationResult | null | undefined): RotationWarningItem[] {
  const invalidSteps = new Map<string, SchedulerStep[]>();
  for (const step of result?.steps || []) {
    if (!step.invalid || !step.invalidReason) continue;
    const matches = invalidSteps.get(step.invalidReason) || [];
    matches.push(step);
    invalidSteps.set(step.invalidReason, matches);
  }

  return (result?.warnings || []).map((rawWarning) => {
    const message = String(rawWarning);
    const step = invalidSteps.get(message)?.shift();
    if (step && Number.isFinite(Number(step.start))) {
      return {
        message,
        time: formatResultTimelineTime(step.start, result)
      };
    }

    // Resolver diagnostics carry their absolute simulation time in the
    // message instead of an invalid rotation step.
    const embeddedTime = message.match(/(?:^|\s)at\s+(-?\d+(?:\.\d+)?)s(?=[:.,\s]|$)/i);
    if (!embeddedTime) return { message, time: '' };
    const matchIndex = embeddedTime.index ?? 0;
    const cleanedMessage = `${message.slice(
      0,
      matchIndex
    )}${message.slice(matchIndex + embeddedTime[0].length)}`.trim();
    return {
      message: cleanedMessage,
      time: formatResultTimelineTime(Number(embeddedTime[1]) * 1000, result)
    };
  });
}

/** Flags equipped skills whose API-style cast time likely still needs simulator calibration. */
function equippedSkillCastTimeWarnings(app: ProfessionAppState): RotationWarningItem[] {
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
        const castTimeMs = Number(skill.castTimeMs || 0);
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
          time: ''
        }
      ]
    : [];
}

/** Flags equipped gear whose simulated behavior relies on unconfirmed game values. */
function equippedGearWarnings(app: ProfessionAppState): RotationWarningItem[] {
  return app.build.relic === 'Last Tyrant'
    ? [
        {
          message:
            "Relic of the Last Tyrant: the explosion's damage coefficient and the internal cooldown for gaining Tyrant's Fury stacks are unknown, so results may vary.",
          time: ''
        }
      ]
    : [];
}

export function renderWarnings(app: ProfessionAppState): void {
  const element = document.getElementById('rotation-warnings');
  if (!element) return;
  const details = element.querySelector<HTMLDetailsElement>('.rotation-warnings-wrap');
  const wasOpen = details?.open ?? false;
  const warnings = [
    ...equippedGearWarnings(app),
    ...equippedSkillCastTimeWarnings(app),
    ...(app.build.rotation.length && app.results ? rotationWarningItems(app.results) : [])
  ];
  mountRotationWarnings(element, warnings, { open: wasOpen });
}
