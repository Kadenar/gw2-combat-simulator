/** Collapse existing header controls into native popovers on phones without duplicating their actions. */
import { clamp } from '#kernel/core/numeric.js';

export function mountMobileMenu(
  trigger: HTMLButtonElement,
  menu: HTMLElement,
  selectedSelector?: string,
  onLayout?: (mobile: boolean) => void
): void {
  const viewport = window.matchMedia('(max-width: 600px)');
  trigger.classList.add('mobile-header-trigger');
  trigger.setAttribute('popovertarget', menu.id);
  menu.classList.add('mobile-header-menu');

  const updateLabel = (): void => {
    if (selectedSelector) trigger.textContent = menu.querySelector(selectedSelector)?.textContent ?? '';
  };

  updateLabel();

  if (selectedSelector)
    new MutationObserver(updateLabel).observe(menu, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-current', 'aria-pressed']
    });

  const position = (): void => {
    if (!menu.matches(':popover-open')) return;

    const bounds = trigger.getBoundingClientRect();
    menu.style.left = `${clamp(bounds.left, 8, innerWidth - menu.offsetWidth - 8)}px`;
    menu.style.top = `${clamp(bounds.bottom + 4, 8, innerHeight - menu.offsetHeight - 8)}px`;
  };

  const updateLayout = (): void => {
    if (menu.matches(':popover-open')) menu.hidePopover();

    menu.toggleAttribute('popover', viewport.matches);

    if (viewport.matches) menu.setAttribute('popover', 'auto');

    trigger.setAttribute('aria-expanded', 'false');
    menu.style.removeProperty('left');
    menu.style.removeProperty('top');
    onLayout?.(viewport.matches);
  };

  menu.addEventListener('beforetoggle', (event) => {
    trigger.setAttribute('aria-expanded', String(event.newState === 'open'));

    if (event.newState === 'open') requestAnimationFrame(position);
  });
  menu.addEventListener('click', (event) => {
    const action = (event.target as Element).closest('a, button');

    if (!action || action.hasAttribute('popovertarget') || !menu.matches(':popover-open')) return;

    menu.hidePopover();
  });
  window.addEventListener('resize', position);
  viewport.addEventListener('change', updateLayout);
  updateLayout();
}
