import { gw2ApiText } from '#gw2/app/shared/html.js';
import { escapeHtml as esc } from '#ui/shared/html.js';
import { MODIFIER_EFFECT_ICONS, tooltipFactIcon } from '#gw2/app/shared/icons.js';
import type { CatalogEntity, Skill, TooltipFact } from '#gw2/platform/engine/skills/types.js';
import type { SimulationTooltip } from '#gw2/app/shared/simulation-tooltip.js';

/** Keep descriptions local and escape both text and wiki titles before putting them in markup. */
export function wikiTooltipAttributes(
  name: unknown,
  description: unknown = '',
  wikiName: unknown = name,
  facts: readonly TooltipFact[] = [],
  factTabs: SimulationTooltip['factTabs'] = []
): string {
  if (!name || name === 'None') return '';
  return `data-wiki-name="${esc(name)}" data-wiki-description="${esc(gw2ApiText(description))}" data-wiki-page="${esc(wikiName)}" data-wiki-effects="${esc(JSON.stringify(facts))}" data-wiki-effect-tabs="${esc(JSON.stringify(factTabs))}"`;
}

/** Renders a locally described model; the selected simulation definitions own every numeric fact. */
export function skillTooltipAttributes(skill: Skill, tooltip: SimulationTooltip, contextDescription = ''): string {
  const description = [
    tooltip.description,
    contextDescription,
    tooltip.incomplete ? 'Some simulation details are not yet described.' : ''
  ]
    .filter(Boolean)
    .join('\n');
  const recharge = tooltip.facts.find(
    (fact) => fact.name === 'Base recharge' || fact.name === 'Base ammunition recharge'
  );
  const energy = tooltip.facts.find((fact) => fact.name === 'Base energy cost');
  // The heading badge reads the selected model, so it cannot retain an obsolete catalog cooldown after a patch switch.
  return (
    wikiTooltipAttributes(
      skill.displayName || skill.name,
      description,
      skill.displayName || skill.name,
      // Heading costs use the selected model and appear only once, beside the skill name.
      tooltip.facts.filter((fact) => fact !== recharge && fact !== energy),
      tooltip.factTabs
    ) +
    (energy && Number(energy.detail) > 0 ? ` data-wiki-energy="${esc(energy.detail)}"` : '') +
    (recharge ? ` data-wiki-recharge="${esc(recharge.detail.replace(/s$/, ''))}"` : '')
  );
}

/** Trait presentation has its own identity namespace and never merges imported fact strings. */
export function traitTooltipAttributes(trait: CatalogEntity, tooltip: SimulationTooltip): string {
  const description = [tooltip.description, tooltip.incomplete ? 'Some simulation details are not yet described.' : '']
    .filter(Boolean)
    .join('\n');
  return wikiTooltipAttributes(trait.name, description, trait.name, tooltip.facts, tooltip.factTabs);
}

let refreshTooltip: (() => void) | undefined;

