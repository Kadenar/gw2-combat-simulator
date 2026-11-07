/** Composes palette markup from projected state and binds the current rendered controls. */
import { updatePaletteFreshness } from '#gw2/app/rotation/palette/freshness.js';
import { capturePaletteInput } from '#gw2/app/rotation/palette/input.js';
import { bindAppPaletteInteractions } from '#gw2/app/rotation/palette/interactions.js';
import {
  projectPalette,
  queryPaletteContext,
  type PaletteGroupView,
  type PaletteProjection,
  type PaletteSkillView
} from '#gw2/app/rotation/palette/model.js';
import { activeResourceGroup } from '#gw2/app/rotation/palette/resource-view.js';
import { PLACEHOLDER_ICON } from '#gw2/app/shared/placeholder-icon.js';
import { restoreFocusWithoutTooltip, skillTooltipAttributes } from '#gw2/app/shared/tooltip-overlay.js';
import type { ProfessionAppState } from '#gw2/app/types.js';
import type { ProfessionPaletteControl } from '#gw2/platform/profession-presentation/types.js';
import { boundedNumber } from '#kernel/core/numeric.js';
import { escapeHtml as esc } from '#ui/shared/html.js';

export function paletteSkillHtml(view: PaletteSkillView = {}): string {
  const ammo = view.ammo;
  const resource = view.resource;
  const skillId = view.skillId == null ? '' : String(view.skillId);
  const hotkeyAction = String(view.hotkeyAction || '');
  const disabled = Boolean(view.disabled);
  const contextDisabled = Boolean(view.contextDisabled);
  // Cooldowns still allow queueing a future cast; only context restrictions block activation.
  // Both states retain the existing restriction on dragging.
  const draggable = Boolean(view.draggable) && !disabled && !contextDisabled;
  const classes = [
    'pal-skill',
    disabled ? 'pal-disabled' : '',
    contextDisabled ? 'pal-context-disabled' : '',
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
  const accessibleName = view.title || view.name || 'Skill';
  const ariaLabel = [
    accessibleName,
    ammo ? `${ammo.current}/${ammo.maximum} charges` : '',
    view.cooldownLabel ? `Cooldown: ${view.cooldownLabel}` : ''
  ]
    .filter(Boolean)
    .join(', ');
  const resourceMaximum = Math.max(0, Number(resource?.maximum || 0));
  const resourceValue = boundedNumber(resource?.value || 0, 0, 0, resourceMaximum);
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
  // Delayed wiki cards let rapid palette clicks and drags finish without an overlay appearing under the pointer.
  return `<button type="button" class="${classes}" data-skill="${esc(view.name)}"
    ${skillId ? `data-skill-id="${esc(skillId)}"` : ''}
    ${view.displaySkillId != null ? `data-display-skill-id="${esc(view.displaySkillId)}"` : ''}
    ${hotkeyAction ? `data-hotkey-action="${esc(hotkeyAction)}"` : ''}
    ${view.skill && view.tooltip ? `${skillTooltipAttributes(view.skill, view.tooltip, { details: view.castDetails, detailsTitle: 'Cast details', notice: view.notice })} data-wiki-delay="700"` : `title="${esc(view.title || view.name)}"`} draggable="${draggable ? 'true' : 'false'}"
    aria-label="${esc(ariaLabel)}" aria-disabled="${contextDisabled}"
    style="--att-border:${esc(view.color || '#a88be8')}">
    <img src="${esc(view.icon || PLACEHOLDER_ICON)}" alt="" />
    ${view.variantBadge ? `<span class="skill-variant-badge pal-variant-badge">${esc(view.variantBadge)}</span>` : ''}
    ${view.cooldownLabel ? `<span class="pal-cd">${esc(view.cooldownLabel)}</span>` : ''}
    ${ammoIndicator}
    ${resourceIndicator}
  </button>`;
}

function paletteControlHtml(view: ProfessionPaletteControl): string {
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
    <div class="pal-row">${statusIconHtml}${controls.map(paletteControlHtml).join('')}${skills.map(paletteSkillHtml).join('')}</div>
  </div>`;
}

export function weaponPaletteStackHtml(groups: readonly string[] = []): string {
  const content = groups.filter(Boolean).join('');
  return content ? `<div class="weapon-palette-stack" data-role="weapon-set-stack">${content}</div>` : '';
}

export function weaponPaletteSectionHtml(weaponGroups: readonly string[] = [], actionGroup = ''): string {
  const weapons = weaponPaletteStackHtml(weaponGroups);
  return weapons || actionGroup
    ? `<div class="weapon-palette-section" data-role="weapon-palette-section">${weapons}${actionGroup}</div>`
    : '';
}

/** Compose markup from completed projection data; rendering does not consult application state. */
export function paletteHtml(projection: PaletteProjection): string {
  const { renderedProfessionGroups, renderedLoadoutGroups, resources, loadoutAfterActions } = projection;
  const loadoutHasResourceAnchor = renderedLoadoutGroups.some((group) => group.resourceAnchor);
  const loadoutStackHtml = renderedLoadoutGroups.length
    ? `<div class="weapon-palette-stack loadout-palette-stack"
            data-role="loadout-palette-stack"
            >${renderedLoadoutGroups.map(paletteGroupHtml).join('')}</div>`
    : '';
  const attachedResourceIds = renderedProfessionGroups.flatMap((group) => group.resourceIds || []);

  // Resources attached to a specific group are rendered with that group and
  // excluded from the remaining unpositioned resource block.
  const resourceGroupsHtml = activeResourceGroup(resources, {
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
  const loadoutBeforeWeapons = loadoutAfterActions ? '' : loadoutStack;
  const loadoutUtilityGroup =
    loadoutAfterActions && loadoutStack
      ? `<div class="utility-palette-group loadout-utility-palette-group"
            data-role="loadout-utility-palette-group">${loadoutStack}</div>`
      : '';
  // Place each profession-owned group beside its declared palette section.
  const standardProfessionGroups = renderedProfessionGroups.filter(
    (group) => group.placement === 'profession' || !group.placement
  );

  const renderProfessionGroup = (group: PaletteGroupView): string => {
    const groupHtml = paletteGroupHtml(group);
    const attachedResourcesHtml = group.resourceIds?.length
      ? activeResourceGroup(resources, { includeIds: group.resourceIds })
      : '';

    if (!groupHtml || !attachedResourcesHtml) return groupHtml;

    const resourcesFirst = group.resourcePlacement === 'above';
    return `<div class="profession-palette-resource-group resource-${esc(group.resourcePlacement)}">
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

  const utilitySkillsHtml = paletteGroupHtml(projection.utilityGroup);
  // Stack conjure bars and their controls below utilities, preserving the utility column on every layout.
  const utilityProfessionGroups = renderedProfessionGroups.filter((group) => group.placement === 'utility');
  const utilityGroupHtml = utilityProfessionGroups.length
    ? `<div class="profession-palette-stack utility-palette-group" data-role="utility-palette-stack">${utilitySkillsHtml}${utilityProfessionGroups.map(renderProfessionGroup).join('')}</div>`
    : utilitySkillsHtml;

  const customWeaponPalette = projection.customWeaponPalette?.render(
    projection.customWeaponPalette.skills.map(paletteSkillHtml)
  );
  const weaponGroupsHtml = [
    ...(customWeaponPalette?.weaponGroupsHtml || []),
    ...projection.weaponGroups.map(renderProfessionGroup)
  ];
  const activeWeaponPrimaryHtml = projection.activeWeaponPrimaryGroups.map(renderProfessionGroup).join('');
  const timelineControlsHtml = projection.timelineControls.map(paletteGroupHtml).join('');

  const timelineToolsHtml = `<div class="timeline-tools-palette-stack"
        data-role="timeline-tools-palette-stack">
          <div class="pal-break"></div>
          ${timelineControlsHtml}
      </div>`;

  const actionGroupHtml = paletteGroupHtml(projection.actionGroup);

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

  // Simulation replaces the tiles; keep keyboard users on the same action, including advancing autoattack chains.
  const focused =
    document.activeElement?.matches('button.pal-skill, button.pal-control') && element.contains(document.activeElement)
      ? (document.activeElement as HTMLButtonElement)
      : null;
  const focusIdentity = focused?.dataset;
  const focusIndex = focused ? [...element.querySelectorAll('button')].indexOf(focused) : -1;
  const input = capturePaletteInput(app);
  const paletteContext = queryPaletteContext(input);
  element.innerHTML = paletteHtml(projectPalette(input));
  updatePaletteFreshness(app);

  bindAppPaletteInteractions(app, element, paletteContext);

  if (focusIdentity) {
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('button')];
    const replacement =
      buttons.find((button) =>
        focusIdentity.paletteControlId
          ? button.dataset.paletteControlId === focusIdentity.paletteControlId
          : button.dataset.skill === focusIdentity.skill &&
            button.dataset.skillId === focusIdentity.skillId &&
            button.dataset.hotkeyAction === focusIdentity.hotkeyAction
      ) ||
      buttons.find(
        (button) => focusIdentity.hotkeyAction && button.dataset.hotkeyAction === focusIdentity.hotkeyAction
      ) ||
      buttons[focusIndex];

    if (replacement) restoreFocusWithoutTooltip(replacement);
  }
}
