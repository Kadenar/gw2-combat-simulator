import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import { timedBuffAt } from '#gw2/platform/results/query.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import {
  formatSecondsRemaining,
  guardianSnapshotAt,
  guardianUiSkillIdsByName,
  guardianUiSkillsByMode
} from '#gw2/professions/guardian/core/presentation.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';
import type {
  PaletteSkillAvailability,
  ProfessionEventLogDescriptor,
  RotationStateSnapshotItem,
  SchedulerRecord
} from '#gw2/platform/engine/types.js';
import type {
  GuardianResolverEvent,
  GuardianSkill,
  GuardianState,
  GuardianUiContext
} from '#gw2/professions/guardian/types.js';

const LUMINARY_INTERNAL_EVENT_TYPES = new Set([
  'guardian.effulgent-activated',
  'guardian.effulgent-detonate',
  'guardian.luminary.light-aura-detonate',
  'guardian.luminary.light-aura-grant'
]);

function luminaryEventLogRow(
  _context: SchedulerRecord,
  event: GuardianResolverEvent
): ProfessionEventLogDescriptor | null | undefined {
  // null = suppress this event from the log entirely (internal bookkeeping
  // events that have no meaningful display for the user).
  if (LUMINARY_INTERNAL_EVENT_TYPES.has(event.type)) return null;
  // undefined = not handled here; let the default renderer decide.
  if (event.type !== 'guardian.radiant-forge-entered' && event.type !== 'guardian.radiant-forge-exited')
    return undefined;
  const entered = event.type.endsWith('-entered');
  return {
    type: event.type,
    description: `RADIANT FORGE ${entered ? 'ENTERED' : 'EXITED'}` + `${event.automatic ? ' [automatic]' : ''}`,
    className: 'resource',
    order: 30,
    flags: []
  };
}

const VIRTUE_NAMES = Object.freeze(['Radiant Justice', 'Radiant Resolve', 'Radiant Courage', 'Enter Radiant Forge']);

// Radiant Forge flip skills occupy their primary skill's slot, so the compact
// preview renders each replacement beneath its primary instead of as a sixth row item.
const RADIANT_FORGE_INSPECTION_CHAIN_ROOTS = Object.freeze({
  [ID.SHINING_SPIN]: ID.DAZZLING_HAMMER,
  [ID.RESTORATIVE_GLOW]: ID.LUMINOUS_STAFF,
  [ID.LUCENT_THRUST]: ID.GLEAMING_BLADE,
  [ID.BRILLIANT_SLAM]: ID.RADIANT_BULWARK
});

function professionState(context: GuardianUiContext): Partial<GuardianState> {
  // flattenProfessionState merges core and specialization sub-objects so
  // callers can read luminary fields without knowing the nested shape.
  return flattenProfessionState(context.state?.profession || context.professionState);
}

function luminaryStateSnapshot(context: GuardianUiContext): RotationStateSnapshotItem[] {
  const result = context.result as Gw2SimulationResult | null | undefined;
  const at = guardianSnapshotAt(context);
  const items: RotationStateSnapshotItem[] = [];
  const state = professionState(context);
  // Expose Light Aura while it can still be consumed by Luminary skills.
  const lightAuraRemaining = Number(state.lightAuraUntil || 0) - at;
  if (lightAuraRemaining > 0) {
    items.push({
      id: 'luminary-light-aura',
      label: 'Light Aura',
      value: formatSecondsRemaining(lightAuraRemaining),
      title: 'Time until Light Aura expires'
    });
  }

  const effulgentRemaining = Number(state.effulgentActiveUntil || 0) - at;
  if (effulgentRemaining > 0) {
    const stacks = Math.max(0, Math.min(10, Math.trunc(Number(state.effulgentStacks || 0))));
    items.push({
      id: 'luminary-effulgent-stance',
      label: 'Effulgent Stance',
      value: `${stacks}/10 · ${formatSecondsRemaining(effulgentRemaining)}`,
      title: 'Effulgent stacks and time until detonation'
    });
  }

  // Radiant Armaments only grants +7% strike damage while the radiant hammer
  // (Dazzling Hammer) is the equipped armament; other radiant weapons still
  // emit the buff but strip the bonus, so mirror the modifier's hammer gate.
  const radiant = timedBuffAt(result, 'guardian-radiant-armaments', at);
  if (radiant && radiant.event.metadata?.radiantWeapon === 'hammer') {
    items.push({
      id: 'luminary-radiant-armaments',
      label: 'Radiant Armaments',
      value: formatSecondsRemaining(radiant.remaining),
      title: 'Dazzling Hammer: +7% strike damage'
    });
  }

  const piercing = timedBuffAt(result, 'guardian-piercing-stance', at);
  if (piercing) {
    items.push({
      id: 'luminary-piercing-stance',
      label: 'Piercing Stance',
      value: formatSecondsRemaining(piercing.remaining),
      title: 'Piercing Stance: +10% strike damage'
    });
  }

  const daring = timedBuffAt(result, 'guardian-daring-advance', at);
  if (daring) {
    items.push({
      id: 'luminary-daring-advance',
      label: 'Daring Advance',
      value: formatSecondsRemaining(daring.remaining),
      title: 'Daring Advance: +15% strike damage'
    });
  }

  return items;
}

export const luminaryUi = Object.freeze({
  eventLogRow: luminaryEventLogRow,
  rotationStateSnapshot: luminaryStateSnapshot,
  skillBarGroups: (context: GuardianUiContext) => [
    {
      id: 'guardian-f-keys',
      label: 'F Keys',
      skillIds: guardianUiSkillIdsByName(VIRTUE_NAMES, context),
      color: '#2f7eb8'
    },
    {
      id: 'guardian-radiant-forge',
      label: 'Radiant Forge',
      skillIds: guardianUiSkillsByMode('radiantForgeSkill'),
      color: '#d6b85c',
      inspectionChainRoots: RADIANT_FORGE_INSPECTION_CHAIN_ROOTS
    }
  ],
  paletteGroups: (context: GuardianUiContext) => [
    {
      id: 'profession',
      label: 'F',
      skillIds: guardianUiSkillIdsByName(VIRTUE_NAMES, context),
      color: '#2f7eb8',
      resourceAnchor: true,
      stackId: 'luminary-profession'
    },
    {
      id: 'radiant-forge',
      label: 'RF',
      skillIds: guardianUiSkillsByMode('radiantForgeSkill'),
      color: '#d6b85c',
      // Same stackId as the F-key group so these two groups share a single
      // palette column; they are mutually exclusive at runtime.
      stackId: 'luminary-profession'
    }
  ],
  paletteSkillAvailability: (context: GuardianUiContext, skill: GuardianSkill): PaletteSkillAvailability => {
    const state = professionState(context);
    if (skill.type === 'Weapon' && state.radiantForge) {
      return {
        available: false,
        message: 'Weapon skills are unavailable during Radiant Forge'
      };
    }

    if (skill.radiantForgeSkill && !state.radiantForge) {
      return {
        available: false,
        message: 'Enter Radiant Forge to use this skill'
      };
    }

    if (skill.name === 'Enter Radiant Forge' && state.radiantForge) {
      return {
        available: false,
        message: 'Radiant Forge is already active'
      };
    }

    if (skill.name === 'Exit Radiant Forge' && !state.radiantForge) {
      return {
        available: false,
        message: 'Radiant Forge is not active'
      };
    }

    return { available: true, message: '' };
  }
});
