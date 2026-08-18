import type { SchedulerRecord } from '../engine/types.js';
import type { ProfessionAppContract } from '../../app/profession/types.js';
import type {
  AmmoView,
  NormalizedPaletteGroup,
  PaletteControlView,
  PaletteDragEvent,
  PaletteGroupView,
  PaletteInteractionHandlers,
  PaletteMouseEvent,
  PaletteSkillView
} from './types.js';
import { escapeHtml } from './html.js';

const PALETTE_PLACEHOLDER_ICON =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" ' +
  'height="64"%3E%3Crect width="64" height="64" fill="%23232632"/%3E' +
  '%3Cpath d="M17 46L32 13l15 33z" fill="%23a38ad5"/%3E%3C/svg%3E';

export function paletteView(profession: ProfessionAppContract, context: SchedulerRecord): NormalizedPaletteGroup[] {
  const groups = profession.ui.paletteGroups(context);
  if (!Array.isArray(groups)) {
    throw new TypeError('paletteGroups must return an array.');
  }
  // Copy and normalize the profession boundary so renderers never mutate
  // catalog-owned group definitions.
  return groups.map((group) => ({
    id: String(group.id),
    label: String(group.label || group.id),
    skillIds: [...(group.skillIds || [])],
    reservedSkillIds: [...(group.reservedSkillIds || [])],
    skillEntries: (group.skillEntries || []).map((entry) => ({ ...entry })),
    color: String(group.color || ''),
    className: String(group.className || ''),
    stackId: String(group.stackId || ''),
    placement:
      group.placement === 'weapon-set-1' || group.placement === 'active-weapon' ? group.placement : 'profession',
    weaponRowLabel: String(group.weaponRowLabel || ''),
    resourceAnchor: Boolean(group.resourceAnchor),
    resourceIds: (group.resourceIds || []).map(String),
    resourcePlacement:
      group.resourcePlacement === 'above' || group.resourcePlacement === 'beside' || group.resourcePlacement === 'below'
        ? group.resourcePlacement
        : 'below',
    includeActionSkills: Boolean(group.includeActionSkills),
    controls: (group.controls || []).map((control) => ({
      id: String(control.id),
      label: String(control.label || control.id),
      icon: String(control.icon || ''),
      title: String(control.title || control.label || control.id),
      color: String(control.color || ''),
      className: String(control.className || ''),
      active: Boolean(control.active),
      pressed: Boolean(control.pressed),
      muted: Boolean(control.muted),
      badge: String(control.badge || '')
    })),
    statusIcon: group.statusIcon
      ? {
          icon: String(group.statusIcon.icon || ''),
          label: String(group.statusIcon.label || ''),
          title: String(group.statusIcon.title || group.statusIcon.label || '')
        }
      : undefined
  }));
}

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
    ? `<span class="pal-skill-resource" data-resource-id="${escapeHtml(resource.id)}"
        role="progressbar" aria-label="${escapeHtml(resource.label)}"
        aria-valuemin="0" aria-valuemax="${resourceMaximum}"
        aria-valuenow="${resourceValue}">
        <span style="width:${resourcePercent}%"></span>
      </span>
      <span class="pal-skill-resource-value" data-resource-id="${escapeHtml(resource.id)}"
        aria-hidden="true">${Math.round(resourceValue)}/${resourceMaximum}</span>`
    : '';
  return `<div class="${classes}" data-skill="${escapeHtml(view.name)}"
    ${skillId ? `data-skill-id="${escapeHtml(skillId)}"` : ''}
    ${hotkeyAction ? `data-hotkey-action="${escapeHtml(hotkeyAction)}"` : ''}
    title="${escapeHtml(view.title || view.name)}" draggable="${draggable ? 'true' : 'false'}"
    ${ariaLabel ? `aria-label="${escapeHtml(ariaLabel)}"` : ''}
    style="--att-border:${escapeHtml(view.color || '#a88be8')}">
    <img src="${escapeHtml(view.icon || PALETTE_PLACEHOLDER_ICON)}" alt=""
      data-fallback-icon="${escapeHtml(PALETTE_PLACEHOLDER_ICON)}" />
    ${view.variantBadge ? `<span class="skill-variant-badge pal-variant-badge">${escapeHtml(view.variantBadge)}</span>` : ''}
    ${view.cooldownLabel ? `<span class="pal-cd">${escapeHtml(view.cooldownLabel)}</span>` : ''}
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
  return `<button type="button" class="${escapeHtml(classes)}"
      data-palette-control-id="${escapeHtml(view.id)}"
      aria-pressed="${view.pressed ? 'true' : 'false'}"
      aria-label="${escapeHtml(title)}" title="${escapeHtml(title)}"
      style="--att-border:${escapeHtml(view.color || '#a88be8')}">
      <img src="${escapeHtml(view.icon || PALETTE_PLACEHOLDER_ICON)}" alt="" />
      ${view.badge ? `<span class="pal-control-badge" aria-hidden="true">${escapeHtml(view.badge)}</span>` : ''}
    </button>`;
}

export function paletteGroupHtml(view: PaletteGroupView = {}): string {
  const skills = view.skills || [];
  const controls = view.controls || [];
  const statusIcon = view.statusIcon;
  // Empty groups occupy no layout space.
  if (!skills.length && !controls.length && !statusIcon) return '';
  const statusIconHtml = statusIcon
    ? `<div class="pal-status-icon" title="${escapeHtml(statusIcon.title || statusIcon.label)}"
        aria-label="${escapeHtml(statusIcon.label)}">
        <img src="${escapeHtml(statusIcon.icon || PALETTE_PLACEHOLDER_ICON)}"
          alt="${escapeHtml(statusIcon.label)}" />
      </div>`
    : '';
  return `<div class="pal-group${view.className ? ` ${escapeHtml(view.className)}` : ''}"
      ${view.id ? `data-palette-group="${escapeHtml(view.id)}"` : ''}>
    <div class="pal-label" style="color:${escapeHtml(view.color || '#a88be8')}">${escapeHtml(view.label)}</div>
    <div class="pal-row">${statusIconHtml}${controls.map(paletteControlHtml).join('')}${skills
      .map((skill) => (skill?.virtual ? virtualPaletteSkillHtml(skill) : paletteSkillHtml(skill)))
      .join('')}</div>
  </div>`;
}

export function bindPaletteInteractions(
  root: HTMLElement | null | undefined,
  handlers: PaletteInteractionHandlers = {}
): void {
  if (!root) return;
  for (const control of root.querySelectorAll<HTMLElement>('.pal-control[data-palette-control-id]')) {
    control.onclick = (event) => {
      handlers.onControlActivate?.(control.dataset.paletteControlId || '', event as unknown as PaletteMouseEvent);
    };
  }
  // Assign DOM handler properties rather than accumulating listeners, making
  // rebinding the same rendered palette idempotent.
  for (const icon of root.querySelectorAll<HTMLElement>('.pal-skill[data-skill]')) {
    const name = icon.dataset.skill || '';
    const draggable = icon.getAttribute('draggable') === 'true';
    const image = icon.querySelector<HTMLImageElement>('img[data-fallback-icon]');
    if (image) {
      const useFallback = (): void => {
        image.onerror = null;
        image.src = image.dataset.fallbackIcon || '';
      };
      image.onerror = useFallback;
      if (image.complete && image.naturalWidth === 0) useFallback();
    }
    icon.onclick = (event) => {
      if (icon.classList.contains('pal-context-disabled')) return;
      handlers.onActivate?.(name, event as unknown as PaletteMouseEvent);
    };
    icon.ondragstart = (event) => {
      if (!draggable) {
        event.preventDefault();
        return;
      }
      if (handlers.onDragStart?.(name, event as PaletteDragEvent) === false) {
        event.preventDefault();
        return;
      }
      icon.classList.add('dragging');
      event.dataTransfer?.setData('text/plain', name);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
    };
    icon.ondragend = (event) => {
      icon.classList.remove('dragging');
      handlers.onDragEnd?.(name, event as PaletteDragEvent);
    };
  }
}
