const TUTORIAL_DIALOG_ID = 'simulator-tutorial-dialog';
const DEFAULT_TUTORIAL_ID = 'quick-start';

export const TUTORIAL_GIF_URL = new URL('../../docs/assets/gw2-combat-simulator-usage.gif', import.meta.url).href;

export const ROTATION_TUTORIAL_GIF_URL = new URL(
  '../../docs/assets/gw2-combat-simulator-rotation-builder.gif',
  import.meta.url
).href;

export const ANALYSIS_TUTORIAL_GIF_URL = new URL('../../docs/assets/gw2-combat-simulator-analysis.gif', import.meta.url)
  .href;

/** Keeps the looping GIF unloaded while the tutorial is closed or motion is reduced. */
export function setTutorialAnimationState(image: HTMLImageElement, shouldPlay: boolean): void {
  const source = image.dataset.tutorialSrc;

  if (shouldPlay && source) {
    if (!image.getAttribute('src')) image.setAttribute('src', source);
    return;
  }

  image.removeAttribute('src');
}

/** Restarts the cached GIF without downloading a second copy. */
export function restartTutorialAnimation(
  image: HTMLImageElement,
  view: Window | null = image.ownerDocument.defaultView
): void {
  const source = image.dataset.tutorialSrc;
  setTutorialAnimationState(image, false);

  if (!source) return;

  const restore = (): void => image.setAttribute('src', source);

  if (view?.requestAnimationFrame) {
    view.requestAnimationFrame(() => view.requestAnimationFrame(restore));
  } else {
    setTimeout(restore, 0);
  }
}

/** Switches the visible walkthrough and keeps every inactive GIF unloaded. */
export function activateTutorialPanel(
  root: ParentNode,
  tutorialId: string,
  shouldPlay: boolean
): HTMLImageElement | null {
  root.querySelectorAll<HTMLElement>('[data-tutorial-choice]').forEach((choice) => {
    const isActive = choice.dataset.tutorialChoice === tutorialId;
    choice.setAttribute('aria-pressed', String(isActive));
  });

  let activeImage: HTMLImageElement | null = null;
  root.querySelectorAll<HTMLElement>('[data-tutorial-panel]').forEach((panel) => {
    const isActive = panel.dataset.tutorialPanel === tutorialId;
    panel.hidden = !isActive;
    const image = panel.querySelector<HTMLImageElement>('.tutorial-animation');

    if (!image) return;

    setTutorialAnimationState(image, isActive && shouldPlay);

    if (isActive) activeImage = image;
  });

  return activeImage;
}

function tutorialTrigger(root: Document, prominent: boolean): HTMLButtonElement {
  const trigger = root.createElement('button');
  trigger.type = 'button';
  trigger.className = prominent
    ? 'tutorial-trigger tutorial-trigger-primary'
    : 'community-link tutorial-trigger tutorial-trigger-compact';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', TUTORIAL_DIALOG_ID);
  trigger.innerHTML = '<span class="tutorial-trigger-icon" aria-hidden="true">&#9654;</span><span>How to use</span>';
  return trigger;
}

