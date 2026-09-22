import { gw2ApiText } from '#gw2/app/shared/html.js';
import { escapeHtml as esc } from '#ui/shared/html.js';
import { MODIFIER_EFFECT_ICONS } from '#gw2/app/shared/icons.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/** Keep descriptions local and escape both text and wiki titles before putting them in markup. */
export function wikiTooltipAttributes(name: unknown, description: unknown = '', wikiName: unknown = name): string {
  if (!name || name === 'None') return '';
  return `data-wiki-name="${esc(name)}" data-wiki-description="${esc(gw2ApiText(description))}" data-wiki-page="${esc(wikiName)}"`;
}

/** Describe authored base effects without pretending to predict trait-modified damage or target-dependent outcomes. */
export function skillTooltipAttributes(skill: Skill, description: unknown = skill.description): string {
  const facts = new Map<string, { name: string; detail: string; applications: number }>();
  const add = (name: string, detail: string, applications = 1) => {
    const key = `${name}\n${detail}`;
    const previous = facts.get(key);
    facts.set(key, { name, detail, applications: (previous?.applications || 0) + applications });
  };

  const number = (value: number) => String(Number(value.toFixed(3)));
  for (const effect of skill.effects || []) {
    const applications = effect.applications ?? 1;
    if (effect.type === 'strike') {
      const coefficient = effect.ticks?.reduce((sum, tick) => sum + tick.coefficient, 0) ?? effect.coefficient;
      const hits = effect.ticks?.length ?? effect.hits ?? 1;
      const damage = [
        effect.flatDamage != null ? `${number(effect.flatDamage)} flat damage` : '',
        coefficient != null ? `${number(coefficient)} coefficient` : '',
        hits > 1 ? `${hits} hits` : ''
      ]
        .filter(Boolean)
        .join(' · ');
      if (damage) add('Strike damage', damage, applications);
    } else if (effect.type === 'condition') {
      for (const condition of effect.ticks || [effect]) {
        if (condition.condition)
          add(
            condition.condition,
            `${condition.stacks ?? 1} stack${condition.stacks === 1 || condition.stacks == null ? '' : 's'} · ${number(condition.duration ?? 0)}s`,
            applications
          );
      }
    } else if (effect.type === 'boon' || effect.type === 'buff') {
      const name = effect.boon || effect.kind;
      if (name)
        add(
          name,
          `${effect.stacks ?? 1} stack${effect.stacks === 1 || effect.stacks == null ? '' : 's'} · ${number(effect.duration)}s`,
          applications
        );
    }
  }

  return `${wikiTooltipAttributes(skill.displayName || skill.name, description)} data-wiki-effects="${esc(JSON.stringify([...facts.values()]))}" data-wiki-recharge="${esc(skill.cooldown ?? skill.recharge ?? '')}"`;
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
  panel.innerHTML = `<div class="wiki-tooltip-heading"><strong id="wiki-tooltip-name"></strong><span class="wiki-tooltip-recharge"></span></div>
    <div id="wiki-tooltip-description" class="wiki-tooltip-description"></div>
    <div class="wiki-tooltip-effects"></div>
    <a target="_blank" rel="noopener noreferrer" aria-label="Open on wiki (opens in a new tab)">Open on wiki <span aria-hidden="true">↗</span></a>`;
  document.body.append(panel);
  const heading = panel.querySelector('strong')!;
  const description = panel.querySelector<HTMLElement>('.wiki-tooltip-description')!;
  const link = panel.querySelector('a')!;
  const recharge = panel.querySelector<HTMLElement>('.wiki-tooltip-recharge')!;
  const effects = panel.querySelector<HTMLElement>('.wiki-tooltip-effects')!;
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

  const show = (element: HTMLElement) => {
    cancelClose();
    if (trigger === element) return;
    close();
    trigger = element;
    heading.textContent = element.dataset.wikiName || '';
    description.innerHTML = esc(element.dataset.wikiDescription || '').replace(
      /(Signet (?:Passive|Active):)/g,
      '<span class="wiki-tooltip-highlight">$1</span>'
    );
    description.hidden = !description.textContent;
    recharge.textContent = element.dataset.wikiRecharge ? `${element.dataset.wikiRecharge} ↻` : '';
    recharge.setAttribute('aria-label', `Recharge: ${element.dataset.wikiRecharge || 0} seconds`);
    recharge.hidden = !element.dataset.wikiRecharge;
    const facts: { name: string; detail: string; applications: number }[] = JSON.parse(
      element.dataset.wikiEffects || '[]'
    );
    effects.hidden = !facts.length;
    effects.innerHTML = facts.length
      ? `<div class="wiki-tooltip-effects-label">Base effects</div>${facts
          .map(({ name, detail, applications }) => {
            const icon = MODIFIER_EFFECT_ICONS[name];
            return `<div class="wiki-tooltip-fact"><span class="wiki-tooltip-fact-icon" aria-hidden="true">${icon ? `<img src="${esc(icon)}" alt="">` : '✦'}</span><span>${esc(name)}: ${esc(detail)}${applications > 1 ? ` × ${applications} applications` : ''}</span></div>`;
          })
          .join('')}`
      : '';
    link.href = `https://wiki.guildwars2.com/wiki/${encodeURIComponent((element.dataset.wikiPage || heading.textContent).replaceAll(' ', '_'))}`;
    element.setAttribute('aria-describedby', description.id);
    // A manual popover stays above equipment menus; a modal's contents must own it to remain interactive.
    (element.closest('dialog') || document.body).append(panel);
    panel.hidden = false;
    panel.showPopover();
    // Position in the viewport so clipped trait rows and narrow embeds still expose the entire card.
    const rect = element.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
    panel.style.top = `${Math.max(8, Math.min(rect.bottom + 6 + height <= window.innerHeight - 8 ? rect.bottom + 6 : rect.top - height - 6, window.innerHeight - height - 8))}px`;
  };

  const findTrigger = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>('[data-wiki-name]') : null;

  document.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    const element = findTrigger(event.target);
    if (element && element !== trigger) {
      // A new hover owns the overlay; the previous icon's delayed close must not cancel this opening.
      cancelClose();
      if (element.dataset.wikiDelay) close();
      clearTimeout(openTimer);
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
  // Tab exposes the portal's link in the trigger's logical tab order; Escape returns focus without selecting anything.
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
        link.focus();
      } else if (trigger && event.key === 'Tab' && document.activeElement === link) {
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
