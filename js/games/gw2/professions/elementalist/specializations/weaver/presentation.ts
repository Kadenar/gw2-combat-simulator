import type {
  ElementalistState,
  ElementalistUiContext,
  ElementalistUiSlice
} from '#gw2/professions/elementalist/types.js';
/**
 * Weaver presentation contract: palette identity, the rotation
 * state snapshot, timeline and event-log labels, and the custom weapon palette
 * that renders the main-hand / off-hand split. Everything here is a read-only
 * projection of scheduler or end state; none of it may mutate the simulation.
 */
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type {
  ProfessionEventLogDescriptor,
  ProfessionPaletteSkillRenderer,
  ProfessionWeaponPaletteRenderContext,
  ProfessionWeaponPaletteView,
  RotationStateSnapshotItem
} from '#gw2/platform/profession-presentation/types.js';
import { autoattackChainSkillAvailable } from '#gw2/platform/skills/autoattack-chain-controller.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_WEAVER_SKILL_IDS,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { getActiveTraits } from '#gw2/professions/elementalist/data/traits-data.js';
import { escapeHtml as esc } from '#ui/shared/html.js';

import type { ElementalistBuildSpecialization } from '#gw2/professions/elementalist/build/types.js';
import { elementalistUiState } from '#gw2/professions/elementalist/core/presentation.js';
import { ELEMENTALIST_ATTUNEMENTS } from '#gw2/professions/elementalist/core/state.js';
import {
  weaverDualAttunements,
  weaverWeaponAttunementAvailable
} from '#gw2/professions/elementalist/specializations/weaver/mechanics/dual-weapon-state.js';

// Unravel and its F5 palette group only exist when the trait is selected.
function hasElementsOfRage(context: ElementalistUiContext): boolean {
  const build = context.build as { specializations?: readonly ElementalistBuildSpecialization[] } | undefined;
  return getActiveTraits(build?.specializations || []).some((trait) => trait.id === TRAIT.ELEMENTS_OF_RAGE);
}

// An attunement swap changes Weaver's primary-hand bar immediately, but GW2
// leaves the previous element's progressed autoattack on slot 1 until its chain resolves.
function isCarriedAutoattackSkill(
  context: ElementalistUiContext & Partial<Pick<ProfessionWeaponPaletteRenderContext, 'autoattackChains'>>,
  skill: Skill
): boolean {
  const state = elementalistUiState(context);
  const carryover = state.autoattackCarryover;
  const root = Number(carryover?.root);
  if (!Number.isFinite(root) || Number(skill.chainRoot) !== root) return false;
  if ((carryover?.attunement || '') !== String(skill.attunement || '')) return false;
  const chains: ProfessionWeaponPaletteRenderContext['autoattackChains'] =
    state.autoattackChains || context.autoattackChains || {};
  const expected = chains[String(root)] ?? root;
  return Number(skill.id) === Number(expected) || skill.name === expected;
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
    order: 20,
    flags: []
  };
}

