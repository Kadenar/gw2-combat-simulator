import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import { createAttributePreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { NecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { flattenProfessionState } from '#gw2/platform/engine/profession/state.js';
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/platform/simulation/randomness.js';
import { PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS } from '#gw2/platform/combos/permanent-field-assumption.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { getActiveTraits } from '#gw2/professions/necromancer/data/traits-data.js';
import type { CanonicalCatalog, SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  ProfessionEffectPresentation,
  ProfessionPaletteGroup,
  ProfessionResourceView
} from '#gw2/platform/profession-presentation/types.js';
import type {
  NecromancerSkill,
  NecromancerState,
  NecromancerUiContext,
  NecromancerUiSlice
} from '#gw2/professions/necromancer/types.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { actualNecromancerLifeForceCost } from '#gw2/professions/necromancer/core/state.js';
import { NECROMANCER_LICH_SKILL_IDS } from '#gw2/professions/necromancer/core/skills/index.js';

const HALF_HEALTH_TRAITS = new Set(['Siphoned Power', 'Spiteful Fortitude', 'Chill of Death', 'Close to Death']);
const NECROMANCER_EFFECT_PRESENTATIONS: readonly ProfessionEffectPresentation[] = Object.freeze([
  {
    id: 'necromancer-taste-for-blood',
    kind: 'taste-for-blood',
    name: 'Taste for Blood'
  },
  {
    id: 'necromancer-soul-barbs',
    kind: 'necromancer-soul-barbs',
    name: 'Soul Barbs',
    maximumStacks: 1
  }
]);

/** Flattens Core and active-specialization state for Necromancer UI projections. */
export function necromancerUiState(context: NecromancerUiContext = {}): Partial<NecromancerState> {
  return flattenProfessionState(context.state?.profession || context.professionState);
}

/** Resolves the specialization name used to select Necromancer UI groups and rules. */
function necromancerUiSpecialization(context: NecromancerUiContext = {}): string {
  return context.specialization || context.config?.specialization || 'Core';
}

// Order the live shroud palette by slot, keeping each flip skill after its parent.
function shroudSkillIds(catalog: Readonly<CanonicalCatalog<NecromancerSkill>>, shroud: string): SkillId[] {
  return catalog.skills
    .filter((skill) => skill.shroud === shroud && !skill.simulatorExcluded)
    .sort((left, right) => {
      const slotOrder = (left.shroudSlot || 0) - (right.shroudSlot || 0);
      if (slotOrder) return slotOrder;
      if (left.flipParentId === right.id) return 1;
      if (right.flipParentId === left.id) return -1;
      return Number(left.id) - Number(right.id);
    })
    .map((skill) => skill.id);
}

/** Builds profession, shroud, Lich, and shared-action palette groups for a Necromancer transform. */
export function necromancerTransformPaletteGroups(
  catalog: Readonly<CanonicalCatalog<NecromancerSkill>>,
  context: NecromancerUiContext,
  {
    entryId,
    exitId,
    shroud,
    professionSkillIds = [],
    stackId = ''
  }: {
    readonly entryId?: SkillId;
    readonly exitId?: SkillId;
    readonly shroud?: string;
    readonly professionSkillIds?: readonly SkillId[];
    readonly stackId?: string;
  }
): ProfessionPaletteGroup[] {
  const state = necromancerUiState(context);
  // The profession group anchors transform controls and the shared Soul Shard resource.
  const groups: ProfessionPaletteGroup[] = [
    {
      id: 'profession',
      label: 'F',
      skillIds: [...(entryId == null ? [] : [entryId]), ...(exitId == null ? [] : [exitId]), ...professionSkillIds],
      color: '#57a86b',
      className: 'compact-resource-palette necromancer-f-skills',
      // Spear shards belong beside the profession mechanic that consumes and supports them across every specialization.
      resourceIds: ['soul-shards'],
      resourcePlacement: 'beside',
      resourceAnchor: true,
      stackId
    }
  ];
  // Active transform bars stack with the profession group while Lich is projected from runtime state.
  const shroudSkills = shroud ? shroudSkillIds(catalog, shroud) : [];
  if (shroudSkills.length) {
    groups.push({
      id: 'shroud',
      label: 'Sh',
      skillIds: [...new Set(shroudSkills)],
      color: '#4d9560',
      stackId
    });
  }

  if (state.activeShroud === 'lich') {
    groups.push({
      id: 'lich',
      label: 'Lch',
      skillIds: [...NECROMANCER_LICH_SKILL_IDS],
      color: '#78b886'
    });
  }

  groups.push({
    id: 'necromancer-actions',
    label: 'Act',
    skillIds: [SHARED_SKILL_IDS.SWAP_WEAPONS, SHARED_SKILL_IDS.DODGE],
    color: '#7fbd8b'
  });
  return groups;
}

/** Returns target-health boundaries required by selected traits and threshold-dependent weapons. */
export function necromancerCoreTargetHealthThresholds(context: NecromancerUiContext = {}): number[] {
  const build = context.build || {};
  const traits = getActiveTraits(build.specializations || []);
  const hasHalfHealthTrait = traits.some((trait) => HALF_HEALTH_TRAITS.has(trait.name));
  const weapons = [...(build.weapons || []), ...(build.alternateWeapons || [])];
  const hasThresholdWeapon = weapons.some((weapon) => weapon === 'Greatsword' || weapon === 'Spear');
  return hasHalfHealthTrait || hasThresholdWeapon ? [0.5] : [];
}

/** Reads the shared grant directly when a spear is equipped or shard state is already active. */
export function necromancerSoulShardResourceViews(context: NecromancerUiContext): ProfessionResourceView[] {
  const state = necromancerUiState(context);
  // Inspect both build loadouts and runtime-resolved primary weapons so the resource appears before simulation.
  const equippedWeapons = [
    ...(context.build?.weapons || []),
    ...(context.build?.alternateWeapons || []),
    gw2PrimaryWeapon(context.config, 1),
    gw2PrimaryWeapon(context.config, 2)
  ];
  return equippedWeapons.includes('Spear') || (state.soulShardGrant?.charges || 0) > 0
    ? [
        {
          id: 'soul-shards',
          singular: 'soul shard',
          plural: 'soul shards',
          maximum: 6,
          value: state.soulShardGrant?.charges || 0,
          canStart: false,
          step: 1,
          displayMode: 'counter',
          pipStyle: 'necromancer-soul-shards',
          shortLabel: 'Soul',
          statusLabel: 'Current',
          showValue: false
        }
      ]
    : [];
}

// Project whole life-force points from the build multiplier; the resource and starting input remain percentages.
function necromancerCoreResourceViews(context: NecromancerUiContext): ProfessionResourceView[] {
  const state = necromancerUiState(context);
  // Before a simulation supplies its build multiplier, the detached preview can only show the percentage meter.
  const maximum =
    state.lifeForceCostMultiplier == null ? 100 : actualNecromancerLifeForceCost(100) / state.lifeForceCostMultiplier;
  const views: ProfessionResourceView[] = [
    {
      id: 'life-force',
      singular: 'life force',
      plural: 'life force',
      maximum: Math.round(maximum),
      value: Math.round(
        (Number(state.lifeForce?.value ?? context.value ?? context.initialResource ?? 100) * maximum) / 100
      ),
      startMaximum: 100,
      canStart: true,
      buildKey: 'initialResource',
      step: 1,
      displayMode: 'bar',
      pipStyle: 'compact-profession-resource-necromancer-life-force',
      shortLabel: 'LF',
      statusLabel: 'Current'
    }
  ];
  if (necromancerUiSpecialization(context) === 'Core') views.push(...necromancerSoulShardResourceViews(context));
  return views;
}

/** Captures this UI's catalog so other profession instances cannot change its projections. */
export function bindNecromancerCoreUi(catalog: Readonly<CanonicalCatalog<NecromancerSkill>>): NecromancerUiSlice {
  return Object.freeze({
    /** Declare this module's conditional inputs without adding simulation settings. */
    attributePreviewControls(context: ProfessionAttributePreviewContext) {
      const preview = createAttributePreviewControls(context);

      preview.trait('Deadly Strength', {
        key: 'carapace',
        kind: 'special',
        max: 30,
        description: "Death's Carapace stacks"
      });
      preview.passives('Signet of Spite');
      return preview.controls;
    },
    /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
    prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
      const core = readProfessionCoreState<NecromancerCoreState>(context.professionState);
      if ('carapace' in context.values) core.carapaceExpiries = Array(Number(context.values.carapace)).fill(60);
      if ('shroud' in context.values) core.activeShroud = context.values.shroud ? 'death' : '';
    },

    // Tile identity follows the active bar even when the visible skill cannot currently be cast.
    paletteOverride: (context, skill) => {
      const active = necromancerUiState(context).activeShroud || '';
      if (skill.shroudEntry) return { tileActive: active !== skill.shroudEntry };
      if (skill.shroudExit) return { tileActive: active === skill.shroudExit };
    },
    // Self conditions are observable transfer resources; they never imply simulated incoming player damage.
    eventLogRow: (_context: NecromancerUiContext, event: SimulationEvent) =>
      event.type === 'self_condition'
        ? {
            type: 'Self condition',
            description: String(event.name ?? event.condition ?? 'Self condition'),
            className: 'event-condition',
            order: 0
          }
        : undefined,
    assumptionControls: [...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS, ...PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS],
    // Core owns both labels because the effects remain available across Necromancer specializations.
    effectPresentations: () => [...NECROMANCER_EFFECT_PRESENTATIONS],

    targetHealthThresholds: necromancerCoreTargetHealthThresholds,
    paletteGroups: (context: NecromancerUiContext) =>
      necromancerUiSpecialization(context) === 'Core'
        ? necromancerTransformPaletteGroups(catalog, context, {
            entryId: ID.DEATH_SHROUD,
            exitId: ID.END_DEATH_SHROUD,
            shroud: 'death',
            stackId: 'core-profession'
          })
        : [],
    resourceViews: necromancerCoreResourceViews
  });
}
