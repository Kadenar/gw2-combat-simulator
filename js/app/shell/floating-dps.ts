/** Owns the viewport-pinned floating DPS badge shown alongside the rotation workspace. */
const FLOATING_DPS_PLACEHOLDER = '\u2014';

/** Mounts the current rotation DPS as a viewport-pinned status that survives page scrolling and view changes. */
export function mountFloatingDps(root: Document = document): HTMLOutputElement | null {
  const existing = root.getElementById('floating-dps');
  if (existing) return existing as HTMLOutputElement;
  if (!root.body || !root.querySelector('.simulation-workspace')) return null;

  const indicator = root.createElement('output');
  indicator.id = 'floating-dps';
  indicator.className = 'floating-dps';
  indicator.setAttribute('aria-live', 'polite');
  indicator.setAttribute('aria-label', 'Current rotation DPS unavailable');

  const label = root.createElement('span');
  label.className = 'floating-dps-label';
  label.textContent = 'DPS';

  const value = root.createElement('strong');
  value.className = 'floating-dps-value';
  value.textContent = FLOATING_DPS_PLACEHOLDER;

  indicator.append(label, value);
  // Anchoring to the fixed legal footer keeps the badge above its real rendered height at every viewport width.
  const footer = root.documentElement?.classList.contains('embed')
    ? null
    : root.querySelector<HTMLElement>('.landing-footer');
  if (!footer) indicator.className += ' floating-dps-viewport';
  const host = footer || root.body;
  host.append(indicator);
  return indicator;
}

/** Keeps the pinned status synchronized with the latest formatted simulation result. */
export function updateFloatingDps(value: string | null | undefined, root: Document = document): void {
  const indicator = root.getElementById('floating-dps');
  const valueElement = indicator?.querySelector<HTMLElement>('.floating-dps-value');
  if (!indicator || !valueElement) return;

  const displayValue = value?.trim() || FLOATING_DPS_PLACEHOLDER;
  valueElement.textContent = displayValue;
  indicator.setAttribute(
    'aria-label',
    displayValue === FLOATING_DPS_PLACEHOLDER
      ? 'Current rotation DPS unavailable'
      : `Current rotation DPS: ${displayValue}`
  );
}