// Describe Weaver's active windows; its attunement pair is already shown in the palette.
function rotationStateSnapshot(context: ElementalistUiContext): RotationStateSnapshotItem[] {
  const state = elementalistUiState(context);
  const at = Math.max(0, context.atSeconds || 0);
  const items: RotationStateSnapshotItem[] = [];

  // Surface only the Weaver windows currently affecting the inspected rotation point,
  // so stance follow-ups and the temporary single-attunement override are easy to time.
  for (const [id, label, expiresAt] of [
    ['weave-self', 'Weave Self', state.weaveSelfUntil || 0],
    ['perfect-weave', 'Perfect Weave', state.perfectWeaveUntil || 0],
    ['unravel', 'Unravel', state.unravelUntil || 0]
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
    skills: skills.filter((skill) => skill.attunement === attunement)
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

// Render one weapon cell with availability, equipped-state, and optional
// attunement badge while delegating the actual skill tile to the shared renderer.
function skillCellHtml(
  skill: Skill,
  isAvailable: (skill: Skill) => boolean,
  unavailableMessage: (skill: Skill) => string,
  renderSkill: ProfessionPaletteSkillRenderer,
  options: {
    readonly badge?: boolean;
    readonly equipped?: boolean;
    readonly staticCooldown?: boolean;
  } = {}
): string {
  const available = isAvailable(skill);
  const projectedSkill = options.badge ? { ...skill, variantBadge: attunementBadge(skill.attunement) } : skill;
  const renderedSkill = renderSkill(projectedSkill, {
    contextAvailable: options.staticCooldown ? true : available,
    contextMessage: options.staticCooldown ? '' : unavailableMessage(skill),
    view: options.staticCooldown ? { draggable: false, hotkeyAction: '' } : undefined
  });
  const equipped = !options.staticCooldown && (options.equipped || available) ? ' is-equipped' : '';
  return `<div class="weaver-skill-cell${equipped}${options.staticCooldown ? ' is-static' : ''}"
      data-attunement="${esc(String(skill.attunement || 'Special'))}"
      ${options.staticCooldown ? 'data-palette-static="true"' : ''}>
      ${renderedSkill}
    </div>`;
}

// One labelled row per element, used by the collapsible cooldown banks.
function elementRowsHtml(
  rows: readonly WeaverWeaponPaletteRow[],
  selectedAttunement: string,
  autoattackChains: ProfessionWeaponPaletteRenderContext['autoattackChains'],
  isAvailable: (skill: Skill) => boolean,
  unavailableMessage: (skill: Skill) => string,
  renderSkill: ProfessionPaletteSkillRenderer
): string {
  return rows
    .map((row) => {
      const visibleSkills = row.skills.filter((skill) => autoattackChainSkillAvailable(skill, autoattackChains));
      if (!visibleSkills.length) return '';
      return `<div class="weaver-attunement-row${row.attunement === selectedAttunement ? ' is-selected' : ''}"
          data-attunement="${esc(row.attunement)}">
          <span class="weaver-attunement-label">${esc(row.attunement)}</span>
          <div class="weaver-attunement-skills">${visibleSkills
            .map((skill) =>
              skillCellHtml(skill, isAvailable, unavailableMessage, renderSkill, { staticCooldown: true })
            )
            .join('')}</div>
        </div>`;
    })
    .join('');
}

// Arrange Weaver weapon skills by primary hand, dual slot, and secondary hand,
// keeping the optional cooldown inventory behind a native disclosure.
function renderWeaverWeaponPalette(
  context: ProfessionWeaponPaletteRenderContext<Partial<ElementalistState>>
): ProfessionWeaponPaletteView | null {
  if ((context.specialization || '') !== 'Weaver') return null;
  const skills = context.skills;
  if (!skills.length) return null;
  const state = context.professionState;
  const build = context.build;
  const primaryAttunement = state?.primaryAttunement || build?.startAttunement || 'Fire';
  const secondaryAttunement = state?.secondaryAttunement || build?.secondaryAttunement || primaryAttunement;
  const autoattackChains = context.autoattackChains;
  const isAvailable = context.isSkillAvailable;
  const unavailableMessage = context.unavailableMessage;
  const renderSkill = context.renderSkill;
  // Select the current hands independently of affordability so denied skills keep their bar slots.
  const layout = weaverWeaponPaletteLayout(skills);
  const active = (candidates: readonly Skill[]): Skill[] =>
    candidates.filter((skill) =>
      weaverWeaponAttunementAvailable(
        skill,
        primaryAttunement,
        secondaryAttunement,
        (state?.unravelUntil || 0) > (context.time ?? 0)
      )
    );
  const currentPrimarySkills = layout.primaryRows.find((row) => row.attunement === primaryAttunement)?.skills || [];
  const carriedAutoattack = skills.find((skill) => isCarriedAutoattackSkill(context, skill));
  let placedCarriedAutoattack = false;
  const primarySkills = currentPrimarySkills.flatMap((skill) => {
    if (!carriedAutoattack || placedCarriedAutoattack || skill.slot !== 'Weapon_1') return [skill];
    placedCarriedAutoattack = true;
    // Keep the carried step first for normal weapon-1 input, while exposing the
    // current root beside it as an explicit way to cancel and restart the chain.
    return [carriedAutoattack, skill];
  });
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- The flatMap callback above mutates placedCarriedAutoattack.
  if (carriedAutoattack && !placedCarriedAutoattack) primarySkills.unshift(carriedAutoattack);
  const slotThreeSkills = active([...layout.sameAttunementSkills, ...layout.dualSkills]);
  const secondarySkills = active(layout.secondaryRows.flatMap((row) => row.skills));
  const currentCluster = (candidates: readonly Skill[], badge = false): string => `<div class="weaver-current-cluster">
      ${candidates
        .map((skill) =>
          skillCellHtml(skill, isAvailable, unavailableMessage, renderSkill, {
            badge,
            equipped: true
          })
        )
        .join('')}
    </div>`;
  const slotThreeBank = (
    candidates: readonly Skill[],
    variant: 'same' | 'dual'
  ): string => `<div class="weaver-slot-three-row" data-weaver-variant="${variant}">
      <span class="weaver-slot-three-label">${variant === 'same' ? 'Same' : 'Mixed'}</span>
      <div class="weaver-slot-three-skills">${candidates
        .map((skill) =>
          skillCellHtml(skill, isAvailable, unavailableMessage, renderSkill, {
            badge: true,
            staticCooldown: true
          })
        )
        .join('')}</div>
    </div>`;
  // Skills no slot role claimed (bundles, transformed bars) keep their own bank.
  const extraSkills = layout.extraSkills.filter((skill) => autoattackChainSkillAvailable(skill, autoattackChains));
  const extrasHtml = extraSkills.length
    ? `<div class="weaver-extra-bank" data-role="weaver-extra-bank">
        <span class="weaver-bank-title">Other weapon skills</span>
        <div class="weaver-attunement-skills">${extraSkills
          .map((skill) => skillCellHtml(skill, isAvailable, unavailableMessage, renderSkill))
          .join('')}</div>
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
          ${currentCluster(slotThreeSkills, true)}
          <span class="weaver-current-divider" aria-hidden="true"></span>
          ${currentCluster(secondarySkills)}
        </div>
      </div>`,
    weaponGroupsHtml: [
      `<details class="weaver-weapon-palette" data-role="weaver-weapon-palette"
          data-palette-storage-key="gw2-weaver-cooldowns-expanded" open>
        <summary class="weaver-cooldown-toggle">All weapon skill cooldowns</summary>
        <div class="weaver-cooldown-bank" data-role="weaver-cooldown-bank">
        <section class="weaver-cooldown-lane" data-role="weaver-primary-bank">
          <div class="weaver-bank-title">Slots 1-2 <span>Primary</span></div>
          ${elementRowsHtml(
            layout.primaryRows,
            primaryAttunement,
            autoattackChains,
            isAvailable,
            unavailableMessage,
            renderSkill
          )}
        </section>
        <section class="weaver-cooldown-lane weaver-slot-three-bank"
            data-role="weaver-slot-three-bank">
          <div class="weaver-bank-title">Slot 3 <span>Same / dual</span></div>
          ${slotThreeBank(layout.sameAttunementSkills, 'same')}
          ${slotThreeBank(layout.dualSkills, 'dual')}
        </section>
        <section class="weaver-cooldown-lane" data-role="weaver-secondary-bank">
          <div class="weaver-bank-title">Slots 4-5 <span>Secondary</span></div>
          ${elementRowsHtml(
            layout.secondaryRows,
            secondaryAttunement,
            autoattackChains,
            isAvailable,
            unavailableMessage,
            renderSkill
          )}
        </section>
      </div>
      ${extrasHtml}
    </details>`
    ]
  };
}

/** The Weaver half of the Elementalist UI contract, registered by the module. */
export const weaverUi: ElementalistUiSlice = Object.freeze({
  // Tile identity follows the active bar even when the visible skill cannot currently be cast.
  paletteOverride: (context, skill) => {
    if (skill.id === ID.WEAVE_SELF || skill.id === ID.TAILORED_VICTORY)
      return {
        tileActive:
          (skill.id === ID.TAILORED_VICTORY) ===
          (elementalistUiState(context).perfectWeaveUntil || 0) > (context.time || 0)
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
  timelineWeaponLineTransition: unravelTimelineWeaponLineTransition,
  eventLogRow,
  renderWeaponPalette: renderWeaverWeaponPalette
});
