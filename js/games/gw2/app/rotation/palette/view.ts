/** Composes palette markup from projected state and binds the current rendered controls. */
import { escapeHtml as esc } from '#gw2/app/presentation/shared/html.js';
import { bindAppPaletteInteractions } from '#gw2/app/rotation/palette/interactions.js';
import {
  createPaletteContext,
  displayedWeaponSkills,
  paletteSkillView,
  projectPalette,
  weaponPaletteRows,
  weaponSkills,
  type AmmoView,
  type PaletteContext,
  type PaletteControlView,
  type PaletteGroupView,
  type PaletteSkillView,
  type RenderedPaletteGroup
} from '#gw2/app/rotation/palette/model.js';
import { activeResourceGroup } from '#gw2/app/rotation/palette/resource-view.js';
import { COMBAT_START_ICON, COOLDOWN_RESET_ICON, PLACEHOLDER_ICON, WAIT_ICON } from '#gw2/app/rotation/shared/icons.js';
import { rotationEntryName } from '#gw2/app/rotation/timeline/model.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type {
  ProfessionPaletteGroup,
  ProfessionPaletteSkillRenderOptions,
  SchedulerRecord,
  Skill
} from '#gw2/platform/engine/types.js';

function ammoView(ammo: AmmoView | null | undefined): {
  readonly current: number;
  readonly maximum: number;
  readonly pips: readonly boolean[];
} | null {
  if (!ammo) return null;
  const maximum = Math.max(0, Number(ammo.maximum || 0));
  const current = Math.max(0, Math.min(maximum, Number(ammo.current || 0)));
  const pips = Array.isArray(ammo.pips)
    ? // A caller may provide nonstandard pip availability; otherwise derive the
      // usual left-to-right filled state from current charges.
      ammo.pips
    : Array.from({ length: maximum }, (_, index) => index < current);
  return { current, maximum, pips };
}

export function paletteSkillHtml(view: PaletteSkillView = {}): string {
  const ammo = ammoView(view.ammo);
  const resource = view.resource;
  const skillId = view.skillId == null ? '' : String(view.skillId);
  const hotkeyAction = String(view.hotkeyAction || '');
  const disabled = Boolean(view.disabled);
  const contextDisabled = Boolean(view.contextDisabled);
  // Permanent and context-sensitive disablement have distinct CSS, but either
  // one must suppress native drag behavior.
  const draggable = Boolean(view.draggable) && !disabled && !contextDisabled;
  const classes = [
    'pal-skill',
    disabled ? 'pal-disabled' : '',
    contextDisabled ? 'pal-context-disabled' : '',
    view.concealed ? 'pal-concealed' : '',
    view.highlighted ? 'pal-ambush-active' : '',
    ammo ? 'pal-has-ammo' : '',
    ammo && ammo.current > 0 ? 'pal-ammo-available' : '',
    resource ? 'pal-has-resource' : ''
  ]
    .filter(Boolean)
    .join(' ');
  const ammoIndicator = ammo
    ? `<span class="pal-charges">${ammo.current}/${ammo.maximum}</span>
      <span class="pal-ammo-pips" aria-hidden="true">${ammo.pips
        .map((filled) => `<span class="pal-ammo-pip${filled ? ' filled' : ''}"></span>`)
        .join('')}</span>`
    : '';
  const ariaLabel = ammo ? `${view.name || ''}: ${ammo.current}/${ammo.maximum} charges` : '';
  const resourceMaximum = Math.max(0, Number(resource?.maximum || 0));
  const resourceValue = Math.max(0, Math.min(resourceMaximum, Number(resource?.value || 0)));
  const resourcePercent = resourceMaximum ? (resourceValue / resourceMaximum) * 100 : 0;
  const resourceIndicator = resource
    ? `<span class="pal-skill-resource" data-resource-id="${esc(resource.id)}"
        role="progressbar" aria-label="${esc(resource.label)}"
        aria-valuemin="0" aria-valuemax="${resourceMaximum}"
        aria-valuenow="${resourceValue}">
        <span style="width:${resourcePercent}%"></span>
      </span>
      <span class="pal-skill-resource-value" data-resource-id="${esc(resource.id)}"
        aria-hidden="true">${Math.round(resourceValue)}/${resourceMaximum}</span>`
    : '';
  return `<div class="${classes}" data-skill="${esc(view.name)}"
    ${skillId ? `data-skill-id="${esc(skillId)}"` : ''}
    ${hotkeyAction ? `data-hotkey-action="${esc(hotkeyAction)}"` : ''}
    title="${esc(view.title || view.name)}" draggable="${draggable ? 'true' : 'false'}"
    ${ariaLabel ? `aria-label="${esc(ariaLabel)}"` : ''}
    style="--att-border:${esc(view.color || '#a88be8')}">
    <img src="${esc(view.icon || PLACEHOLDER_ICON)}" alt="" />
    ${view.variantBadge ? `<span class="skill-variant-badge pal-variant-badge">${esc(view.variantBadge)}</span>` : ''}
    ${view.cooldownLabel ? `<span class="pal-cd">${esc(view.cooldownLabel)}</span>` : ''}
    ${ammoIndicator}
    ${resourceIndicator}
  </div>`;
}

