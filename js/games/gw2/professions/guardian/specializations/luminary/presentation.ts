import { GUARDIAN_SKILL_IDS } from '#gw2/professions/guardian/data/ids.js';
import type { CanonicalCatalog } from '#gw2/platform/engine/skills/types.js';
import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import { timedBuffAt } from '#gw2/platform/results/query.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { requireBalanceNumber } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/luminary/profiles.js';
import {
  formatSecondsRemaining,
  guardianSnapshotAt,
  guardianUiSkillIdsByName,
  guardianUiSkillsByMode
} from '#gw2/professions/guardian/core/presentation.js';

import type {
  ProfessionEffectPresentation,
  ProfessionEventLogDescriptor,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import type {
  GuardianResolverEvent,
  GuardianSkill,
  GuardianState,
  GuardianUiContext,
  GuardianUiSlice
} from '#gw2/professions/guardian/types.js';
import { boundedInteger } from '#kernel/core/numeric.js';

/** Render actual weapon-bar transitions at their executed boundary. */
function luminaryEventLogRow(
  _context: GuardianUiContext,
  event: GuardianResolverEvent
): ProfessionEventLogDescriptor | undefined {
  if (
    event.type !== 'weapon_set' ||
    ![GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE, GUARDIAN_SKILL_IDS.EXIT_RADIANT_FORGE].some((id) => id === event.skillId)
  )
    return undefined;
  const entered = event.skillId === GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE;
  return {
    type: event.type,
    description: 'RADIANT FORGE ' + (entered ? 'ENTERED' : 'EXITED') + (event.automatic ? ' [automatic]' : ''),
    className: 'resource',
    order: 30,
    flags: []
  };
}

const VIRTUE_NAMES = Object.freeze(['Radiant Justice', 'Radiant Resolve', 'Radiant Courage', 'Enter Radiant Forge']);
const RADIANT_ARMAMENT_NAMES: Readonly<Record<string, string>> = Object.freeze({
  hammer: 'Hammer',
  staff: 'Staff',
  blade: 'Sword',
  bulwark: 'Shield'
});

/** Read selected modifier values without running combat predicates; round away percentage arithmetic noise. */
function strikeBonus(context: GuardianUiContext, id: string, field: 'amount' | 'factor'): string {
  const value = requireBalanceNumber(
    context.balanceContext?.modifierRulesById.get(id)?.[field],
    `modifier=${id} field=${field}`
  );
  const percent = Number(((field === 'factor' ? value - 1 : value) * 100).toPrecision(8));
  return `${percent > 0 ? '+' : ''}${percent}%`;
}

function luminaryStateSnapshot(context: GuardianUiContext): RotationStateSnapshotItem[] {
  const result = context.result;
  const at = guardianSnapshotAt(context);
  const items: RotationStateSnapshotItem[] = [];
  const state = professionState(context);
  // Expose Light Aura while it can still be consumed by Luminary skills.
  const lightAuraRemaining = (state.lightAuraUntil || 0) - at;
  if (lightAuraRemaining > 0) {
    items.push({
      id: 'luminary-light-aura',
      label: 'Light Aura',
      value: formatSecondsRemaining(lightAuraRemaining),
      title: 'Time until Light Aura expires'
    });
  }

  const effulgentRemaining = (state.effulgentActiveUntil || 0) - at;
  if (effulgentRemaining > 0) {
    // Display the selected cap, including patches that allow more than the baseline stack count.
    const maximum = balanceProfileNumber(
      requireBalanceProfileFromContext(context.balanceContext, PROFILE.effulgentStance),
      'maximumStacks'
    );
    const stacks = boundedInteger(state.effulgentStacks || 0, 0, 0, maximum);
    items.push({
      id: 'luminary-effulgent-stance',
      label: 'Effulgent Stance',
      value: `${stacks}/${maximum} · ${formatSecondsRemaining(effulgentRemaining)}`,
      title: 'Effulgent stacks and time until detonation'
    });
  }

  // Mirror the hammer-only modifier gate and read each bonus from the selected patch's rules.
  const radiant = timedBuffAt(result, 'guardian-radiant-armaments', at);
  if (radiant && radiant.event.metadata?.radiantWeapon === 'hammer') {
    items.push({
      id: 'luminary-radiant-armaments',
      label: 'Radiant Armaments',
      value: formatSecondsRemaining(radiant.remaining),
      title: `Dazzling Hammer: ${strikeBonus(context, 'guardian.radiant-armaments', 'amount')} strike damage`
    });
  }

  const piercing = timedBuffAt(result, 'guardian-piercing-stance', at);
  if (piercing) {
    items.push({
      id: 'luminary-piercing-stance',
      label: 'Piercing Stance',
      value: formatSecondsRemaining(piercing.remaining),
      title: `Piercing Stance: ${strikeBonus(context, 'guardian.piercing-stance', 'amount')} strike damage`
    });
  }

  const daring = timedBuffAt(result, 'guardian-daring-advance', at);
  if (daring) {
    items.push({
      id: 'luminary-daring-advance',
      label: 'Daring Advance',
      value: formatSecondsRemaining(daring.remaining),
      title: `Daring Advance: ${strikeBonus(context, 'guardian.daring-advance', 'factor')} strike damage`
    });
  }

  return items;
}

/** Labels Luminary armament effects and makes mutually exclusive radiant weapons replace one another. */
function luminaryEffectPresentations(): ProfessionEffectPresentation[] {
  return [
    {
      id: 'guardian-empowered-armaments',
      kind: 'guardian-empowered-armaments',
      name: 'Empowered Armaments',
      maximumStacks: 1
    },
    {
      id: 'guardian-radiant-armaments',
      kind: 'guardian-radiant-armaments',
      name: (event) => {
        const weapon = RADIANT_ARMAMENT_NAMES[event.metadata?.radiantWeapon || ''];
        return weapon ? `Radiant Armaments (${weapon})` : 'Radiant Armaments';
      },
      maximumStacks: 1,
      replacementGroup: 'guardian-radiant-armaments'
    }
  ];
}

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindLuminaryUi(catalog: Readonly<CanonicalCatalog<GuardianSkill>>): GuardianUiSlice {
  return Object.freeze({
    // Tile identity follows the active bar even when the visible skill cannot currently be cast.
    paletteOverride: (context, skill) => {
      if (skill.id === GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE || skill.id === GUARDIAN_SKILL_IDS.EXIT_RADIANT_FORGE)
        return {
          tileActive:
            (skill.id === GUARDIAN_SKILL_IDS.EXIT_RADIANT_FORGE) === Boolean(professionState(context).radiantForge)
        };
    },
    effectPresentations: luminaryEffectPresentations,
    eventLogRow: luminaryEventLogRow,
    rotationStateSnapshot: luminaryStateSnapshot,
    paletteGroups: (context: GuardianUiContext) => [
      {
        id: 'profession',
        label: 'F',
        skillIds: guardianUiSkillIdsByName(catalog, VIRTUE_NAMES, context),
        color: '#2f7eb8',
        resourceAnchor: true,
        stackId: 'luminary-profession'
      },
      {
        id: 'radiant-forge',
        label: 'RF',
        skillIds: guardianUiSkillsByMode(catalog, 'radiantForgeSkill'),
        color: '#d6b85c',
        // Same stackId as the F-key group so these two groups share a single
        // palette column; they are mutually exclusive at runtime.
        stackId: 'luminary-profession'
      }
    ]
  });
}

function professionState(context: GuardianUiContext): Partial<GuardianState> {
  // flattenProfessionState merges core and specialization sub-objects so
  // callers can read luminary fields without knowing the nested shape.
  return flattenProfessionState(context.state?.profession || context.professionState);
}
