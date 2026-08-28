import type { ProfessionPaletteGroup, SchedulerRecord, SkillId } from '../../../platform/engine/types.js';
import { GW2_ICON_PLACEHOLDER } from '../shared/gw2-icon-fallback.js';
import { escapeHtml } from '../shared/html.js';

export interface AmmoView {
  readonly current?: number;
  readonly maximum?: number;
  readonly pips?: readonly boolean[];
}

export interface PaletteResourceView {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly maximum: number;
}

export interface PaletteStatusIconView {
  readonly icon: string;
  readonly label: string;
  readonly title?: string;
}

export interface PaletteControlView {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly title?: string;
  readonly color?: string;
  readonly className?: string;
  readonly active?: boolean;
  readonly pressed?: boolean;
  readonly muted?: boolean;
  readonly badge?: string;
}

export interface PaletteSkillView extends SchedulerRecord {
  readonly name?: string;
  readonly skillId?: SkillId | null;
  readonly hotkeyAction?: string;
  readonly title?: string;
  readonly icon?: string;
  readonly variantBadge?: string;
  readonly color?: string;
  readonly disabled?: boolean;
  readonly contextDisabled?: boolean;
  readonly concealed?: boolean;
  readonly highlighted?: boolean;
  readonly draggable?: boolean;
  readonly cooldownLabel?: string;
  readonly ammo?: AmmoView | null;
  readonly resource?: PaletteResourceView | null;
  readonly virtual?: boolean;
}

export interface PaletteGroupView {
  readonly id?: string;
  readonly label?: string;
  readonly color?: string;
  readonly className?: string;
  readonly skills?: readonly PaletteSkillView[];
  readonly controls?: readonly PaletteControlView[];
  readonly statusIcon?: PaletteStatusIconView;
}

export interface NormalizedPaletteGroup extends Omit<ProfessionPaletteGroup, 'skillEntries'> {
  readonly skillEntries: SchedulerRecord[];
  readonly reservedSkillIds: readonly number[];
  readonly color: string;
  readonly className: string;
  readonly stackId: string;
  readonly placement: 'profession' | 'weapon-set-1' | 'active-weapon';
  readonly weaponRowLabel: string;
  readonly resourceAnchor: boolean;
  readonly resourceIds: readonly string[];
  readonly resourcePlacement: 'above' | 'beside' | 'below';
}

export type PaletteMouseEvent = MouseEvent & {
  readonly currentTarget: HTMLElement;
};

export type PaletteDragEvent = DragEvent & {
  readonly currentTarget: HTMLElement;
};

export interface PaletteInteractionHandlers {
  readonly onActivate?: (name: string, event: PaletteMouseEvent) => unknown;
  readonly onControlActivate?: (id: string, event: PaletteMouseEvent) => unknown;
  readonly onDragStart?: (name: string, event: PaletteDragEvent) => unknown;
  readonly onDragEnd?: (name: string, event: PaletteDragEvent) => unknown;
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
    <img src="${escapeHtml(view.icon || GW2_ICON_PLACEHOLDER)}" alt="" />
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
      <img src="${escapeHtml(view.icon || GW2_ICON_PLACEHOLDER)}" alt="" />
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
        <img src="${escapeHtml(statusIcon.icon || GW2_ICON_PLACEHOLDER)}"
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
  // Restore optional palette panels after every rerender and persist the next native disclosure toggle.
  for (const disclosure of root.querySelectorAll<HTMLDetailsElement>('details[data-palette-storage-key]')) {
    const storageKey = disclosure.dataset.paletteStorageKey;
    if (!storageKey) continue;
    try {
      const stored = root.ownerDocument.defaultView?.localStorage.getItem(storageKey);
      if (stored === 'true' || stored === 'false') disclosure.open = stored === 'true';
    } catch {
      // Browser storage may be unavailable in private or embedded contexts.
    }
    disclosure.ontoggle = () => {
      try {
        root.ownerDocument.defaultView?.localStorage.setItem(storageKey, String(disclosure.open));
      } catch {
        // Browser storage may be unavailable in private or embedded contexts.
      }
    };
  }

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
