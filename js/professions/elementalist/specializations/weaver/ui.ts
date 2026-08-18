import type {
  PaletteSkillAvailability,
  ProfessionPaletteSkillRenderer,
  ProfessionUiContract,
  ProfessionWeaponPaletteRenderContext,
  ProfessionWeaponPaletteView,
  SchedulerRecord,
  Skill
} from '../../../../platform/engine/types.js';
import { escapeHtml as esc } from '../../../../platform/ui/html.js';
import { ELEMENTALIST_WEAVER_SKILL_IDS } from '../../data/ids.js';
import { getActiveTraits } from '../../data/traits-data.js';
import type { ElementalistBuildSpecialization } from '../../types.js';
import { ELEMENTALIST_ATTUNEMENTS } from '../../core/state.js';

function hasElementsOfRage(context: SchedulerRecord): boolean {
  const build = context.build as { specializations?: readonly ElementalistBuildSpecialization[] } | undefined;
  return getActiveTraits(build?.specializations || []).some((trait) => trait.name === 'Elements of Rage');
}

function unravelPaletteAvailability(context: SchedulerRecord, skill: Skill): PaletteSkillAvailability {
  if (skill.id !== ELEMENTALIST_WEAVER_SKILL_IDS.Unravel) {
    return { available: true, message: '' };
  }
  const available = hasElementsOfRage(context);
  return {
    available,
    message: available ? '' : 'Requires Elements of Rage.'
  };
}

function unravelTimelineWeaponLineTransition(context: SchedulerRecord): string | undefined {
  const skill = context.skill as Skill | undefined;
  if (skill?.id !== ELEMENTALIST_WEAVER_SKILL_IDS.Unravel) return undefined;
  const build = context.build as SchedulerRecord | undefined;
  const currentPrimary = String(context.weaponLine || '').split('/')[0];
  const primary =
    ELEMENTALIST_ATTUNEMENTS.find((attunement) => attunement[0] === currentPrimary) ||
    String(build?.startAttunement || 'Fire');
  return `${primary[0]}/${primary[0]}`;
}

interface WeaverWeaponPaletteRow {
  readonly attunement: string;
  readonly skills: Skill[];
}

interface WeaverWeaponPaletteLayout {
  readonly primaryRows: WeaverWeaponPaletteRow[];
  readonly sameAttunementSkills: Skill[];
  readonly dualSkills: Skill[];
  readonly secondaryRows: WeaverWeaponPaletteRow[];
  readonly extraSkills: Skill[];
}

/** Projects Weaver weapon variants into their fixed combat-bar roles. */
export function weaverWeaponPaletteLayout(skills: readonly Skill[]): WeaverWeaponPaletteLayout {
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
  const dualSkills = skills.filter((skill) => slot(skill) === 3 && String(skill.attunement || '').includes('+'));
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

function autoattackChainSkillAvailable(skill: Skill, chainState: SchedulerRecord): boolean {
  if (!skill.chainRoot) return true;
  const chainRoot = String(skill.chainRoot);
  const expected = chainState[chainRoot] ?? skill.chainRoot;
  return skill.name === expected || skill.id === Number(expected);
}

function attunementBadge(attunement: unknown): string {
  return String(attunement || '')
    .split('+')
    .filter(Boolean)
    .map((element) => element[0])
    .join('/');
}

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

function elementRowsHtml(
  rows: readonly WeaverWeaponPaletteRow[],
  selectedAttunement: string,
  autoattackChains: SchedulerRecord,
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

function renderWeaverWeaponPalette(context: ProfessionWeaponPaletteRenderContext): ProfessionWeaponPaletteView | null {
  if (String(context.specialization || '') !== 'Weaver') return null;
  const skills = context.skills;
  if (!skills.length) return null;
  const state = context.professionState as SchedulerRecord | undefined;
  const build = context.build as SchedulerRecord | undefined;
  const primaryAttunement = String(state?.primaryAttunement || build?.startAttunement || 'Fire');
  const secondaryAttunement = String(state?.secondaryAttunement || build?.secondaryAttunement || primaryAttunement);
  const autoattackChains = context.autoattackChains || {};
  const isAvailable = context.isSkillAvailable;
  const unavailableMessage = context.unavailableMessage;
  const renderSkill = context.renderSkill;
  const layout = weaverWeaponPaletteLayout(skills);
  const active = (candidates: readonly Skill[]): Skill[] => candidates.filter(isAvailable);
  const primarySkills = (layout.primaryRows.find((row) => row.attunement === primaryAttunement)?.skills || []).filter(
    (skill) => Boolean(skill.chainRoot) || isAvailable(skill)
  );
  const slotThreeSkills = active([...layout.sameAttunementSkills, ...layout.dualSkills]);
  const secondarySkills = active(layout.secondaryRows.flatMap((row) => row.skills));
  const currentCluster = (
    candidates: readonly Skill[],
    slots: string,
    badge = false
  ): string => `<div class="weaver-current-cluster" data-slots="${slots}">
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
          ${currentCluster(primarySkills, '1-2')}
          <span class="weaver-current-divider" aria-hidden="true"></span>
          ${currentCluster(slotThreeSkills, '3', true)}
          <span class="weaver-current-divider" aria-hidden="true"></span>
          ${currentCluster(secondarySkills, '4-5')}
        </div>
      </div>`,
    weaponGroupsHtml: [
      `<div class="weaver-weapon-palette" data-role="weaver-weapon-palette">
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
    </div>`
    ]
  };
}

export const weaverUi: Partial<ProfessionUiContract> & SchedulerRecord = Object.freeze({
  skillBarGroups: (context: SchedulerRecord) =>
    hasElementsOfRage(context)
      ? [
          {
            id: 'elementalist-weaver-unravel',
            label: 'Unravel',
            skillIds: [ELEMENTALIST_WEAVER_SKILL_IDS.Unravel],
            color: '#9b65c7',
            className: 'elementalist-weaver-unravel'
          }
        ]
      : [],
  paletteGroups: (context: SchedulerRecord) =>
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
  paletteSkillAvailability: unravelPaletteAvailability,
  timelineWeaponLineTransition: unravelTimelineWeaponLineTransition,
  renderWeaponPalette: renderWeaverWeaponPalette
});