function tutorialDialog(root: Document): HTMLDialogElement {
  const dialog = root.createElement('dialog');
  dialog.id = TUTORIAL_DIALOG_ID;
  dialog.className = 'tutorial-dialog';
  dialog.setAttribute('aria-labelledby', 'simulator-tutorial-title');
  dialog.setAttribute('aria-describedby', 'simulator-tutorial-description');
  dialog.innerHTML = `
    <div class="tutorial-dialog-shell">
      <div class="tutorial-dialog-header">
        <div>
          <p class="tutorial-dialog-eyebrow">Tutorials</p>
          <h2 id="simulator-tutorial-title">How to use the simulator</h2>
          <p id="simulator-tutorial-description">Choose a walkthrough, then follow the animation and written steps.</p>
        </div>
        <button type="button" class="tutorial-dialog-close" data-tutorial-close aria-label="Close tutorial">&times;</button>
      </div>
      <div class="tutorial-picker" role="group" aria-label="Choose a tutorial">
        <button type="button" class="tutorial-picker-button" data-tutorial-choice="quick-start" aria-pressed="true">Quick start</button>
        <button type="button" class="tutorial-picker-button" data-tutorial-choice="rotation-builder" aria-pressed="false">Rotation builder</button>
        <button type="button" class="tutorial-picker-button" data-tutorial-choice="analysis" aria-pressed="false">Analysis</button>
      </div>
      <div class="tutorial-dialog-body" data-tutorial-panel="quick-start">
        <div class="tutorial-animation-frame">
          <img class="tutorial-animation" data-tutorial-src="${TUTORIAL_GIF_URL}" alt="" width="1280" height="900" decoding="async" />
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
      <div class="tutorial-dialog-body" data-tutorial-panel="rotation-builder" hidden>
        <div class="tutorial-animation-frame">
          <img class="tutorial-animation" data-tutorial-src="${ROTATION_TUTORIAL_GIF_URL}" alt="" width="1280" height="900" decoding="async" />
          <div class="tutorial-reduced-motion" role="note">
            <strong>Animation is paused.</strong>
            <span>Your reduced-motion preference is enabled. Use the written steps beside this panel.</span>
          </div>
        </div>
        <div class="tutorial-guide-copy">
          <ol class="tutorial-step-list">
            <li><strong>Queue skills manually</strong><span>Click available skills in the palette to add them to the timeline in order.</span></li>
            <li><strong>Review and refine</strong><span>Inspect the timeline, then use Undo, Redo, Clear, or the insertion cursor to make changes.</span></li>
            <li><strong>Save the rotation</strong><span>Use Save Rotation to download the current sequence as a portable JSON file.</span></li>
            <li><strong>Load a rotation</strong><span>Restore a saved JSON rotation, or import an EVTC or EVTC ZIP combat log.</span></li>
          </ol>
          <div class="tutorial-dialog-actions">
            <button type="button" class="btn tutorial-replay" data-tutorial-replay>Replay animation</button>
            <button type="button" class="btn btn-clear" data-tutorial-close>Close</button>
          </div>
        </div>
      </div>
      <div class="tutorial-dialog-body" data-tutorial-panel="analysis" hidden>
        <div class="tutorial-animation-frame">
          <img class="tutorial-animation" data-tutorial-src="${ANALYSIS_TUTORIAL_GIF_URL}" alt="" width="1280" height="900" decoding="async" />
          <div class="tutorial-reduced-motion" role="note">
            <strong>Animation is paused.</strong>
            <span>Your reduced-motion preference is enabled. Use the written steps beside this panel.</span>
          </div>
        </div>
        <div class="tutorial-guide-copy">
          <ol class="tutorial-step-list">
            <li><strong>Open combat analysis</strong><span>Load or build a rotation, then switch from Workspace to Analysis.</span></li>
            <li><strong>Trace each damage source</strong><span>Compare strike, condition, total damage, DPS, casts, hits, and average damage per cast.</span></li>
            <li><strong>Explore the timeline</strong><span>Hover the DPS and effects charts, then toggle the boons, conditions, and buffs you want to compare.</span></li>
          </ol>
          <aside class="tutorial-secondary-callout">
            <span>Optional</span>
            <strong>Patch Preview</strong>
            <p>When preview data is available, switch Game data versions to compare total and per-skill DPS changes for the same rotation.</p>
          </aside>
          <div class="tutorial-dialog-actions">
            <button type="button" class="btn tutorial-replay" data-tutorial-replay>Replay animation</button>
            <button type="button" class="btn btn-clear" data-tutorial-close>Close</button>
          </div>
        </div>
      </div>
    </div>`;
  return dialog;
}

/** Mounts one lazy-loading tutorial entry point on landing and profession pages. */
export function mountSimulatorTutorial(root: Document = document): void {
  if (root.getElementById(TUTORIAL_DIALOG_ID) || !root.body) return;

  const landingHeader = root.querySelector('.landing-header');
  const compactHost = root.querySelector('.community-actions');
  const host = landingHeader || compactHost;

  if (!host) return;

  const trigger = tutorialTrigger(root, Boolean(landingHeader));
  const dialog = tutorialDialog(root);
  let activeTutorialId = DEFAULT_TUTORIAL_ID;

  if (landingHeader) host.append(trigger);
  else host.prepend(trigger);
  root.body.append(dialog);

  const motionPreference = root.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const shouldPlay = (): boolean => !motionPreference?.matches;
  const closeDialog = (): void => {
    activateTutorialPanel(dialog, activeTutorialId, false);

    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  };

  trigger.addEventListener('click', () => {
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    activateTutorialPanel(dialog, activeTutorialId, shouldPlay());
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      closeDialog();
      return;
    }

    const target = event.target as { closest?: (selector: string) => Element };
    const choice = target.closest?.('[data-tutorial-choice]') as HTMLElement | undefined;

    if (choice?.dataset.tutorialChoice) {
      activeTutorialId = choice.dataset.tutorialChoice;
      activateTutorialPanel(dialog, activeTutorialId, shouldPlay());
    } else if (target.closest?.('[data-tutorial-close]')) {
      closeDialog();
    } else if (target.closest?.('[data-tutorial-replay]')) {
      const image = dialog.querySelector<HTMLImageElement>(
        `[data-tutorial-panel="${activeTutorialId}"] .tutorial-animation`
      );

      if (image) restartTutorialAnimation(image, root.defaultView);
    }
  });
  dialog.addEventListener('close', () => activateTutorialPanel(dialog, activeTutorialId, false));
  motionPreference?.addEventListener('change', () => {
    if (dialog.open) activateTutorialPanel(dialog, activeTutorialId, shouldPlay());
  });
}
