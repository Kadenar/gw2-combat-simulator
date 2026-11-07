/**
 * Weaver presentation contract: palette identity, the rotation
 * state snapshot, timeline and event-log labels, and the custom weapon palette
 * that renders the main-hand / off-hand split. Everything here is a read-only
 * projection of scheduler or end state; none of it may mutate the simulation.
 */
import { CONDITION } from '#gw2/platform/constants.js';
import type { SimulationEvent } from '#gw2/platform/events/events.js';
import { autoattackChainSkillAvailable } from '#gw2/platform/execution/autoattack-chains.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import type {
  ProfessionAttributePreviewContext,
  ProfessionAttributePreviewPreparation
} from '#gw2/platform/profession-presentation/attribute-preview.js';
import type { SkillDamagePreviewPreparation } from '#gw2/platform/profession-presentation/skill-damage.js';
import type {
  ProfessionEventLogDescriptor,
  ProfessionStateSnapshotContext,
  ProfessionWeaponPaletteContext,
  ProfessionWeaponPaletteOccurrence,
  ProfessionWeaponPaletteProjection,
  ProfessionWeaponPaletteView,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { planningBuffAt } from '#gw2/platform/results/result-queries.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { ElementalistBuildSpecialization } from '#gw2/professions/elementalist/build/types.js';
import { elementalistUiState } from '#gw2/professions/elementalist/core/presentation.js';
import { ELEMENTALIST_ATTUNEMENTS } from '#gw2/professions/elementalist/core/state.js';
import { elementalistWeaponGroups } from '#gw2/professions/elementalist/core/weapon-groups.js';
import {
  ELEMENTALIST_WEAVER_SKILL_IDS,
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import {
  weaverDualAttunements,
  weaverWeaponAttunementAvailable
} from '#gw2/professions/elementalist/specializations/weaver/mechanics/dual-weapon-state.js';
import type {
  ElementalistPlanningState,
  ElementalistSkill,
  ElementalistUiContext,
  ElementalistUiSlice
} from '#gw2/professions/elementalist/types.js';
import { createPreviewControls } from '#gw2/professions/shared/attribute-preview.js';
import { selectedTraits } from '#gw2/professions/shared/trait-data.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { escapeHtml as esc } from '#ui/shared/html.js';

// Unravel and its F5 palette group only exist when the trait is selected.
function hasElementsOfRage(context: ElementalistUiContext): boolean {
  const build = context.build as { specializations?: readonly ElementalistBuildSpecialization[] } | undefined;
  return selectedTraits(context.catalog, build?.specializations || []).some(
    (trait) => trait.id === TRAIT.ELEMENTS_OF_RAGE
  );
}

// An attunement swap changes Weaver's primary-hand bar immediately, but GW2
// leaves the previous element's progressed autoattack on slot 1 until its chain resolves.
function isCarriedAutoattackSkill(
  context: ElementalistUiContext & Partial<Pick<ProfessionWeaponPaletteContext, 'autoattackChains'>>,
  skill: ElementalistSkill
): boolean {
  const state = elementalistUiState(context);
  const carryover = state[STATE.AUTOATTACK_CARRYOVER];
  const root = Number(carryover?.root);

  if (!Number.isFinite(root) || Number(skill.chainRoot) !== root) return false;

  if ((carryover?.attunement || '') !== (skill.attunement || '')) return false;

  const chains: ProfessionWeaponPaletteContext['autoattackChains'] =
    state[STATE.AUTOATTACK_CHAINS] || context.autoattackChains || {};
  const expected = chains[String(root)] ?? root;
  return skill.id === expected;
}

// Project Unravel and attunement casts into compact primary/secondary labels
// without mutating the simulation state used by the timeline.
function unravelTimelineWeaponLineTransition(context: ElementalistUiContext): string | undefined {
  const skill = context.skill;
  const build = context.build;

  if (context.initial === true) {
    const primary = build?.startAttunement || 'Fire';
    const secondary = build?.secondaryAttunement || primary;
    return `${primary[0]}/${secondary[0]}`;
  }

  const currentPrimary = (context.weaponLine || '').split('/')[0];
  const primary =
    ELEMENTALIST_ATTUNEMENTS.find((attunement) => attunement[0] === currentPrimary) || build?.startAttunement || 'Fire';

  if (skill?.id === ELEMENTALIST_WEAVER_SKILL_IDS.Unravel) return `${primary[0]}/${primary[0]}`;

  const target = skill?.name.replace(/ Attunement$/, '') || '';
  return skill?.skillFamily === 'Attunement' && ELEMENTALIST_ATTUNEMENTS.includes(target as never)
    ? `${target[0]}/${primary[0]}`
    : undefined;
}

// Only swaps that carried an off-hand element get the "F/W -> A" style row.
function eventLogRow(
  _context: ElementalistUiContext,
  event: SimulationEvent
): ProfessionEventLogDescriptor | undefined {
  if (event.type !== 'elementalist.attunement' || !event.fromSecondaryAttunement) return undefined;

  return {
    type: event.type,
    description: `${String(event.from)}/${String(event.fromSecondaryAttunement)} → ${String(event.to)}`,
    className: 'resource',
    order: 20
  };
}

// Describe Weaver's active windows; its attunement pair is already shown in the palette.
function rotationStateSnapshot(
  context: ProfessionStateSnapshotContext<ElementalistUiContext['professionState']>
): RotationStateSnapshotItem[] {
  const state = elementalistUiState(context);
  const at = Math.max(0, context.atSeconds || 0);
  const items: RotationStateSnapshotItem[] = [];
  // Read the inspected point's resolved buff windows so Rage refreshes and expiry match combat state.
  const rage = planningBuffAt(context.planningState, 'elements of rage');

  // Show only the Weaver windows currently affecting the inspected rotation point,
  // so stance follow-ups and the temporary single-attunement override are easy to time.
  for (const [id, label, expiresAt] of [
    ['elements-of-rage', 'Elements of Rage', rage ? at + rage.remaining : 0],
    ['weave-self', 'Weave Self', state[STATE.WEAVE_SELF_UNTIL] || 0],
    ['perfect-weave', 'Perfect Weave', state[STATE.PERFECT_WEAVE_UNTIL] || 0],
    ['unravel', 'Unravel', state[STATE.UNRAVEL_UNTIL] || 0]
  ] as const) {
    const remaining = expiresAt - at;

    if (remaining <= 0) continue;

    items.push({
      id,
      label,
      value: `${remaining.toFixed(1)}s`,
      title: `Time remaining in ${label}`
    });
  }

  return items;
}

interface WeaverWeaponPaletteRow {
  readonly attunement: string;
  readonly skills: Skill[];
}

/** The fixed roles a Weaver weapon bar splits into, produced by the layout pass. */
interface WeaverWeaponPaletteLayout {
  readonly primaryRows: WeaverWeaponPaletteRow[];
  readonly sameAttunementSkills: Skill[];
  readonly dualSkills: Skill[];
  readonly secondaryRows: WeaverWeaponPaletteRow[];
  readonly extraSkills: Skill[];
}

/** Projects Weaver weapon variants into their fixed combat-bar roles. */
export function weaverWeaponPaletteLayout(skills: readonly Skill[]): WeaverWeaponPaletteLayout {
  // Slots 1-2 are main-hand rows, slot 3 splits into same-element and mixed dual
  // variants, slots 4-5 are off-hand rows, and anything unclaimed falls through
  // to `extraSkills`.
  const elementalRows = ['Fire', 'Water', 'Air', 'Earth'].map((attunement) => ({
    attunement,
    skills: skills.filter((skill: ElementalistSkill) => skill.attunement === attunement)
  }));
  const slot = (skill: Skill): number => Number(String(skill.slot || '').match(/(\d+)$/)?.[1] || 0);
  const primaryRows = elementalRows.map((row) => ({
    ...row,
    skills: row.skills.filter((skill) => slot(skill) <= 2)
  }));
  const sameAttunementSkills = elementalRows.flatMap((row) => row.skills.filter((skill) => slot(skill) === 3));
  const dualSkills = skills.filter((skill) => slot(skill) === 3 && weaverDualAttunements(skill));
  const secondaryRows = elementalRows.map((row) => ({
    ...row,
    skills: row.skills.filter((skill) => slot(skill) >= 4)
  }));
  const assigned = new Set(
    [
      ...primaryRows.flatMap((row) => row.skills),
      ...sameAttunementSkills,
      ...dualSkills,
      ...secondaryRows.flatMap((row) => row.skills)
    ].map((skill) => skill.id)
  );

  return {
    primaryRows,
    sameAttunementSkills,
    dualSkills,
    secondaryRows,
    extraSkills: skills.filter((skill) => !assigned.has(skill.id))
  };
}

// Condense an attunement or dual pair into initials, e.g. "Fire+Air" -> "F/A".
function attunementBadge(attunement: unknown): string {
  return String(attunement || '')
    .split('+')
    .filter(Boolean)
    .map((element) => element[0])
    .join('/');
}

/** Prepared placement is independent of skill markup and retains separate current/reference occurrences. */
interface WeaverPaletteCell {
  readonly index: number;
  readonly attunement: string;
  readonly equipped: boolean;
  readonly referenceOnly: boolean;
}

interface WeaverPaletteRow {
  readonly attunement: string;
  readonly selected: boolean;
  readonly cells: readonly WeaverPaletteCell[];
}

interface WeaverPaletteView {
  readonly primaryAttunement: string;
  readonly secondaryAttunement: string;
  readonly primarySkills: readonly WeaverPaletteCell[];
  readonly slotThreeSkills: readonly WeaverPaletteCell[];
  readonly secondarySkills: readonly WeaverPaletteCell[];
  readonly primaryRows: readonly WeaverPaletteRow[];
  readonly secondaryRows: readonly WeaverPaletteRow[];
  readonly sameAttunementSkills: readonly WeaverPaletteCell[];
  readonly dualSkills: readonly WeaverPaletteCell[];
  readonly extraSkills: readonly WeaverPaletteCell[];
}

/** Select the live hands and cooldown inventory before any tile or layout markup is generated. */
function projectWeaverWeaponPalette(
  context: ProfessionWeaponPaletteContext<Partial<ElementalistPlanningState>>
): ProfessionWeaponPaletteProjection | null {
  const skills = context.skills;

  if (!skills.length) return null;

  const state = context.professionState;
  const build = context.build;
  const primaryAttunement = state?.[STATE.PRIMARY_ATTUNEMENT] || build?.startAttunement || 'Fire';
  const secondaryAttunement = state?.[STATE.SECONDARY_ATTUNEMENT] || build?.secondaryAttunement || primaryAttunement;
  const autoattackChains = context.autoattackChains;
  const isAvailable = context.isSkillAvailable;
  // Select the current hands independently of affordability so denied skills keep their bar slots.
  const layout = weaverWeaponPaletteLayout(skills);
  const active = (candidates: readonly Skill[]): Skill[] =>
    candidates.filter((skill) =>
      weaverWeaponAttunementAvailable(
        skill,
        primaryAttunement,
        secondaryAttunement,
        (state?.[STATE.UNRAVEL_UNTIL] || 0) > (context.time ?? 0)
      )
    );
  const currentPrimarySkills = layout.primaryRows.find((row) => row.attunement === primaryAttunement)?.skills || [];
  const carriedAutoattack = skills.find((skill) => isCarriedAutoattackSkill(context, skill));
  let placedCarriedAutoattack = false;
  const primarySkills = currentPrimarySkills.flatMap((skill) => {
    if (!carriedAutoattack || placedCarriedAutoattack || skill.slot !== 'Weapon_1') return [skill];

    placedCarriedAutoattack = true;

    // Matching attunements can already display the carried step in this slot; keep that occurrence once.
    if (carriedAutoattack.id === skill.id) return [skill];

    // Keep the carried step first for normal weapon-1 input, while exposing the
    // current root beside it as an explicit way to cancel and restart the chain.
    return [carriedAutoattack, skill];
  });

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- The flatMap callback above mutates placedCarriedAutoattack.
  if (carriedAutoattack && !placedCarriedAutoattack) primarySkills.unshift(carriedAutoattack);

  const slotThreeSkills = active([...layout.sameAttunementSkills, ...layout.dualSkills]);
  const secondarySkills = active(layout.secondaryRows.flatMap((row) => row.skills));

  const occurrences: ProfessionWeaponPaletteOccurrence[] = [];
  const cells = (
    candidates: readonly ElementalistSkill[],
    { badge = false, equipped = false, referenceOnly = false } = {}
  ): WeaverPaletteCell[] =>
    candidates.map((skill) => {
      const index = occurrences.length;
      occurrences.push({
        skill: badge ? { ...skill, variantBadge: attunementBadge(skill.attunement) } : skill,
        referenceOnly
      });
      return {
        index,
        attunement: skill.attunement || 'Special',
        equipped: !referenceOnly && (equipped || isAvailable(skill)),
        referenceOnly
      };
    });
  const rows = (candidates: readonly WeaverWeaponPaletteRow[], selected: string): WeaverPaletteRow[] =>
    candidates.flatMap((row) => {
      const visible = row.skills.filter((skill) => autoattackChainSkillAvailable(skill, autoattackChains));
      return visible.length
        ? [
            {
              attunement: row.attunement,
              selected: row.attunement === selected,
              cells: cells(visible, { referenceOnly: true })
            }
          ]
        : [];
    });
  const view: WeaverPaletteView = {
    primaryAttunement,
    secondaryAttunement,
    primarySkills: cells(primarySkills, { equipped: true }),
    slotThreeSkills: cells(slotThreeSkills, { equipped: true, badge: true }),
    secondarySkills: cells(secondarySkills, { equipped: true }),
    primaryRows: rows(layout.primaryRows, primaryAttunement),
    secondaryRows: rows(layout.secondaryRows, secondaryAttunement),
    sameAttunementSkills: cells(layout.sameAttunementSkills, { referenceOnly: true, badge: true }),
    dualSkills: cells(layout.dualSkills, { referenceOnly: true, badge: true }),
    extraSkills: cells(layout.extraSkills.filter((skill) => autoattackChainSkillAvailable(skill, autoattackChains)))
  };
  return { skills: occurrences, render: (tiles) => renderWeaverWeaponPalette(view, tiles) };
}

/** Render only prepared placement and completed tile markup; no profession or build state is consulted. */
function renderWeaverWeaponPalette(view: WeaverPaletteView, tiles: readonly string[]): ProfessionWeaponPaletteView {
  const { primaryAttunement, secondaryAttunement, primarySkills, slotThreeSkills, secondarySkills } = view;
  const skillCellHtml = (
    cell: WeaverPaletteCell
  ): string => `<div class="weaver-skill-cell${cell.equipped ? ' is-equipped' : ''}${cell.referenceOnly ? ' is-static' : ''}"
      data-attunement="${esc(cell.attunement)}"
      ${cell.referenceOnly ? 'data-palette-static="true"' : ''}>
      ${tiles[cell.index]}
    </div>`;
  const elementRowsHtml = (rows: readonly WeaverPaletteRow[]): string =>
    rows
      .map(
        (row) =>
          `<div class="weaver-attunement-row${row.selected ? ' is-selected' : ''}" data-attunement="${esc(row.attunement)}">
      <span class="weaver-attunement-label">${esc(row.attunement)}</span>
      <div class="weaver-attunement-skills">${row.cells.map(skillCellHtml).join('')}</div>
    </div>`
      )
      .join('');
  const currentCluster = (cells: readonly WeaverPaletteCell[]): string => `<div class="weaver-current-cluster">
      ${cells.map(skillCellHtml).join('')}
    </div>`;
  const slotThreeBank = (cells: readonly WeaverPaletteCell[], variant: 'same' | 'dual'): string =>
    `<div class="weaver-slot-three-row" data-weaver-variant="${variant}">
      <span class="weaver-slot-three-label">${variant === 'same' ? 'Same' : 'Mixed'}</span>
      <div class="weaver-slot-three-skills">${cells.map(skillCellHtml).join('')}</div>
    </div>`;
  const extrasHtml = view.extraSkills.length
    ? `<div class="weaver-extra-bank" data-role="weaver-extra-bank">
      <span class="weaver-bank-title">Other weapon skills</span>
      <div class="weaver-attunement-skills">${view.extraSkills.map(skillCellHtml).join('')}</div>
    </div>`
    : '';
  return {
    primaryClassName: 'weaver-top-palette',
    primaryRole: 'weaver-top-palette',
    placeUtilityInPrimary: true,
    placeActionsInPrimary: true,
    activeWeaponHtml: `<div class="weaver-current-bar" data-role="weaver-current-bar"
        aria-label="Current Weaver weapon bar: ${esc(primaryAttunement)} and ${esc(secondaryAttunement)}">
        <div class="weaver-current-caption">
          <span>Current</span>
          <strong>${esc(`${primaryAttunement[0]}/${secondaryAttunement[0]}`)}</strong>
        </div>
        <div class="weaver-current-composition">
          ${currentCluster(primarySkills)}
          <span class="weaver-current-divider" aria-hidden="true"></span>
          ${currentCluster(slotThreeSkills)}
          <span class="weaver-current-divider" aria-hidden="true"></span>
          ${currentCluster(secondarySkills)}
        </div>
      </div>`,
    weaponGroupsHtml: [
      `<details class="weaver-weapon-palette" data-role="weaver-weapon-palette"
          data-palette-collapse-query="(max-width: 700px)"
          data-palette-storage-key="gw2-weaver-cooldowns-expanded" open>
        <summary class="weaver-cooldown-toggle">All weapon skill cooldowns</summary>
        <div class="weaver-cooldown-bank" data-role="weaver-cooldown-bank">
        <section class="weaver-cooldown-lane" data-role="weaver-primary-bank">
          <div class="weaver-bank-title">Slots 1-2 <span>Primary</span></div>
          ${elementRowsHtml(view.primaryRows)}
        </section>
        <section class="weaver-cooldown-lane weaver-slot-three-bank"
            data-role="weaver-slot-three-bank">
          <div class="weaver-bank-title">Slot 3 <span>Same / dual</span></div>
          ${slotThreeBank(view.sameAttunementSkills, 'same')}
          ${slotThreeBank(view.dualSkills, 'dual')}
        </section>
        <section class="weaver-cooldown-lane" data-role="weaver-secondary-bank">
          <div class="weaver-bank-title">Slots 4-5 <span>Secondary</span></div>
          ${elementRowsHtml(view.secondaryRows)}
        </section>
      </div>
      ${extrasHtml}
    </details>`
    ]
  };
}

/** The Weaver half of the Elementalist UI contract, registered by the module. */
export const weaverUi: ElementalistUiSlice = Object.freeze({
  /** Completed Weave Self grants both elemental damage windows, not only its display marker. */
  prepareSkillDamagePreview({ values }: SkillDamagePreviewPreparation) {
    return {
      initialBuffs: values.perfectWeave
        ? ['perfect weave', 'weave self air', 'weave self fire'].map((kind) => ({ kind, stacks: 1, duration: 3600 }))
        : []
    };
  },
  /** Declare this module's conditional inputs without adding simulation settings. */
  previewControls(context: ProfessionAttributePreviewContext) {
    const preview = createPreviewControls(context);
    // The normal timed-buff query applies earned Weaver damage windows independently from attunement attributes.
    preview.trait('Elements of Rage', {
      key: 'elementsOfRage',
      kind: 'buff',
      field: 'elements of rage',
      scope: ['damage'],
      description: 'Dual-attunement damage bonus active'
    });
    preview.add({
      key: 'perfectWeave',
      label: 'Perfect Weave',
      group: 'Mechanic',
      kind: 'special',
      scope: ['damage'],
      description: 'Completed Weave Self damage window active'
    });

    preview.add({
      key: 'secondaryAttunement',
      label: 'Secondary attunement',
      group: 'Attunement',
      kind: 'special',
      options: ['None', 'Fire', 'Water', 'Air', 'Earth'],
      description: 'Elemental Polyphony'
    });
    preview.condition(CONDITION.WEAKNESS, 'Superior Elements');
    return preview.controls;
  },
  /** Seed only the detached attribute query; combat state and saved builds remain untouched. */
  prepareAttributePreview(context: ProfessionAttributePreviewPreparation) {
    // Keep an explicit None value so preview queries do not fall back to the build's starting attunement.
    const state = readProfessionSpecializationState<{ secondaryAttunement: string }>(
      context.professionState,
      'Weaver'
    )!;
    state.secondaryAttunement = String(context.values.secondaryAttunement);
  },

  // Tile identity follows the active bar even when the visible skill cannot currently be cast.
  paletteOverride: (context, skill) => {
    if (skill.id === ID.WEAVE_SELF || skill.id === ID.TAILORED_VICTORY)
      return {
        tileActive:
          (skill.id === ID.TAILORED_VICTORY) ===
          (elementalistUiState(context)[STATE.PERFECT_WEAVE_UNTIL] || 0) > (context.time || 0)
      };
  },
  paletteGroups: (context: ElementalistUiContext) =>
    hasElementsOfRage(context)
      ? [
          {
            id: 'elementalist-weaver-unravel',
            label: 'F5',
            skillIds: [ELEMENTALIST_WEAVER_SKILL_IDS.Unravel],
            color: '#9b65c7',
            className: 'compact-resource-palette elementalist-weaver-unravel'
          }
        ]
      : [],
  rotationStateSnapshot,
  // Dual-attuned skills share one row; the elemental helper owns the remaining row ordering.
  paletteWeaponGroups: (_context, skills) =>
    elementalistWeaponGroups(skills, (skill: ElementalistSkill) =>
      (skill.attunement || 'Special').includes('+') ? 'Dual' : skill.attunement || 'Special'
    ),
  timelineWeaponLineTransition: unravelTimelineWeaponLineTransition,
  eventLogRow,
  projectWeaponPalette: projectWeaverWeaponPalette
});
