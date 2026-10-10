/** Owns the live DPS status shared by standalone and embedded simulator headers. */
const HEADER_DPS_PLACEHOLDER = '\u2014';

/** Keep DPS beside the active build so the sticky toolbar associates the result with its build. */
export function mountHeaderDps(root: Document = document): HTMLOutputElement | null {
  const existing = root.getElementById('header-dps');
  if (existing) return existing as HTMLOutputElement;
  const host = root.querySelector('#build-switcher-menu');
  if (!host) return null;

  const indicator = root.createElement('output');
  indicator.id = 'header-dps';
  indicator.className = 'header-dps';
  indicator.setAttribute('aria-live', 'polite');
  indicator.setAttribute('aria-label', 'Current rotation DPS unavailable');

  const label = root.createElement('span');
  label.className = 'header-dps-label';
  label.textContent = 'DPS';

  const value = root.createElement('strong');
  value.className = 'header-dps-value';
  value.textContent = HEADER_DPS_PLACEHOLDER;

  indicator.append(label, value);
  host.after(indicator);
  return indicator;
}

/** Keeps the header status synchronized with the latest formatted simulation result. */
export function updateHeaderDps(value: string | null | undefined, root: Document = document): void {
  const indicator = root.getElementById('header-dps');
  const valueElement = indicator?.querySelector<HTMLElement>('.header-dps-value');
  if (!indicator || !valueElement) return;

  const displayValue = value?.trim() || HEADER_DPS_PLACEHOLDER;
  valueElement.textContent = displayValue;
  indicator.setAttribute(
    'aria-label',
    displayValue === HEADER_DPS_PLACEHOLDER
      ? 'Current rotation DPS unavailable'
      : `Current rotation DPS: ${displayValue}`
  );
}