/** Share one interactive overlay across rerenders, with time to move from an icon onto its wiki link. */
export function bindWikiTooltips(): void {
  if (refreshTooltip) {
    refreshTooltip();
    return;
  }

  const panel = document.createElement('div');
  panel.id = 'wiki-tooltip';
  panel.className = 'wiki-tooltip';
  panel.hidden = true;
  panel.popover = 'manual';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'wiki-tooltip-name');
  panel.innerHTML = `<div class="wiki-tooltip-heading"><img class="wiki-tooltip-item-icon" alt="" hidden><strong id="wiki-tooltip-name"></strong><span class="wiki-tooltip-costs"><span class="wiki-tooltip-energy"></span><span class="wiki-tooltip-recharge"></span></span></div>
    <div id="wiki-tooltip-description" class="wiki-tooltip-description"></div>
    <div class="wiki-tooltip-effects"></div>
    <div class="wiki-tooltip-upgrades"></div>
    <a target="_blank" rel="noopener noreferrer" aria-label="Open on wiki (opens in a new tab)">Open on wiki <span aria-hidden="true">↗</span></a>`;
  document.body.append(panel);
  const heading = panel.querySelector('strong')!;
  const description = panel.querySelector<HTMLElement>('.wiki-tooltip-description')!;
  const link = panel.querySelector('a')!;
  const recharge = panel.querySelector<HTMLElement>('.wiki-tooltip-recharge')!;
  const energy = panel.querySelector<HTMLElement>('.wiki-tooltip-energy')!;
  const effects = panel.querySelector<HTMLElement>('.wiki-tooltip-effects')!;
  const itemIcon = panel.querySelector<HTMLImageElement>('.wiki-tooltip-item-icon')!;
  const upgrades = panel.querySelector<HTMLElement>('.wiki-tooltip-upgrades')!;
  let trigger: HTMLElement | null = null;
  let returnFocus: HTMLElement | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let pointerInteraction = false;

  const cancelClose = () => clearTimeout(closeTimer);
  const close = () => {
    clearTimeout(openTimer);
    cancelClose();
    trigger?.removeAttribute('aria-describedby');
    trigger = null;
    returnFocus = null;
    if (panel.matches(':popover-open')) panel.hidePopover();
    clearTimeout(openTimer);
    panel.hidden = true;
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer = setTimeout(() => {
      if (!panel.matches(':hover') && !panel.contains(document.activeElement)) close();
    }, 180);
  };

  // Reposition after changing tabs because alternative payloads can have different heights.
  const position = () => {
    if (!trigger) return;
    panel.style.removeProperty('max-height');
    const rect = trigger.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    // All searchable pickers share this boundary, keeping skill, gear, and optimizer choices reachable.
    const menu = trigger.closest('.searchable-dropdown')?.getBoundingClientRect();
    if (menu) {
      if (menu.right + 6 + width <= window.innerWidth - 8 || menu.left - 6 - width >= 8) {
        panel.style.left = `${menu.right + 6 + width <= window.innerWidth - 8 ? menu.right + 6 : menu.left - 6 - width}px`;
        panel.style.top = `${Math.max(8, Math.min(rect.top, window.innerHeight - height - 8))}px`;
      } else {
        // Narrow viewports keep the card outside the menu and scroll its contents when vertical space is limited.
        const above = Math.max(0, menu.top - 14);
        const below = Math.max(0, window.innerHeight - menu.bottom - 14);
        panel.style.maxHeight = `${Math.max(above, below)}px`;
        panel.style.left = `${Math.max(8, Math.min(menu.left, window.innerWidth - width - 8))}px`;
        panel.style.top = `${below >= above ? menu.bottom + 6 : menu.top - 6 - panel.offsetHeight}px`;
      }

      return;
    }

    panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
    panel.style.top = `${Math.max(8, Math.min(rect.bottom + 6 + height <= window.innerHeight - 8 ? rect.bottom + 6 : rect.top - height - 6, window.innerHeight - height - 8))}px`;
  };

  // Tabs expose one alternative at a time and keep only the selected tab in the keyboard tab order.
  const selectTab = (selected: HTMLButtonElement) => {
    for (const tab of effects.querySelectorAll<HTMLButtonElement>('[role="tab"]')) {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')!)!.hidden = !active;
    }

    position();
  };

  effects.addEventListener('click', (event) => {
    const tab = (event.target as Element).closest<HTMLButtonElement>('[role="tab"]');
    if (tab) selectTab(tab);
  });
  effects.addEventListener('keydown', (event) => {
    const tabs = [...effects.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const index = tabs.indexOf(event.target as HTMLButtonElement);
    if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectTab(tabs[next]);
    tabs[next].focus();
  });

  // Common and alternative facts share identical escaping, icons, and application counts.
  const renderFacts = (facts: readonly TooltipFact[], stackDetails = false) =>
    facts
      .map(({ name, detail, applications = 1, stacks, icon: factIcon, prefix }) => {
        const icon = factIcon || tooltipFactIcon(name);
        // Icon badges replace stack prose while retaining an accessible count for screen readers.
        const badge = stacks == null ? '' : `<span class="wiki-tooltip-fact-stacks">${esc(stacks)}</span>`;
        const iconLabel =
          stacks == null
            ? 'aria-hidden="true"'
            : `role="img" aria-label="${esc(`${stacks} stack${stacks === 1 ? '' : 's'} of ${name}`)}"`;
        return `<div class="wiki-tooltip-fact">${prefix ? `<span class="wiki-tooltip-fact-icon"><img src="${esc(prefix.icon)}" alt="${esc(prefix.name)}"></span>` : ''}<span class="wiki-tooltip-fact-icon" ${iconLabel}>${icon ? `<img src="${esc(icon)}" alt="">` : '✦'}${badge}</span><span>${prefix ? `<span class="wiki-tooltip-fact-source">${esc(prefix.name)}</span>` : ''}${esc(name)}${detail ? (stackDetails ? `<span class="wiki-tooltip-upgrade-detail">${esc(gw2ApiText(detail))}</span>` : `: ${esc(gw2ApiText(detail))}`) : ''}${applications > 1 ? ` × ${applications} applications` : ''}</span></div>`;
      })
      .join('');

  const show = (element: HTMLElement) => {
    cancelClose();
    if (trigger === element) return;
    close();
    trigger = element;
    heading.textContent = element.dataset.wikiName || '';
    // Gear shares the interactive card, with artwork and upgrades separate from base attributes.
    panel.classList.toggle('wiki-tooltip-equipment', element.dataset.wikiEquipment === 'true');
    itemIcon.hidden = !element.dataset.wikiIcon;
    if (element.dataset.wikiIcon) itemIcon.src = element.dataset.wikiIcon;
    else itemIcon.removeAttribute('src');
    const upgradeFacts: TooltipFact[] = JSON.parse(element.dataset.wikiUpgrades || '[]');
    upgrades.hidden = !upgradeFacts.length;
    upgrades.innerHTML = renderFacts(upgradeFacts, true);
    description.innerHTML = esc(element.dataset.wikiDescription || '').replace(
      /(Signet (?:Passive|Active):)/g,
      '<span class="wiki-tooltip-highlight">$1</span>'
    );
    description.hidden = !description.textContent;
    // Clear the shared badge when the next skill has no positive energy cost.
    energy.innerHTML = element.dataset.wikiEnergy
      ? `${esc(element.dataset.wikiEnergy)} <img src="${esc(MODIFIER_EFFECT_ICONS['Energy cost'])}" alt="">`
      : '';
    energy.setAttribute('aria-label', `Energy cost: ${element.dataset.wikiEnergy || 0}`);
    energy.hidden = !element.dataset.wikiEnergy;
    // Use the same game recharge asset in the heading and qualified recharge fact rows.
    recharge.innerHTML = element.dataset.wikiRecharge
      ? `${esc(element.dataset.wikiRecharge)} <img src="${esc(MODIFIER_EFFECT_ICONS.Recharge)}" alt="">`
      : '';
    recharge.setAttribute('aria-label', `Recharge: ${element.dataset.wikiRecharge || 0} seconds`);
    recharge.hidden = !element.dataset.wikiRecharge;
    const facts: TooltipFact[] = JSON.parse(element.dataset.wikiEffects || '[]');
    const factTabs: NonNullable<SimulationTooltip['factTabs']> = JSON.parse(element.dataset.wikiEffectTabs || '[]');
    effects.hidden = !facts.length && !factTabs.length;
    effects.innerHTML = `${facts.length && !factTabs.length && !element.dataset.wikiEquipment ? '<div class="wiki-tooltip-effects-label">Base effects</div>' : ''}${renderFacts(facts)}${
      factTabs.length
        ? `
      <div class="wiki-tooltip-tabs" role="tablist" aria-label="Skill effects">${factTabs.map((tab, index) => `<button type="button" role="tab" id="wiki-tooltip-tab-${index}" aria-controls="wiki-tooltip-tabpanel-${index}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${esc(tab.label)}</button>`).join('')}</div>
      ${factTabs.map((tab, index) => `<div role="tabpanel" id="wiki-tooltip-tabpanel-${index}" aria-labelledby="wiki-tooltip-tab-${index}" tabindex="0"${index ? ' hidden' : ''}>${renderFacts(tab.facts)}</div>`).join('')}`
        : ''
    }`;
    link.href = `https://wiki.guildwars2.com/wiki/${encodeURIComponent((element.dataset.wikiPage || heading.textContent).replaceAll(' ', '_'))}`;
    element.setAttribute('aria-describedby', description.id);
    // A manual popover stays above equipment menus; a modal's contents must own it to remain interactive.
    (element.closest('dialog') || document.body).append(panel);
    panel.hidden = false;
    panel.showPopover();
    // Position in the viewport so clipped trait rows and narrow embeds still expose the entire card.
    position();
  };

  const findTrigger = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>('[data-wiki-name]') : null;

  document.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    const element = findTrigger(event.target);
    if (element && element !== trigger) {
      // A new hover owns the overlay; the previous icon's delayed close must not cancel this opening.
      cancelClose();
      clearTimeout(openTimer);
      // Delay the first inspection, then follow adjacent choices immediately while browsing the same menu.
      const menu = element.closest('.searchable-dropdown');
      if (menu && trigger && menu.contains(trigger)) {
        show(element);
        return;
      }

      if (element.dataset.wikiDelay) close();
      openTimer = setTimeout(
        () => {
          if (element.isConnected && element.matches(':hover')) show(element);
        },
        Number(element.dataset.wikiDelay || 220)
      );
    }
  });
  document.addEventListener('pointerout', (event) => {
    const element = findTrigger(event.target);
    if (element && !element.contains(event.relatedTarget as Node | null)) {
      clearTimeout(openTimer);
      if (element === trigger) scheduleClose();
    }
  });
  document.addEventListener('focusin', (event) => {
    const element = findTrigger(event.target);
    if (element && !pointerInteraction) {
      // Native picker transitions restore focus synchronously; open only after that popover operation finishes.
      clearTimeout(openTimer);
      openTimer = setTimeout(
        () => {
          if (element.isConnected && element.contains(document.activeElement)) show(element);
        },
        Number(element.dataset.wikiDelay || 0)
      );
    } else if (!panel.contains(event.target as Node)) close();
  });
  document.addEventListener('focusout', (event) => {
    if (findTrigger(event.target) === trigger || panel.contains(event.target as Node)) scheduleClose();
  });
  panel.addEventListener('pointerenter', cancelClose);
  panel.addEventListener('pointerleave', scheduleClose);
  // Enter the portal's tabs or wiki link in logical order; Escape returns focus without selecting anything.
  document.addEventListener(
    'keydown',
    (event) => {
      pointerInteraction = event.key === 'Escape';
      const focused = findTrigger(document.activeElement);
      if (event.key === 'Escape') {
        if (panel.contains(document.activeElement)) (returnFocus || trigger)?.focus();
        close();
      } else if (focused && event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        const source = document.activeElement as HTMLElement;
        show(focused);
        returnFocus = source;
        (effects.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') || link).focus();
      } else if (
        trigger &&
        event.key === 'Tab' &&
        event.shiftKey &&
        effects.querySelector('[role="tab"][aria-selected="true"]') === document.activeElement
      ) {
        event.preventDefault();
        (returnFocus || trigger).focus();
        close();
      } else if (
        trigger &&
        event.key === 'Tab' &&
        document.activeElement === link &&
        (!event.shiftKey || !effects.querySelector('[role="tab"]'))
      ) {
        if (event.shiftKey) event.preventDefault();
        (returnFocus || trigger).focus();
        close();
      } else if (focused?.dataset.wikiDelay && ['Enter', ' '].includes(event.key)) {
        close();
      }
    },
    true
  );
  document.addEventListener(
    'pointerdown',
    (event) => {
      pointerInteraction = true;
      if (!panel.contains(event.target as Node)) close();
    },
    true
  );
  document.addEventListener('dragstart', close, true);
  document.addEventListener(
    'scroll',
    (event) => {
      if (trigger && !panel.contains(event.target as Node)) close();
    },
    true
  );
  window.addEventListener('resize', close);
  refreshTooltip = () => {
    if (trigger && !trigger.isConnected) close();
  };

  new MutationObserver(refreshTooltip).observe(document.body, { childList: true, subtree: true });
}
