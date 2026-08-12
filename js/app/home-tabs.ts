// Accessible tablist for the landing page. Keeps the simulator content and the
// log analyzer on separate panels while following the WAI-ARIA tabs pattern:
// one tab is focusable at a time, arrow keys move between tabs, and Home/End
// jump to the ends.
interface HomeTab {
  readonly tab: HTMLButtonElement;
  readonly panel: HTMLElement;
}

function collectTabs(root: Document): readonly HomeTab[] {
  const tabs: HomeTab[] = [];
  for (const tab of root.querySelectorAll<HTMLButtonElement>(
    "[data-tab][role='tab']",
  )) {
    const panelId = tab.getAttribute("aria-controls");
    const panel = panelId ? root.getElementById(panelId) : null;
    if (panel) tabs.push({ tab, panel });
  }
  return tabs;
}

function activate(tabs: readonly HomeTab[], index: number, focus: boolean): void {
  tabs.forEach(({ tab, panel }, current) => {
    const selected = current === index;
    tab.setAttribute("aria-selected", selected ? "true" : "false");
    tab.tabIndex = selected ? 0 : -1;
    panel.hidden = !selected;
  });
  if (focus) tabs[index]?.tab.focus();
}

export function bindHomeTabs(root: Document = document): (() => void) | null {
  const tabs = collectTabs(root);
  if (tabs.length < 2) return null;
  const initial = Math.max(
    0,
    tabs.findIndex(({ tab }) => tab.getAttribute("aria-selected") === "true"),
  );
  activate(tabs, initial, false);

  const listeners: (() => void)[] = [];
  tabs.forEach(({ tab }, index) => {
    const onClick = (): void => activate(tabs, index, false);
    const onKeydown = (event: KeyboardEvent): void => {
      const last = tabs.length - 1;
      let next: number | null = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        next = index === last ? 0 : index + 1;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        next = index === 0 ? last : index - 1;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = last;
      }
      if (next === null) return;
      event.preventDefault();
      activate(tabs, next, true);
    };
    tab.addEventListener("click", onClick);
    tab.addEventListener("keydown", onKeydown);
    listeners.push(() => {
      tab.removeEventListener("click", onClick);
      tab.removeEventListener("keydown", onKeydown);
    });
  });

  return () => listeners.forEach((dispose) => dispose());
}

if (typeof document !== "undefined") {
  bindHomeTabs(document);
}