export function virtualPaletteSkillHtml(view: PaletteSkillView = {}): string {
  // Virtual actions get neutral defaults while retaining full caller override.
  return paletteSkillHtml({
    color: '#8d7a57',
    draggable: true,
    ...view
  });
}

export function paletteControlHtml(view: PaletteControlView): string {
  const classes = [
    'pal-control',
    view.className || '',
    view.active ? 'pal-control-active' : '',
    view.pressed ? 'pal-control-pressed' : '',
    view.muted ? 'pal-control-muted' : ''
  ]
    .filter(Boolean)
    .join(' ');
  const title = view.title || view.label || view.id;
  return `<button type="button" class="${esc(classes)}"
      data-palette-control-id="${esc(view.id)}"
      aria-pressed="${view.pressed ? 'true' : 'false'}"
      aria-label="${esc(title)}" title="${esc(title)}"
      style="--att-border:${esc(view.color || '#a88be8')}">
      <img src="${esc(view.icon || PLACEHOLDER_ICON)}" alt="" />
      ${view.badge ? `<span class="pal-control-badge" aria-hidden="true">${esc(view.badge)}</span>` : ''}
    </button>`;
}

export function paletteGroupHtml(view: PaletteGroupView = {}): string {
  const skills = view.skills || [];
  const controls = view.controls || [];
  const statusIcon = view.statusIcon;
  // Empty groups occupy no layout space.
  if (!skills.length && !controls.length && !statusIcon) return '';
  const statusIconHtml = statusIcon
    ? `<div class="pal-status-icon" title="${esc(statusIcon.title || statusIcon.label)}"
        aria-label="${esc(statusIcon.label)}">
        <img src="${esc(statusIcon.icon || PLACEHOLDER_ICON)}"
          alt="${esc(statusIcon.label)}" />
      </div>`
    : '';
  return `<div class="pal-group${view.className ? ` ${esc(view.className)}` : ''}"
      ${view.id ? `data-palette-group="${esc(view.id)}"` : ''}>
    <div class="pal-label" style="color:${esc(view.color || '#a88be8')}">${esc(view.label)}</div>
    <div class="pal-row">${statusIconHtml}${controls.map(paletteControlHtml).join('')}${skills
      .map((skill) => (skill?.virtual ? virtualPaletteSkillHtml(skill) : paletteSkillHtml(skill)))
      .join('')}</div>
  </div>`;
}

export function weaponPaletteStackHtml(groups: readonly string[] = []): string {
  const content = groups.filter(Boolean).join('');
  return content ? `<div class="weapon-palette-stack" data-role="weapon-set-stack">${content}</div>` : '';
}

export function weaponPaletteSectionHtml(
  weaponGroups: readonly string[] = [],
  actionGroup = '',
  trailingGroup = ''
): string {
  const weapons = weaponPaletteStackHtml(weaponGroups);
  return weapons || actionGroup || trailingGroup
    ? `<div class="weapon-palette-section" data-role="weapon-palette-section">${weapons}${actionGroup}${trailingGroup}</div>`
    : '';
}

