import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import { flattenProfessionState, readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type { SkillDamagePreviewPreparation } from '#gw2/platform/profession-presentation/skill-damage.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import { MAXIMUM_SPINNING_AXES } from '#gw2/professions/thief/core/state.js';

import { PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS } from '#gw2/platform/combos/permanent-field-assumption.js';
import type { RotationStateSnapshotItem } from '#gw2/platform/profession-presentation/types.js';
import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/platform/simulation/randomness.js';
import { THIEF_CORE_ASSUMPTION_CONTROLS } from '#gw2/professions/thief/build/core-assumptions.js';
import { THIEF_STOLEN_SKILL_IDS } from '#gw2/professions/thief/core/mechanics/steal.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import type { ThiefSkill, ThiefState, ThiefUiContext } from '#gw2/professions/thief/types.js';

export function thiefUiState(context: ThiefUiContext = {}): Partial<ThiefState> {
  return flattenProfessionState(context.state?.profession || context.professionState);
}

export function thiefStealPaletteGroups(professionSkillId = ID.STEAL) {
  // Keep the base stolen-skill pool beside Steal so choices stay discoverable before and after they are granted.
  return [
    {
      id: 'thief-profession',
      label: 'F',
      skillIds: [professionSkillId],
      color: '#9a535c',
      resourceAnchor: true,
      stackId: 'thief-stolen-skills',
      className: 'thief-steal-skill'
    },
    {
      id: 'thief-stolen-skills',
      label: 'Stolen',
      skillIds: [...THIEF_STOLEN_SKILL_IDS],
      color: '#9a535c',
      stackId: 'thief-stolen-skills',
      className: 'thief-stolen-skill-choices'
    }
  ];
}

/** Show active trait stacks and skill bonuses alongside weapon trackers and stealth gates. */
function thiefCoreStateSnapshot(context: ThiefUiContext): RotationStateSnapshotItem[] {
  const state = thiefUiState(context);
  const at = Math.max(0, context.atSeconds || 0);
  const items: RotationStateSnapshotItem[] = [];
  // Count at the insertion cursor's time so expired axes disappear even without another axe cast.
  const axes = (state.spinningAxes || []).filter((axe) => axe.expiresAt > at);
  if (axes.length || [context.build?.weapons?.[0], context.build?.alternateWeapons?.[0]].includes('Axe')) {
    items.push({
      id: 'thief-spinning-axes',
      label: 'Spinning Axes',
      value: `${axes.length}/6`,
      title: axes.length
        ? `Grounded axes available to recall; next axe expires in ${(Math.min(...axes.map((axe) => axe.expiresAt)) - at).toFixed(1)}s`
        : 'Grounded axes available to recall'
    });
  }

  // Outgoing axes can be recalled without displacing a grounded axe until their flight finishes.
  if (state.outboundAxes?.length) {
    items.push({
      id: 'thief-outbound-axes',
      label: 'Axes in Flight',
      value: String(state.outboundAxes.length),
      title: 'Outgoing axes available to recall; occupy a spinning-axe slot only after landing'
    });
  }

  // Each initiative-spending grant expires independently, so the count is read at the displayed instant.
  const leadAttacksStacks = activeStackCount(state.leadAttackExpirations || [], at);
  if (leadAttacksStacks > 0) {
    items.push({
      id: 'thief-lead-attacks',
      label: 'Lead Attacks',
      value: `${leadAttacksStacks} stacks`,
      title: 'Active damage-bonus stacks gained from spending initiative'
    });
  }

  for (const [id, label, expiresAt, title] of [
    [
      'thief-distracting-throw',
      'Distracting Throw',
      state.distractingThrowBuffUntil,
      'Time remaining on the outgoing damage bonus granted after a spear finisher'
    ],
    [
      'thief-assassins-signet',
      "Assassin's Signet",
      state.assassinsSignetActiveUntil,
      "Time remaining on Assassin's Signet's active Power bonus"
    ]
  ] as const) {
    const remaining = (expiresAt || 0) - at;
    if (remaining > 0) items.push({ id, label, value: `${remaining.toFixed(1)}s`, title });
  }

  const revealedRemaining = (state.revealedUntil || 0) - at;
  if (revealedRemaining > 0) {
    return [
      ...items,
      {
        id: 'thief-revealed',
        label: 'Revealed',
        value: `${revealedRemaining.toFixed(1)}s`,
        title: 'Time remaining before Stealth can be gained again'
      }
    ];
  }

  const stealthRemaining = (state.stealthStartedAt || 0) <= at ? (state.stealthUntil || 0) - at : 0;
  return stealthRemaining > 0
    ? [
        ...items,
        {
          id: 'thief-stealth',
          label: 'Stealth',
          value: `${stealthRemaining.toFixed(1)}s`,
          title: 'Time remaining in Stealth'
        }
      ]
    : items;
}

export const thiefCoreUi = Object.freeze({
  /** Declare this module's conditional inputs without adding simulation settings. */
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);

    // The existing starting-axe field lets recall skills consume a declared stock without manufacturing hits.
    if ([...context.weapons, ...context.build.alternateWeapons].includes('Axe'))
      preview.add({
        key: 'spinningAxes',
        label: 'Starting axes',
        group: 'Mechanic',
        kind: 'special',
        scope: ['damage'],
        max: MAXIMUM_SPINNING_AXES,
        initial: Number((context.build as { readonly initialSpinningAxes?: unknown }).initialSpinningAxes) || 0,
        description: 'Autoattack axes available before setup; expiry and recall follow the runtime'
      });

    if (preview.has('Revealed Training', 'Hidden Killer'))
      preview.add({
        key: 'revealed',
        label: 'Revealed',
        group: 'Trait conditionals',
        kind: 'special',
        description: 'Revealed Training / Hidden Killer'
      });
    preview.trait('Hidden Killer', { key: 'stealth', kind: 'special', description: 'Stealthed; Critical Chance' });
    preview.targetHealth('Ferocious Strikes');
    preview.playerHealth(['Keen Observer', 'Twin Fangs'], preview.has('Keen Observer') ? 50 : 100);
    if (preview.has('Twin Fangs'))
      preview.add({
        key: 'flanking',
        label: 'Flanking',
        group: 'Trait conditionals',
        kind: 'special',
        description: 'Positional Critical Chance'
      });
    preview.passives("Assassin's Signet");
    return preview.controls;
  },
  /** Axe inputs belong only to the detached damage configuration. */
  prepareSkillDamagePreview: ({ values }: SkillDamagePreviewPreparation) =>
    values.spinningAxes == null ? {} : { initialSpinningAxes: Number(values.spinningAxes) },
  /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
  prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
    const core = readProfessionCoreState<ThiefCoreState>(context.professionState);
    if ('revealed' in context.values) core.revealedUntil = context.values.revealed ? 60 : 0;
    if ('stealth' in context.values) core.stealthUntil = context.values.stealth ? 60 : 0;
  },

  // Stealth owns weapon slot one even when initiative or another cast gate blocks the replacement.
  paletteOverride: (context: ThiefUiContext, skill: ThiefSkill) => {
    if (!skill.stealthAttack) return;
    const state = thiefUiState(context);
    const now = context.time || 0;
    return {
      tileActive:
        ((state.stealthStartedAt || 0) <= now &&
          (state.stealthUntil || 0) > now &&
          (state.revealedUntil || 0) <= now) ||
        ((state.stealthAttackCharges || 0) > 0 && (state.stealthAttackExpiresAt || 0) > now)
    };
  },
  // Equal-duration grants replace oldest stacks, so capping their active sum matches the engine's stack count.
  effectPresentations: (_context: ThiefUiContext) => [
    {
      id: 'thief-lead-attacks',
      kind: 'lead-attacks',
      name: 'Lead Attacks'
    }
  ],
  assumptionControls: Object.freeze([
    ...THIEF_CORE_ASSUMPTION_CONTROLS,
    ...SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS,
    ...PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS
  ]),
  rotationStateSnapshot: thiefCoreStateSnapshot,
  paletteGroups: (context: ThiefUiContext) =>
    (context.specialization || context.config?.specialization || 'Core') === 'Core' ? thiefStealPaletteGroups() : [],
  resourceViews: (context: ThiefUiContext) => {
    const state = thiefUiState(context);
    const enduranceCapacity = context.resources!.endurance!.maximum;
    const endurance = state.endurance ?? enduranceCapacity;
    return [
      {
        id: 'initiative',
        singular: 'initiative',
        plural: 'initiative',
        maximum: state.initiative?.maximum ?? context.resources?.initiative?.maximum ?? 12,
        value: state.initiative?.value ?? context.initialInitiative ?? 12,
        startMaximum: context.resources?.initiative?.maximum ?? state.initiative?.maximum ?? 15,
        canStart: true,
        buildKey: 'initialInitiative',
        step: 1,
        displayMode: 'pips',
        pipStyle: 'thief-initiative',
        pipRows: state.initiativePipRows || 2,
        shortLabel: 'Init',
        statusLabel: 'Current'
      },
      // Reuse the starting-resource editor; the active-state bar already displays the live axe count.
      ...([
        context.build?.weapons?.[0],
        context.build?.alternateWeapons?.[0],
        context.config?.primaryWeapon,
        context.config?.weaponSet2Primary
      ].includes('Axe') || (context.build?.initialSpinningAxes ?? context.config?.initialSpinningAxes ?? 0) > 0
        ? [
            {
              id: 'spinning-axes',
              singular: 'precast autoattack axe',
              plural: 'precast autoattack axes',
              maximum: MAXIMUM_SPINNING_AXES,
              value: (state.spinningAxes || []).filter((axe) => axe.expiresAt > (context.simulationTime ?? 0)).length,
              canStart: true,
              buildKey: 'initialSpinningAxes' as const,
              step: 1,
              displayMode: 'counter',
              showInPalette: false,
              shortLabel: 'Axes',
              statusLabel: 'Current'
            }
          ]
        : []),
      {
        id: 'endurance',
        singular: 'endurance',
        plural: 'endurance',
        // Family composition supplies the active resource policy without exposing its owner.
        maximum: enduranceCapacity,
        value: endurance,
        canStart: false,
        step: 1,
        displayMode: 'bar',
        pipStyle: 'endurance',
        shortLabel: 'End',
        statusLabel: 'Current',
        // Render the endurance meter beneath the Dodge button rather than as a
        // standalone bar, so the resource sits with the action that spends it.
        paletteSkillId: SHARED_SKILL_IDS.DODGE
      }
    ];
  }
});
