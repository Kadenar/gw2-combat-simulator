const TUTORIAL_DIALOG_ID = "simulator-tutorial-dialog";

export const TUTORIAL_GIF_URL = new URL(
  "../../docs/assets/gw2-combat-simulator-usage.gif",
  import.meta.url,
).href;

/** Keeps the looping GIF unloaded while the tutorial is closed or motion is reduced. */
export function setTutorialAnimationState(
  image: HTMLImageElement,
  shouldPlay: boolean,
): void {
  const source = image.dataset.tutorialSrc;
  if (shouldPlay && source) {
    if (!image.getAttribute("src")) image.setAttribute("src", source);
    return;
  }
  image.removeAttribute("src");
}

/** Restarts the cached GIF without downloading a second copy. */
export function restartTutorialAnimation(
  image: HTMLImageElement,
  view: Window | null = image.ownerDocument.defaultView,
): void {
  const source = image.dataset.tutorialSrc;
  setTutorialAnimationState(image, false);
  if (!source) return;

  const restore = (): void => image.setAttribute("src", source);
  if (view?.requestAnimationFrame) {
    view.requestAnimationFrame(() => view.requestAnimationFrame(restore));
  } else {
    setTimeout(restore, 0);
  }
}

export function tutorialPrefersReducedMotion(
  view: Pick<Window, "matchMedia"> | null | undefined,
): boolean {
  return Boolean(
    view?.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
}

function tutorialTrigger(
  root: Document,
  prominent: boolean,
): HTMLButtonElement {
  const trigger = root.createElement("button");
  trigger.type = "button";
  trigger.className = prominent
    ? "tutorial-trigger tutorial-trigger-primary"
    : "community-link tutorial-trigger tutorial-trigger-compact";
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-controls", TUTORIAL_DIALOG_ID);
  trigger.innerHTML =
    '<span class="tutorial-trigger-icon" aria-hidden="true">&#9654;</span><span>How to use</span>';
  return trigger;
}

function tutorialDialog(root: Document): HTMLDialogElement {
  const dialog = root.createElement("dialog");
  dialog.id = TUTORIAL_DIALOG_ID;
  dialog.className = "tutorial-dialog";
  dialog.setAttribute("aria-labelledby", "simulator-tutorial-title");
  dialog.setAttribute("aria-describedby", "simulator-tutorial-description");
  dialog.innerHTML = `
    <div class="tutorial-dialog-shell">
      <div class="tutorial-dialog-header">
        <div>
          <p class="tutorial-dialog-eyebrow">Quick start</p>
          <h2 id="simulator-tutorial-title">How to use the simulator</h2>
          <p id="simulator-tutorial-description">A short walkthrough from profession selection to combat analysis.</p>
        </div>
        <button type="button" class="tutorial-dialog-close" data-tutorial-close aria-label="Close tutorial">&times;</button>
      </div>
      <div class="tutorial-dialog-body">
        <div class="tutorial-animation-frame">
          <img class="tutorial-animation" alt="" width="1280" height="900" decoding="async" />
          <div class="tutorial-reduced-motion" role="note">
            <strong>Animation is paused.</strong>
            <span>Your reduced-motion preference is enabled. Use the written steps beside this panel.</span>
          </div>
        </div>
        <div class="tutorial-guide-copy">
          <ol class="tutorial-step-list">
            <li><strong>Choose a profession</strong><span>Open the simulator for the profession you want to model.</span></li>
            <li><strong>Load a template</strong><span>Select a saved build and its matching benchmark rotation.</span></li>
            <li><strong>Review the rotation</strong><span>Add, remove, or inspect casts in the generated timeline.</span></li>
            <li><strong>Read the analysis</strong><span>Review DPS, damage sources, conditions, and modifier contributions.</span></li>
          </ol>
          <div class="tutorial-dialog-actions">
            <button type="button" class="btn tutorial-replay" data-tutorial-replay>Replay animation</button>
            <button type="button" class="btn btn-clear" data-tutorial-close>Close</button>
          </div>
        </div>
      </div>
    </div>`;
  const image = dialog.querySelector<HTMLImageElement>(".tutorial-animation");
  if (image) image.dataset.tutorialSrc = TUTORIAL_GIF_URL;
  return dialog;
}

/** Mounts one lazy-loading tutorial entry point on landing and profession pages. */
export function mountSimulatorTutorial(root: Document = document): void {
  if (root.getElementById(TUTORIAL_DIALOG_ID) || !root.body) return;

  const landingHeader = root.querySelector(".landing-header");
  const compactHost = root.querySelector(".community-actions");
  const host = landingHeader || compactHost;
  if (!host) return;

  const trigger = tutorialTrigger(root, Boolean(landingHeader));
  const dialog = tutorialDialog(root);
  const image = dialog.querySelector<HTMLImageElement>(".tutorial-animation");
  if (!image) return;

  if (landingHeader) host.append(trigger);
  else host.prepend(trigger);
  root.body.append(dialog);

  const motionPreference = root.defaultView?.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  );
  const shouldPlay = (): boolean => !motionPreference?.matches;
  const closeDialog = (): void => {
    setTutorialAnimationState(image, false);
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  };

  trigger.addEventListener("click", () => {
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    setTutorialAnimationState(image, shouldPlay());
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeDialog();
      return;
    }
    const target = event.target as { closest?: (selector: string) => Element };
    if (target.closest?.("[data-tutorial-close]")) {
      closeDialog();
    } else if (target.closest?.("[data-tutorial-replay]")) {
      restartTutorialAnimation(image, root.defaultView);
    }
  });
  dialog.addEventListener("close", () =>
    setTutorialAnimationState(image, false),
  );
  motionPreference?.addEventListener("change", () => {
    if (dialog.open) setTutorialAnimationState(image, shouldPlay());
  });
}
