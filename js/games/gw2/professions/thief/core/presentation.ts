import { SIMULATION_RANDOMNESS_ASSUMPTION_CONTROLS } from '#gw2/platform/builds/randomness-assumptions.js';
import { activeChargeCount } from '#gw2/platform/combat/resources/charges.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import { stealthActive } from '#gw2/platform/combat/stealth.js';
import { PERMANENT_COMBO_FIELD_ASSUMPTION_CONTROLS } from '#gw2/platform/combos/permanent-field-assumption.js';
import { STATUS, WEAPON } from '#gw2/platform/constants.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type { SkillDamagePreviewPreparation } from '#gw2/platform/profession-presentation/skill-damage.js';
import type {
  ProfessionCatalogContext,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { planningBuffAt } from '#gw2/platform/results/result-queries.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { selectedTraits } from '#gw2/professions/shared/trait-data.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { THIEF_CORE_ASSUMPTION_CONTROLS } from '#gw2/professions/thief/build/core-assumptions.js';
import { thiefInitiativeCapacity } from '#gw2/professions/thief/core/mechanics/resources.js';
import { THIEF_STOLEN_SKILL_IDS } from '#gw2/professions/thief/core/mechanics/steal.js';
import type { ThiefCoreState } from '#gw2/professions/thief/core/state.js';
import { MAXIMUM_SPINNING_AXES } from '#gw2/professions/thief/core/state.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { preStealResourceView } from '#gw2/professions/thief/family-presentation.js';
import type { ThiefPlanningState, ThiefSkill, ThiefUiContext } from '#gw2/professions/thief/types.js';

export function thiefUiState(context: ThiefUiContext = {}): Partial<ThiefPlanningState> {
  // Presentation callers supply the flat projection for the inspected rotation point.
  return context.professionState ?? {};
}

export function thiefStealPaletteGroups() {
  // Keep the base stolen-skill pool beside Steal so choices stay discoverable before and after they are granted.
  return [
    {
      id: 'thief-profession',
      label: 'F',
      skillIds: [ID.STEAL],
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
  const axes = (state[STATE.SPINNING_AXES] || []).filter((axe) => axe.expiresAt > at);

  if (axes.length || [context.build?.weapons?.[0], context.build?.alternateWeapons?.[0]].includes(WEAPON.AXE)) {
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
  if (state[STATE.OUTBOUND_AXES]?.length) {
    items.push({
      id: 'thief-outbound-axes',
      label: 'Axes in Flight',
      value: String(state[STATE.OUTBOUND_AXES]?.length ?? 0),
      title: 'Outgoing axes available to recall; occupy a spinning-axe slot only after landing'
    });
  }

  // Each initiative-spending grant expires independently, so the count is read at the displayed instant.
  const leadAttacksStacks = activeStackCount(state[STATE.LEAD_ATTACK_EXPIRATIONS] || [], at);

  if (leadAttacksStacks > 0) {
    items.push({
      id: 'thief-lead-attacks',
      label: 'Lead Attacks',
      value: `${leadAttacksStacks} stacks`,
      title: 'Active damage-bonus stacks gained from spending initiative'
    });
  }

  for (const [id, label, kind, title] of [
    [
      'thief-distracting-throw',
      'Distracting Throw',
      'distracting-throw',
      'Time remaining on the outgoing damage bonus granted after a spear finisher'
    ],
    [
      'thief-assassins-signet',
      "Assassin's Signet",
      'assassins-signet',
      "Time remaining on Assassin's Signet's active Power bonus"
    ]
  ] as const) {
    const remaining = planningBuffAt(context.planningState, kind)?.remaining ?? 0;

    if (remaining > 0) items.push({ id, label, value: `${remaining.toFixed(1)}s`, title });
  }

  const revealedRemaining = (state[STATE.REVEALED_UNTIL] || 0) - at;

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

  const stealthRemaining = stealthActive(
    {
      stealthStartedAt: state[STATE.STEALTH_STARTED_AT],
      stealthUntil: state[STATE.STEALTH_UNTIL],
      revealedUntil: state[STATE.REVEALED_UNTIL]
    },
    at
  )
    ? state[STATE.STEALTH_UNTIL]! - at
    : 0;
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
    // Expose held combat bonuses to isolated damage calculations.
    preview.damageBuff('Fluid Strikes', 'fluidStrikes', 'fluid-strikes');

    if (context.weapons.includes(WEAPON.SPEAR))
      preview.add({
        key: 'distractingThrow',
        label: 'Distracting Throw',
        group: 'Other buffs',
        kind: 'buff',
        field: 'distracting-throw',
        scope: ['damage'],
        description: 'Finisher damage bonus active'
      });

    // Damage-only stack assumptions appear only while their owning trait is selected.
    if (preview.has('Lead Attacks'))
      preview.trait('Lead Attacks', {
        key: 'leadAttacks',
        kind: 'special',
        scope: ['damage'],
        max: preview.maximumStacks('Lead Attacks'),
        description: 'Active stacks increasing strike and condition damage'
      });

    // The existing starting-axe field lets recall skills consume a declared stock without manufacturing hits.
    if ([...context.weapons, ...context.build.alternateWeapons].includes(WEAPON.AXE))
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

    // Revealed only affects Revealed Training; Hidden Killer uses the separate Stealth preview.
    if (preview.has('Revealed Training'))
      preview.add({
        key: 'revealed',
        scope: ['attributes', 'damage'],
        label: 'Revealed',
        group: 'Trait conditionals',
        kind: 'special',
        description: 'Revealed Training'
      });

    preview.trait('Hidden Killer', {
      key: STATUS.STEALTH,
      kind: 'special',
      scope: ['attributes', 'damage'],
      description: 'Stealthed; Critical Chance'
    });
    preview.targetHealth(TRAIT.FEROCIOUS_STRIKES);
    // Unsuspecting Strike's health-dependent Bleeding is procedural, without a coefficient modifier to inspect.
    preview.damageTargetHealth(preview.hasId(TRAIT.EXECUTIONER) || context.weapons.includes(WEAPON.SPEAR));
    preview.playerHealth(['Keen Observer', 'Twin Fangs'], preview.has('Keen Observer') ? 50 : 100);

    if (preview.has('Twin Fangs'))
      preview.add({
        key: 'flanking',
        label: 'Flanking',
        group: 'Trait conditionals',
        kind: 'special',
        description: 'Positional Critical Chance'
      });

    // Active replaces the passive; Off represents the signet's inactive recharge window.
    if (preview.skills.has(ID.ASSASSINS_SIGNET))
      preview.add({
        key: 'assassinsSignet',
        label: "Assassin's Signet",
        group: 'Other buffs',
        kind: 'special',
        scope: ['attributes', 'damage'],
        options: ['off', 'passive', 'active'],
        optionLabels: { off: 'Off', passive: 'Passive', active: 'Active' },
        initial: 'passive',
        description: 'Passive Power, active Power bonus, or neither'
      });

    return preview.controls;
  },
  /** Seed selected axes and the held active signet buff only in the detached damage configuration. */
  prepareSkillDamagePreview: ({ values }: SkillDamagePreviewPreparation) => ({
    ...(values.spinningAxes == null ? {} : { initialSpinningAxes: Number(values.spinningAxes) }),
    initialBuffs: values.assassinsSignet === 'active' ? [{ kind: 'assassins-signet', stacks: 1, duration: 3600 }] : []
  }),
  /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
  prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
    const core = readProfessionCoreState<ThiefCoreState>(context.professionState);

    // Off and Active use the detached readiness policy without adding a second combat cooldown owner.
    if ('assassinsSignet' in context.values && context.values.assassinsSignet !== 'passive')
      context.setSkillOnCooldown(ID.ASSASSINS_SIGNET);

    if (context.values.assassinsSignet === 'active') context.addBuff('assassins-signet', 1, "Assassin's Signet");

    if ('revealed' in context.values) core.revealedUntil = context.values.revealed ? 60 : 0;

    if (STATUS.STEALTH in context.values) core.stealthUntil = context.values.stealth ? 60 : 0;
  },

  // Stealth owns weapon slot one even when initiative or another cast gate blocks the replacement.
  paletteOverride: (context: ThiefUiContext, skill: ThiefSkill) => {
    if (!skill.stealthAttack) return;

    const state = thiefUiState(context);
    const now = context.time || 0;
    return {
      tileActive:
        stealthActive(
          {
            stealthStartedAt: state[STATE.STEALTH_STARTED_AT],
            stealthUntil: state[STATE.STEALTH_UNTIL],
            revealedUntil: state[STATE.REVEALED_UNTIL]
          },
          now
        ) || activeChargeCount(state[STATE.BONUS_STEALTH_ATTACK], now) > 0
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
  // Keep target-health milestones visible across Thief specializations, including Heartseeker's execute band.
  targetHealthThresholds: () => [0.8, 0.5, 0.25],
  paletteGroups: (context: ThiefUiContext) =>
    (context.specialization || context.config?.specialization || 'Core') === 'Core' ? thiefStealPaletteGroups() : [],
  resourceViews: (context: ThiefUiContext & ProfessionCatalogContext) => {
    const state = thiefUiState(context);
    const specialization = context.specialization || context.config?.specialization || 'Core';
    // Starting controls resolve saved traits against the active patch so Preparedness permits all 15 points.
    const initiativeCapacity = context.build
      ? thiefInitiativeCapacity({
          ...context,
          traits: new Set(selectedTraits(context.catalog, context.build.specializations).map((trait) => trait.id))
        })
      : context.resources!.initiative!.maximum;
    const enduranceCapacity = state[STATE.ENDURANCE]?.maximum ?? context.resources!.endurance!.maximum;
    const endurance = state[STATE.ENDURANCE]?.value ?? enduranceCapacity;
    return [
      {
        id: 'initiative',
        singular: 'initiative',
        plural: 'initiative',
        maximum: state[STATE.INITIATIVE]?.maximum ?? initiativeCapacity,
        value: state[STATE.INITIATIVE]?.value ?? context.initialInitiative ?? 12,
        startMaximum: initiativeCapacity,
        canStart: true,
        buildKey: 'initialInitiative',
        step: 1,
        displayMode: 'pips',
        pipStyle: 'thief-initiative',
        // Initiative layout belongs to the selected specialization, independent of live resource snapshots.
        pipRows: specialization === 'Antiquary' ? 3 : 2,
        shortLabel: 'Init',
        statusLabel: 'Current'
      },
      // Core contributes its own starting inventory control; elite modules declare theirs independently.
      ...(specialization === 'Core' ? [preStealResourceView(state[STATE.STORED_STOLEN_SKILL_COUNT] || 0)] : []),
      // Reuse the starting-resource editor; the active-state bar already displays the live axe count.
      ...([
        context.build?.weapons?.[0],
        context.build?.alternateWeapons?.[0],
        context.config?.primaryWeapon,
        context.config?.weaponSet2Primary
      ].includes(WEAPON.AXE) || (context.build?.initialSpinningAxes ?? context.config?.initialSpinningAxes ?? 0) > 0
        ? [
            {
              id: 'spinning-axes',
              singular: 'precast autoattack axe',
              plural: 'precast autoattack axes',
              maximum: MAXIMUM_SPINNING_AXES,
              value: (state[STATE.SPINNING_AXES] || []).filter((axe) => axe.expiresAt > (context.simulationTime ?? 0))
                .length,
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
