/** Publishes each result to both the visual header DPS value and the focus-mode announcement. */
const HEADER_DPS_PLACEHOLDER = '-';

/** Keep DPS beside the active build so the sticky toolbar associates the result with its build. */
export function mountHeaderDps(root: Document = document): void {
  const existing = root.getElementById('header-dps');

  if (existing) return;

  const host = root.querySelector('#build-switcher-menu');

  if (!host) return;

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
}

/** Updates both DPS statuses from one formatted result, announcing only changed values in focus mode. */
export function updateDpsStatus(value: string | null | undefined, root: Document = document): void {
  const indicator = root.getElementById('header-dps');
  const valueElement = indicator?.querySelector<HTMLElement>('.header-dps-value');
  const displayValue = value?.trim() || HEADER_DPS_PLACEHOLDER;

  // Publish only a changed DPS value in Focus view, independently of the larger visual summary.
  const status = root.getElementById('rotation-dps-status');
  const announcement = displayValue === HEADER_DPS_PLACEHOLDER ? 'DPS unavailable' : `DPS: ${displayValue}`;

  if (status && status.textContent !== announcement) status.textContent = announcement;

  if (!indicator || !valueElement) return;

  valueElement.textContent = displayValue;
  indicator.setAttribute(
    'aria-label',
    displayValue === HEADER_DPS_PLACEHOLDER
      ? 'Current rotation DPS unavailable'
      : `Current rotation DPS: ${displayValue}`
  );
}