/** Adapts a resolved skill list and optional controls to generic group markup. */
function addGroup(
  app: ProfessionAppState,
  label: string,
  skills: readonly Skill[],
  color = '#a88be8',
  isAvailable: (skill: Skill) => boolean = () => true,
  unavailableMessage: (skill: Skill) => string = () => '',
  className = '',
  statusIcon?: ProfessionPaletteGroup['statusIcon'],
  controls: ProfessionPaletteGroup['controls'] = [],
  id = '',
  retryAt: (skill: Skill) => number | null = () => null
): string {
  if (!skills.length && !controls.length && !statusIcon) return '';
  return paletteGroupHtml({
    id,
    label,
    color,
    className,
    statusIcon,
    controls,
    skills: skills.map((skill) =>
      paletteSkillView(app, skill, isAvailable(skill), unavailableMessage(skill), retryAt(skill))
    )
  });
}

/** Composes palette markup from one immutable point-in-time context without mutating the DOM. */
function paletteHtml(app: ProfessionAppState, paletteContext: PaletteContext): string {
  const {
    renderedProfessionGroups,
    renderedLoadoutGroups,
    actions,
    weaponSwapActions,
    generalActions,
    activeWeaponSet,
    autoattackChains,
    professionAllowsPaletteSkill,
    professionPaletteUnavailableMessage,
    professionPaletteRetryAt,
    weaponSkillAvailable,
    weaponSkillUnavailableMessage,
    selectedWithFlips
  } = projectPalette(app, paletteContext);
  const loadoutHasResourceAnchor = renderedLoadoutGroups.some((group) => group.resourceAnchor);
  const loadoutStackHtml = renderedLoadoutGroups.length
    ? `<div class="weapon-palette-stack loadout-palette-stack"
            data-role="loadout-palette-stack"
            >${renderedLoadoutGroups
              .map((group) =>
                addGroup(
                  app,
                  group.label,
                  group.skills,
                  group.color || '#c49cff',
                  professionAllowsPaletteSkill,
                  professionPaletteUnavailableMessage,
                  group.className,
                  group.statusIcon
                )
              )
              .join('')}</div>`
    : '';
  const attachedResourceIds = renderedProfessionGroups.flatMap((group) => group.resourceIds || []);

  // Resources attached to a specific group are rendered with that group and
  // excluded from the remaining unpositioned resource block.
  const resourceGroupsHtml = activeResourceGroup(app, {
    excludeIds: attachedResourceIds
  });

  let resourceAnchorRendered = false;
  // The first eligible anchor consumes the unpositioned resource block; later
  // anchors must not duplicate it.
  const stackWithResources = (groupHtml: string, anchored: boolean | undefined): string => {
    if (!anchored || !resourceGroupsHtml) return groupHtml;
    resourceAnchorRendered = true;
    return `<div class="profession-resource-stack"
            data-role="profession-resource-stack">
                ${groupHtml}
                ${resourceGroupsHtml}
            </div>`;
  };

  const loadoutStack = stackWithResources(loadoutStackHtml, loadoutHasResourceAnchor);
  const loadoutAfterActions = app.adapter.slotLoadout?.palettePlacement === 'after-actions';
  const loadoutBeforeWeapons = loadoutAfterActions ? '' : loadoutStack;
  const loadoutUtilityGroup =
    loadoutAfterActions && loadoutStack
      ? `<div class="utility-palette-group loadout-utility-palette-group"
            data-role="loadout-utility-palette-group">${loadoutStack}</div>`
      : '';
  // A group either stays in the profession section, follows weapon set one,
  // or sits beside the currently active weapon row.
  const weaponSetOneProfessionGroups = renderedProfessionGroups.filter((group) => group.placement === 'weapon-set-1');
  const activeWeaponProfessionGroups = renderedProfessionGroups.filter((group) => group.placement === 'active-weapon');
  const standardProfessionGroups = renderedProfessionGroups.filter(
    (group) => group.placement === 'profession' || !group.placement
  );

  const renderProfessionGroup = (group: RenderedPaletteGroup): string => {
    const groupHtml = addGroup(
      app,
      group.label,
      group.skills,
      group.color || '#c49cff',
      professionAllowsPaletteSkill,
      professionPaletteUnavailableMessage,
      group.className,
      group.statusIcon,
      group.controls,
      group.id,
      professionPaletteRetryAt
    );
    const attachedResourcesHtml = group.resourceIds?.length
      ? activeResourceGroup(app, { includeIds: group.resourceIds })
      : '';
    if (!groupHtml || !attachedResourcesHtml) return groupHtml;
    const resourcesFirst = group.resourcePlacement === 'above';
    return `<div class="profession-palette-resource-group resource-${esc(group.resourcePlacement || 'below')}">
              ${resourcesFirst ? attachedResourcesHtml : groupHtml}
              ${resourcesFirst ? groupHtml : attachedResourcesHtml}
            </div>`;
  };

  const renderedStackIds = new Set<string>();
  const professionGroupsHtml = standardProfessionGroups
    .map((group) => {
      if (!group.stackId) {
        return stackWithResources(renderProfessionGroup(group), group.resourceAnchor && !loadoutHasResourceAnchor);
      }

      if (renderedStackIds.has(group.stackId)) return '';
      renderedStackIds.add(group.stackId);
      const stackedGroups = standardProfessionGroups.filter((candidate) => candidate.stackId === group.stackId);
      const stackHtml = `<div class="profession-palette-stack"
            data-palette-stack="${esc(group.stackId)}">${stackedGroups.map(renderProfessionGroup).join('')}</div>`;
      return stackWithResources(
        stackHtml,
        !loadoutHasResourceAnchor && stackedGroups.some((candidate) => candidate.resourceAnchor)
      );
    })
    .join('');

  const unanchoredResourceGroupsHtml = resourceAnchorRendered ? '' : resourceGroupsHtml;
  const professionPaletteContent = professionGroupsHtml + unanchoredResourceGroupsHtml + loadoutBeforeWeapons;
  const professionPaletteSectionHtml = professionPaletteContent
    ? `<div class="profession-palette-section"
          data-role="profession-palette-section">${professionPaletteContent}</div>`
    : '';

  const utilityGroupHtml = addGroup(
    app,
    'Skill',
    selectedWithFlips,
    '#cbb8ea',
    professionAllowsPaletteSkill,
    professionPaletteUnavailableMessage,
    'utility-palette-group',
    undefined,
    [],
    '',
    professionPaletteRetryAt
  );

  const paletteWeaponSkills = (skills: readonly Skill[], context: SchedulerRecord = {}): Skill[] =>
    app.profession.ui.paletteWeaponSkills({ ...paletteContext, ...context }, skills);
  // Custom weapon layouts still receive generic availability, tooltip, and
  // interaction markup instead of rebuilding those policies themselves.
  const renderWeaponSkill = (skill: Skill, options: ProfessionPaletteSkillRenderOptions = {}): string => {
    const contextAvailable = options.contextAvailable ?? weaponSkillAvailable(skill, 1);
    const contextMessage = options.contextMessage ?? weaponSkillUnavailableMessage(skill, 1);
    return paletteSkillHtml({
      ...paletteSkillView(app, skill, contextAvailable, contextMessage),
      ...((options.view || {}) as PaletteSkillView)
    });
  };

  const customWeaponPalette = app.profession.ui.renderWeaponPalette({
    ...paletteContext,
    skills: paletteWeaponSkills(displayedWeaponSkills(app, weaponSkills(app, 1), 1, paletteContext), { weaponSet: 1 }),
    autoattackChains,
    isSkillAvailable: (skill) => weaponSkillAvailable(skill, 1),
    unavailableMessage: (skill) => weaponSkillUnavailableMessage(skill, 1),
    renderSkill: renderWeaponSkill
  });

  const positionedActiveWeaponGroups = new Set<string>();
  // Standard layouts place weapon swap in the first active weapon row and then
  // omit it from the shared action row.
  let weaponSwapEmbedded = false;
  const weaponGroupsHtml = (() => {
    if (customWeaponPalette) {
      return [
        ...customWeaponPalette.weaponGroupsHtml,
        ...weaponSetOneProfessionGroups.map(renderProfessionGroup)
      ].filter(Boolean);
    }

    const weaponRows = weaponPaletteRows(app, activeWeaponSet, paletteContext)
      .map((row) => ({
        ...row,
        skills: paletteWeaponSkills(row.skills, {
          weaponSet: row.weaponSet,
          weaponRow: row
        })
      }))
      .filter((row) => row.skills.length);
    return weaponRows.flatMap((row, index) => {
      const rowWeaponSwapActions = row.active && !weaponSwapEmbedded ? weaponSwapActions : [];
      if (rowWeaponSwapActions.length) weaponSwapEmbedded = true;
      const renderedRow = addGroup(
        app,
        row.label,
        [...row.skills, ...rowWeaponSwapActions],
        row.active ? '#a98fd8' : '#625a73',
        (skill) =>
          skill.name === 'Swap Weapons'
            ? professionAllowsPaletteSkill(skill)
            : weaponSkillAvailable(skill, row.weaponSet),
        (skill) =>
          skill.name === 'Swap Weapons'
            ? professionPaletteUnavailableMessage(skill)
            : weaponSkillUnavailableMessage(skill, row.weaponSet)
      );
      const positionedGroups = activeWeaponProfessionGroups.filter(
        (group) =>
          row.active &&
          !positionedActiveWeaponGroups.has(group.id) &&
          (!group.weaponRowLabel || group.weaponRowLabel === row.label)
      );
      positionedGroups.forEach((group) => positionedActiveWeaponGroups.add(group.id));
      return [
        renderedRow,
        ...positionedGroups.map(renderProfessionGroup),
        ...(row.weaponSet === 1 && weaponRows[index + 1]?.weaponSet !== 1
          ? weaponSetOneProfessionGroups.map(renderProfessionGroup)
          : [])
      ];
    });
  })();

  if (!customWeaponPalette) {
    weaponGroupsHtml.push(
      ...activeWeaponProfessionGroups
        .filter((group) => !positionedActiveWeaponGroups.has(group.id))
        .map(renderProfessionGroup)
    );
  }

  const activeWeaponPrimaryHtml = customWeaponPalette
    ? activeWeaponProfessionGroups.map(renderProfessionGroup).join('')
    : '';

  const timelineControlsHtml = `<div class="pal-group"><div class="pal-label" style="color:#d66d2f">Cmb</div>
            <div class="pal-row">${virtualPaletteSkillHtml({
              name: '__combat_start',
              title: 'Combat Start',
              icon: COMBAT_START_ICON,
              disabled: app.build.rotation.some((item) => rotationEntryName(item) === '__combat_start')
            })}</div>
        </div>
        <div class="pal-group"><div class="pal-label" style="color:#7e9ac7">Rst</div>
            <div class="pal-row">${virtualPaletteSkillHtml({
              name: '__cooldown_reset',
              title: 'Cooldown Reset',
              icon: COOLDOWN_RESET_ICON
            })}</div>
        </div>
        <div class="pal-group"><div class="pal-label" style="color:#8d7a57">W8</div>
            <div class="pal-row">${virtualPaletteSkillHtml({
              name: '__wait',
              title: 'Wait',
              icon: WAIT_ICON
            })}</div>
        </div>`;

  const timelineToolsHtml = `<div class="timeline-tools-palette-stack"
        data-role="timeline-tools-palette-stack">
          <div class="pal-break"></div>
          ${timelineControlsHtml}
      </div>`;

  const actionGroupHtml = addGroup(
    app,
    'Act',
    weaponSwapEmbedded ? generalActions : actions,
    '#70b6d0',
    professionAllowsPaletteSkill,
    professionPaletteUnavailableMessage,
    'action-palette-group'
  );

  const primaryPaletteHtml = customWeaponPalette
    ? `<div class="${esc(customWeaponPalette.primaryClassName || 'profession-weapon-primary')}" data-role="${esc(customWeaponPalette.primaryRole || 'profession-weapon-primary')}">
          ${professionPaletteSectionHtml}
          ${customWeaponPalette.activeWeaponHtml || ''}
          ${activeWeaponPrimaryHtml}
          ${customWeaponPalette.placeUtilityInPrimary ? utilityGroupHtml : ''}
          ${customWeaponPalette.placeActionsInPrimary ? actionGroupHtml : ''}
        </div>${customWeaponPalette.placeUtilityInPrimary ? '' : utilityGroupHtml}`
    : professionPaletteSectionHtml + utilityGroupHtml;

  return (
    primaryPaletteHtml +
    weaponPaletteSectionHtml(weaponGroupsHtml, customWeaponPalette?.placeActionsInPrimary ? '' : actionGroupHtml) +
    loadoutUtilityGroup +
    // Timeline-only controls stay in a named region so responsive layouts can
    // move the row as one unit.
    timelineToolsHtml
  );
}

/** Replaces the rotation palette markup and binds activation and drag behavior. */
export function renderPalette(app: ProfessionAppState): void {
  const element = document.getElementById('rotation-palette');
  if (!element) return;
  const paletteContext = createPaletteContext(app);
  element.innerHTML = paletteHtml(app, paletteContext);

  bindAppPaletteInteractions(app, element, paletteContext);
}
