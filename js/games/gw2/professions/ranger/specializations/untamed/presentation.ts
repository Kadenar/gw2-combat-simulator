import { activeRefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { CanonicalCatalog, Skill as PreviewSkill, SkillId } from '#gw2/platform/skills/types.js';
import type {
  SkillDamagePreviewContext,
  SkillDamagePreviewPreparation,
  SkillDamageState
} from '#gw2/platform/profession-presentation/skill-damage.js';
import type { RotationStateSnapshotItem } from '#gw2/platform/profession-presentation/types.js';
import { rangerPetPaletteGroup, rangerUiState } from '#gw2/professions/ranger/core/presentation.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerSkill, RangerUiContext, RangerUiSlice } from '#gw2/professions/ranger/types.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { boundedInteger } from '#kernel/core/numeric.js';

function initialUntamedState(context: RangerUiContext): 'Pet' | 'Ranger' {
  return context.build?.initialUntamedState === 'Ranger' || context.config?.initialUntamedState === 'Ranger'
    ? 'Ranger'
    : 'Pet';
}

function stateOption(catalog: Readonly<CanonicalCatalog<RangerSkill>>, value: 'Pet' | 'Ranger', skillId: SkillId) {
  const skill = catalog.skillsById.get(skillId);
  return {
    value,
    label: `Unleashed ${value}`,
    icon: skill?.icon || '',
    description: `Begin the rotation with the ${value.toLowerCase()} unleashed.`
  };
}

/** Reports the weapon ambush deadline and each beneficiary's Ferocious Symbiosis stacks. */
function untamedStateSnapshot(context: RangerUiContext, maximumStacks: number): RotationStateSnapshotItem[] {
  const state = rangerUiState(context);
  const at = Math.max(0, context.atSeconds || 0);
  const items: RotationStateSnapshotItem[] = [];
  const ambushRemaining = (state.ambushReadyUntil || 0) - at;
  if (ambushRemaining > 0) {
    items.push({
      id: 'untamed-ambush-window',
      label: 'Untamed Ambush',
      value: `${ambushRemaining.toFixed(1)}s`,
      title: 'Time remaining to use the unleashed ambush'
    });
  }

  // Both read paths query the canonical beneficiary pool without settling live state.
  for (const [id, beneficiary, pool] of [
    ['untamed-ferocious-symbiosis-player', 'Player', state.ferociousSymbiosisPlayer],
    ['untamed-ferocious-symbiosis-pet', 'Pet', state.ferociousSymbiosisPet]
  ] as const) {
    const remaining = (pool?.expiresAt || 0) - at;
    const stacks = boundedInteger(activeRefreshedStacks(pool, at, 'exclusive'), 0, 0, maximumStacks);
    if (stacks <= 0) continue;
    items.push({
      id,
      label: `Ferocious Symbiosis (${beneficiary})`,
      value: `${stacks}/${maximumStacks} · ${remaining.toFixed(1)}s`,
      title: `${beneficiary} damage stacks and time remaining`
    });
  }

  return items;
}

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindUntamedUi(catalog: Readonly<CanonicalCatalog<RangerSkill>>): RangerUiSlice {
  const petSkillIds = catalog.skills.filter((skill) => skill.unleashedPetSkill).map((skill) => skill.id);
  return Object.freeze({
    /** Ordinary weapon rows use the selected start state; ambush rows still perform their required transition. */
    previewControls(context) {
      const preview = createPreviewControls(context);
      // Expose held combat bonuses to isolated damage calculations.
      if (preview.has('Ferocious Symbiosis'))
        preview.trait('Ferocious Symbiosis', {
          key: 'ferociousSymbiosis',
          kind: 'special',
          scope: ['damage'],
          max: preview.maximumStacks('Ferocious Symbiosis'),
          description: 'Player damage stacks earned by pet attacks'
        });
      preview.add({
        key: 'unleashed',
        label: 'Start unleashed',
        group: 'Mechanic',
        kind: 'special',
        scope: ['damage'],
        options: ['Pet', 'Ranger'],
        initial: initialUntamedState({ build: context.build }),
        description: 'Owner of the unleashed damage bonuses before setup'
      });
      return preview.controls;
    },
    prepareSkillDamagePreview: ({ values }: SkillDamagePreviewPreparation) => ({
      initialUntamedState: values.unleashed
    }),
    /** Declare the damage context for one assumed occurrence. */
    skillDamageState(_context: SkillDamagePreviewContext, input: PreviewSkill): SkillDamageState | null {
      const skill = input as RangerSkill;
      if (skill.unleashedAmbushSkill) return { config: { initialUntamedState: 'Pet' } };
      if (skill.unleashedPetSkill || skill.id === ID.UNLEASH_RANGER) return { config: { initialUntamedState: 'Pet' } };
      if (skill.id === ID.UNLEASH_PET) return { config: { initialUntamedState: 'Ranger' } };
      // Ordinary pet command skills belong to the ranger-unleashed bar, unlike the unleashed pet replacements.
      if (skill.petSkill) return { config: { initialUntamedState: 'Ranger' } };
      return null;
    },

    // Tile identity follows the active bar even when the visible skill cannot currently be cast.
    paletteOverride: (context, skill) => {
      const state = rangerUiState(context);
      if (skill.id === ID.UNLEASH_RANGER || skill.id === ID.UNLEASH_PET)
        return { tileActive: (skill.id === ID.UNLEASH_PET) === Boolean(state.rangerUnleashed) };
      if (skill.unleashedAmbushSkill)
        return { tileActive: Boolean(state.rangerUnleashed) && (context.time || 0) < (state.ambushReadyUntil || 0) };
    },
    startControls: (context: RangerUiContext) => [
      {
        label: 'Start unleashed',
        buildKey: 'initialUntamedState',
        value: initialUntamedState(context),
        options: [stateOption(catalog, 'Pet', ID.UNLEASH_PET), stateOption(catalog, 'Ranger', ID.UNLEASH_RANGER)],
        color: '#3f9b64'
      }
    ],
    paletteGroups: (context: RangerUiContext) => [
      rangerPetPaletteGroup(catalog, context),
      {
        id: 'ranger-untamed-profession',
        label: 'Unleash',
        skillIds: [ID.UNLEASH_RANGER, ID.UNLEASH_PET, ...petSkillIds],
        color: '#3f9b64',
        resourceAnchor: true
      }
    ],
    // Snapshot labels use the same selected cap as damage and stack grants.
    rotationStateSnapshot: (context) =>
      untamedStateSnapshot(
        context,
        balanceProfileNumber(
          requireBalanceProfileFromContext(context.balanceContext, TRAIT.FEROCIOUS_SYMBIOSIS),
          'maximumStacks'
        )
      )
    // Unleash synchronization is internal state bookkeeping, not a player-facing combat event.
  });
}
