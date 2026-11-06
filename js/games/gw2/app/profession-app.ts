/** Composes browser rendering and persistence around the headless analysis lifecycle. */
import { analysisViewIsActive } from '#browser/shell/result-view.js';
import { enterRotationFocus, ROTATION_FOCUS_EXIT_EVENT } from '#browser/shell/rotation-workspace.js';
import { ENCOUNTER_RESULT_EVENT } from '#gw2/app/boss-scenarios/simulation.js';
import { mountBossScenarios } from '#gw2/app/boss-scenarios/view.js';
import { receiveSkillDamage } from '#gw2/app/build/panels/skill-damage.js';
import { mountBuildTabs, renderBuildTabs } from '#gw2/app/build/panels/workspace-tabs.js';
import { normalizeSelectedSkills, swapSelectedSkillsForPatch } from '#gw2/app/build/state/skill-selection.js';
import { loadBuildWorkspace, saveBuildWorkspace, type BuildWorkspace } from '#gw2/app/build/state/workspace.js';
import type { BuildTemplatePreset, BuildTemplateSelection } from '#gw2/app/build/types.js';
import { createAnalysisResultLifecycle } from '#gw2/app/create-analysis-lifecycle.js';
import { renderGearOptimizer } from '#gw2/app/optimizer/gear/panel.js';
import { GearOptimizerRunner } from '#gw2/app/optimizer/gear/runner.js';
import { renderRelicComparison } from '#gw2/app/optimizer/relic-comparison/panel.js';
import { RelicComparisonRunner } from '#gw2/app/optimizer/relic-comparison/runner.js';
import { renderGearOptimizerView } from '#gw2/app/optimizer/view.js';
import { SIMULATOR_VIEW_CHANGE_EVENT } from '#gw2/app/page/navigation.js';
import { mountPatchPreviewControls } from '#gw2/app/patch-preview/view.js';
import { renderEventLog } from '#gw2/app/results/event-log.js';
import { renderModifierContributions } from '#gw2/app/results/view.js';
import { renderRotationEditor, renderSimulationOutput } from '#gw2/app/rotation/builder.js';
import * as comparisonState from '#gw2/app/rotation/comparison-state.js';
import { renderRotationComparison } from '#gw2/app/rotation/comparison.js';
import { addRotation } from '#gw2/app/rotation/editing/actions.js';
import { commitRotationEdit } from '#gw2/app/rotation/editing/commit.js';
import type { ProfessionRotationDragState, RotationActionOptions } from '#gw2/app/rotation/editing/state.js';
import { updatePaletteFreshness } from '#gw2/app/rotation/palette/freshness.js';
import { renderPalette } from '#gw2/app/rotation/palette/view.js';
import { renderRotationStateSnapshot } from '#gw2/app/rotation/state-snapshot/view.js';
import {
  readStoredRotationProcOverlayVisibility,
  readStoredTimelineOverlayVisibility
} from '#gw2/app/rotation/timeline/preferences.js';
import { updateTimelineInsertionCursor } from '#gw2/app/rotation/timeline/view.js';
import { bindSessionControls } from '#gw2/app/session-controls.js';
import { bindWikiTooltips } from '#gw2/app/shared/tooltip-overlay.js';
import type { AnalysisChange, AnalysisResultLifecycle } from '#gw2/app/simulation/analysis-result-lifecycle.js';
import { BaselineSimulationRunner } from '#gw2/app/simulation/baseline/runner.js';
import { ModifierContributionRunner } from '#gw2/app/simulation/modifier-contributions/runner.js';
import { RandomDistributionRunner } from '#gw2/app/simulation/random-distribution/runner.js';
import type { SimulationSettings } from '#gw2/app/simulation/settings.js';
import { SkillDamageRunner } from '#gw2/app/simulation/skill-damage/runner.js';
import type { Gw2AppAdapter, ProfessionAppState, ProfessionChangeOptions } from '#gw2/app/types.js';
import type { BuildAttributes } from '#gw2/build-context/types.js';
import type { ResolvedPatch } from '#gw2/integrations/patches/selection.js';
import { normalizeInfusions } from '#gw2/platform/builds/codec.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import { RELIC_NAMES as SHARED_RELIC_NAMES } from '#gw2/platform/equipment/relics/catalog.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { closeFloatingEditor } from '#ui/rotation/editing/floating-editor.js';

export class ProfessionApp implements ProfessionAppState {
  readonly analysis: AnalysisResultLifecycle;
  workspace: BuildWorkspace;
  readonly gameId: string;
  readonly contentId: string;
  readonly adapter: Gw2AppAdapter;
  readonly profession: ProfessionAppState['profession'];
  /** Derive all selected data from the captured patch, including session tuning. */
  get activeCatalog(): ProfessionAppState['activeCatalog'] {
    return this.patch.catalog;
  }
  patch: ResolvedPatch;
  build: Gw2CanonicalBuild;
  simulationSettings: SimulationSettings;
  readonly weaponData: ProfessionAppState['weaponData'];
  readonly relicNames: ProfessionAppState['relicNames'];
  readonly resourceDefinitions: ProfessionAppState['resourceDefinitions'];
  attributeWeaponSet: number;
  attributeData: BuildAttributes | null;
  damageDiagnostics: boolean;
  rotationComparison: ProfessionAppState['rotationComparison'];
  templateRotationLoading?: ProfessionAppState['templateRotationLoading'];
  dragState: ProfessionRotationDragState | null;
  rotationInsertionIndex: number | null;
  _rotationHistory: ProfessionAppState['_rotationHistory'];
  overlaySigilProcs: boolean;
  overlayRelicProcs: boolean;
  timelineOverlayVisibility: Record<string, boolean>;
  templatePresets: BuildTemplatePreset[];
  templateContainer: HTMLElement | null;
  currentTemplate: BuildTemplateSelection | null;
  templateUndoBuild: Gw2CanonicalBuild | null;
  readonly modifierContributionRunner: ModifierContributionRunner;
  readonly randomDistributionRunner: RandomDistributionRunner;
  readonly skillDamageRunner: SkillDamageRunner;
  readonly gearOptimizerRunner: GearOptimizerRunner;
  readonly relicComparisonRunner: RelicComparisonRunner;
  readonly baselineSimulationRunner: BaselineSimulationRunner;
  private initialRenderGeneration: number;
  private deferredRotationRenderRevision: number | null;

  constructor(adapter: Gw2AppAdapter) {
    if (!adapter?.profession) {
      throw new TypeError('ProfessionApp requires an app adapter.');
    }

    this.adapter = adapter;
    this.gameId = adapter.gameId;
    this.contentId = adapter.contentId;
    this.profession = adapter.profession;
    this.workspace = loadBuildWorkspace(adapter);
    const activeTab = this.workspace.tabs.find((tab) => tab.id === this.workspace.activeTabId)!;
    this.patch = this.profession.resolvePatch({ id: activeTab.patchId, values: activeTab.session.patchPreviewValues });
    this.build = activeTab.build;
    this.simulationSettings = this.workspace.simulationSettings;
    this.weaponData = adapter.weaponData;
    this.relicNames = adapter.relicNames || SHARED_RELIC_NAMES;
    // Starting resource controls use the selected patch before any simulation exists.
    this.resourceDefinitions = (specialization: string) =>
      this.profession.ui.resourceViews({ specialization, catalog: this.activeCatalog, build: this.build });
    this.attributeWeaponSet = 1;
    this.attributeData = null;
    this.damageDiagnostics = false;
    this.rotationComparison = null;
    this.dragState = null;
    this.rotationInsertionIndex = null;
    this._rotationHistory = { undo: [], redo: [] };
    // Restore timeline display preferences independently from the saved build and simulation configuration.
    this.overlaySigilProcs = readStoredRotationProcOverlayVisibility(document, 'sigil');
    this.overlayRelicProcs = readStoredRotationProcOverlayVisibility(document, 'relic');
    // Load each specialization's declared preferences so switching builds retains the user's choices.
    this.timelineOverlayVisibility = Object.fromEntries(
      ['Core', ...this.activeCatalog.specializations.filter((spec) => spec.elite).map((spec) => spec.name)]
        .flatMap((specialization) =>
          this.profession.ui.timelineOverlays({ specialization, catalog: this.activeCatalog })
        )
        .map((overlay) => [overlay.id, readStoredTimelineOverlayVisibility(document, overlay.storageKey)])
    );
    this.templatePresets = [];
    this.templateContainer = null;
    this.currentTemplate = null;
    this.templateUndoBuild = null;
    this.modifierContributionRunner = new ModifierContributionRunner((request) =>
      this.adapter.calculateModifierContributions(request)
    );
    this.randomDistributionRunner = new RandomDistributionRunner((request, options) =>
      this.adapter.calculateRandomDistribution(request, options)
    );
    this.relicComparisonRunner = new RelicComparisonRunner(this, () => renderRelicComparison(this));
    this.baselineSimulationRunner = new BaselineSimulationRunner((request) =>
      this.adapter.calculateBaselineSimulation(request)
    );
    this.gearOptimizerRunner = new GearOptimizerRunner(this, () => renderGearOptimizer(this));
    // Browser-owned workers follow the existing runner lifecycle and stay out of headless adapter imports.
    this.skillDamageRunner = new SkillDamageRunner((signature, result, error) =>
      receiveSkillDamage(this, signature, result, error)
    );
    this.analysis = createAnalysisResultLifecycle(this, (change) => this.onAnalysisChange(change));
    this.initialRenderGeneration = 0;
    this.deferredRotationRenderRevision = null;
  }

  async init(): Promise<void> {
    // Offer version selection only when the profession has an authored balance preview.
    if (this.profession.preview) mountPatchPreviewControls(this);

    this.baselineSimulationRunner.warmup({ gameId: this.gameId, contentId: this.contentId });
    bindSessionControls(this);
    // Delegated tooltip listeners and the mutation observer cover every subsequent panel render.
    bindWikiTooltips();
    document.addEventListener(SIMULATOR_VIEW_CHANGE_EVENT, () => {
      this.analysis.setAnalysisVisible(analysisViewIsActive());

      // Leaving the optimizer gives the next view priority; entering it preserves an active search.
      if (document.body?.dataset.simulatorView !== 'gear-optimizer') this.gearOptimizerRunner?.cancel();

      if (document.body?.dataset.simulatorView === 'gear-optimizer') {
        renderGearOptimizerView(this);
        return;
      }

      const results = document.getElementById('rotation-results');

      if (analysisViewIsActive() && results?.dataset.analysisStale === 'true') {
        this.adapter.presentation.render(this, this.adapter.presentation.createViewModel(this));
      }
    });
    document.addEventListener(ROTATION_FOCUS_EXIT_EVENT, () => this.exitRotationComparison());
    const templatesReady = Promise.resolve(this.adapter.buildEditor.initialize?.(this));
    this.updateSimulationStateSynchronously();
    this.renderBuildSections(true);
    renderGearOptimizer(this);
    await templatesReady;
    mountBuildTabs(this);
    mountBossScenarios(this);
    // Commit the asynchronously inserted templates under the loading overlay.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    document.getElementById('loading-overlay')?.classList.add('hidden');
    this.scheduleInitialDeferredRender();
  }

  changed(rebuildStatic = true, rebuildGear = rebuildStatic, options: ProfessionChangeOptions = {}): void {
    // Dismiss editors before deferred publication can leave their old choices visible.
    closeFloatingEditor();
    this.initialRenderGeneration += 1;

    // A drag started on the prior timeline must not carry its source index into a later render.
    this.dragState = null;
    const revision = this.prepareSimulationState(options);

    // Shared build/config changes invalidate the pinned result; rotation-only edits keep it reusable.
    if (rebuildStatic) comparisonState.queueRotationReference(this);

    this.analysis.refreshBaseline();

    if (rebuildStatic) this.renderBuildSections(rebuildGear);

    this.adapter.buildEditor?.updateSelection?.(this);
    // Rotation-only edits keep the resolved builder intact until the worker can paint the new commands and results
    // together; otherwise every edit briefly collapses result-derived timeline rows and causes visible flicker.
    // Empty rotations have no resolved rows to preserve; clear them before a cold worker finishes loading.
    const deferRotationRender =
      this.build.rotation.length > 0 &&
      !this.templateRotationLoading &&
      (!rebuildStatic || options.deferRotationRender === true);

    if (deferRotationRender) {
      this.deferredRotationRenderRevision = revision;
      renderRotationComparison(this);
    } else {
      this.deferredRotationRenderRevision = null;
      renderRotationEditor(this);
      renderRotationComparison(this);
    }
  }

  /** Commits cheap build derivations now and assigns the immutable revision used by worker results. */
  private prepareSimulationState(options: ProfessionChangeOptions = {}): number {
    // Session experiments share one selected catalog across controls, previews and worker requests.
    // Optimizer results can contain zero or one allocation; keep both editor rows before recalculating.
    if (this.build.infusions.length !== 2) this.build.infusions = normalizeInfusions(this.build.infusions, []);

    normalizeSelectedSkills(this);
    this.attributeData = this.adapter
      .createBuildContext({
        build: this.build,
        patch: this.patch,
        transitionDelays: normalizeTransitionDelays(this.simulationSettings?.transitionDelays)
      })
      .attributes(this.attributeWeaponSet === 2 ? 2 : 1);
    this.analysis.changeInputs(options.patchSwitch, options.adoptedResult);
    this.gearOptimizerRunner.cancel();
    this.relicComparisonRunner.schedule();
    saveBuildWorkspace(this);
    renderBuildTabs(this);

    if (document.body) document.body.dataset.simulationStatus = this.analysis.state.simulationStatus;

    updatePaletteFreshness(this);
    return this.analysis.state.buildRevision;
  }

  /** Initial publication stays synchronous; later requests use the existing worker queue. */
  private updateSimulationStateSynchronously(): void {
    this.prepareSimulationState();
    this.analysis.setAnalysisVisible(analysisViewIsActive());
    this.analysis.initialize();
  }

  /** Recapture the same seeded baseline without changing the build, history, or saved preferences. */
  setDamageDiagnostics(enabled: boolean): void {
    if (this.damageDiagnostics === enabled) return;

    this.damageDiagnostics = enabled;

    if (this.rotationComparison?.referenceStatus === 'fresh') comparisonState.queueRotationReference(this);

    this.analysis.refreshBaseline();

    if (document.body) document.body.dataset.simulationStatus = this.analysis.state.simulationStatus;

    renderEventLog(this);
  }

  /** Accepted lifecycle changes retain targeted renders and editor ordering without reproducing freshness policy. */
  private onAnalysisChange(change: AnalysisChange): void {
    const { kind, revision, render, referenceResult } = change;

    if (document.body) document.body.dataset.simulationStatus = this.analysis.state.simulationStatus;

    if (kind === 'status') return;

    if (kind === 'modifiers') {
      renderModifierContributions(this);
      return;
    }

    if (kind === 'distribution-progress') {
      const progress = this.analysis.state.results?.randomDistributionProgress;
      const indicator = document.querySelector('#rotation-results [data-role="rng-progress"]');

      if (!indicator || !progress) return;

      indicator.setAttribute('aria-valuenow', String(Math.round(progress.percent)));
      const bar = indicator.querySelector<HTMLElement>('[data-role="rng-progress-bar"]');

      if (bar) bar.style.width = `${progress.percent}%`;

      const label = indicator.querySelector('[data-role="rng-progress-label"]');

      if (label)
        label.textContent = `${Math.round(progress.completed).toLocaleString()} / ${Math.round(progress.total).toLocaleString()} simulations (${Math.round(progress.percent)}%)`;

      return;
    }

    if (kind === 'distribution' || kind === 'charts' || kind === 'charts-error') {
      this.adapter.presentation.render(this, this.adapter.presentation.createViewModel(this));
      return;
    }

    const deferred =
      this.deferredRotationRenderRevision === revision ||
      (kind === 'baseline-error' && this.templateRotationLoading?.revision === revision);

    if (deferred) this.deferredRotationRenderRevision = null;

    if (kind === 'baseline-error') {
      comparisonState.failRotationReference(this, this.analysis.state.simulationError);
      updatePaletteFreshness(this);

      if (deferred) this.adapter.renderRotationBuilder(this);
      else renderRotationComparison(this);

      return;
    }

    comparisonState.publishRotationReference(this, referenceResult);
    this.relicComparisonRunner.schedule();

    if (this.analysis.state.results?.encounter) document.dispatchEvent(new Event(ENCOUNTER_RESULT_EVENT));

    if (render) {
      if (deferred) this.adapter.renderRotationBuilder(this);
      else renderSimulationOutput(this);
    }
  }

  private scheduleInitialDeferredRender(): void {
    const generation = ++this.initialRenderGeneration;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (generation !== this.initialRenderGeneration) return;

        this.adapter.renderRotationBuilder(this);
      });
    });
  }

  /** Switches the existing editor atomically; global revisions never rewind into an old worker job. */
  activateBuildTab(id: string, workspace = this.workspace): void {
    if (workspace === this.workspace && id === this.workspace.activeTabId) return;

    const tab = workspace.tabs.find((entry) => entry.id === id);

    if (!tab) return;

    closeFloatingEditor();
    // Capture and persist the outgoing document before the same editors receive another workspace.
    saveBuildWorkspace(this);
    this.analysis.suspend();
    this.gearOptimizerRunner?.reset();
    this.initialRenderGeneration += 1;
    this.deferredRotationRenderRevision = null;
    this.workspace = workspace;
    // Restore the destination's simulation inputs before reusing caches or scheduling any new work.
    this.simulationSettings = workspace.simulationSettings;
    this.workspace.activeTabId = id;
    this.build = tab.build;
    this.patch = this.profession.resolvePatch({ id: tab.patchId, values: tab.session.patchPreviewValues });
    const { patchPreviewValues: _patchPreviewValues, ...session } = tab.session;
    Object.assign(this, session);

    commitRotationEdit(this, { type: 'select', index: this.rotationInsertionIndex });
    this.dragState = null;
    this.analysis.restore(tab.analysis);

    normalizeSelectedSkills(this);
    this.attributeData = this.adapter
      .createBuildContext({
        build: this.build,
        patch: this.patch,
        transitionDelays: normalizeTransitionDelays(this.simulationSettings?.transitionDelays)
      })
      .attributes(this.attributeWeaponSet === 2 ? 2 : 1);

    this.relicComparisonRunner.schedule();

    this.analysis.resume();

    saveBuildWorkspace(this);

    if (typeof document !== 'undefined') {
      document.body.dataset.simulationStatus = this.analysis.state.simulationStatus;
      // Discard transient dialogs and previews tied to the outgoing editor, including unfinished imports.
      document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((dialog) => dialog.close());
      for (const option of document.querySelectorAll<HTMLButtonElement>('.patch-preview-option')) {
        const active = option.dataset.patchId === this.patch.id;
        option.classList.toggle('active', active);
        option.setAttribute('aria-pressed', String(active));
      }

      const weaponSet = document.getElementById('attribute-weapon-set') as HTMLSelectElement | null;

      if (weaponSet) weaponSet.value = String(this.attributeWeaponSet);

      if (this.rotationComparison?.view === 'timelines') enterRotationFocus();

      this.renderBuildSections(true);
      this.adapter.buildEditor.updateSelection?.(this);
      this.adapter.renderRotationBuilder(this);
      renderBuildTabs(this);
      renderGearOptimizer(this);
    }
  }

  addRotation(name: string, options: RotationActionOptions = {}): void {
    addRotation(this, name, options);
  }

  /** Refreshes cursor-dependent views without changing the build or scheduling a simulation. */
  selectRotationInsertion(index: number | null): void {
    commitRotationEdit(this, { type: 'select', index });
    updateTimelineInsertionCursor(this);
    renderPalette(this);
    renderRotationStateSnapshot(this);
    renderRotationComparison(this, true);
  }

  /** Coordinates focus and rendering after the comparison owner accepts a fresh Current. */
  startRotationComparison(): void {
    if (!comparisonState.beginRotationComparison(this)) return;

    if (typeof document !== 'undefined') {
      enterRotationFocus();
      this.adapter.renderRotationBuilder(this);
    }
  }

  /** Schedules a newly copied reference under the current build revision. */
  loadRotationReference(rotation: readonly RotationCommand[]): void {
    if (!comparisonState.setRotationReference(this, rotation)) return;

    this.analysis.refreshBaseline();

    if (typeof document !== 'undefined') renderRotationComparison(this);
  }

  /** Repaints the empty reference without changing Current or leaving focus mode. */
  clearRotationReference(): void {
    if (!comparisonState.clearRotationReference(this)) return;

    if (typeof document !== 'undefined') renderRotationComparison(this);
  }

  /** Refreshes Current-only output after an atomic swap, retaining its matching cached timeline while queued. */
  swapRotationComparison(): void {
    const adoptedResult = comparisonState.swapRotationComparison(this);

    if (!adoptedResult) return;

    if (typeof document !== 'undefined') this.adapter.renderRotationBuilder(this);
  }

  /** Repaints the ordinary rotation workspace after the feature discards its reference. */
  exitRotationComparison(): void {
    if (!comparisonState.discardRotationComparison(this)) return;

    if (typeof document !== 'undefined') this.adapter.renderRotationBuilder(this);
  }

  /** Refresh the attribute preview through its owning editor section. */
  renderAttributes(): void {
    this.adapter.buildEditor.sections.find(({ id }) => id === 'attributes')?.render(this);
  }

  runRandomDistribution(): void {
    this.gearOptimizerRunner?.cancel();
    this.analysis.runDistribution();
  }

  runRelicComparison(comparisonRelic?: string, initialStacks?: number): void {
    this.gearOptimizerRunner?.cancel();
    this.relicComparisonRunner.run?.(comparisonRelic, initialStacks);
  }

  selectPatch(patchId: string): void {
    // Resolve before changing selections so an unavailable patch leaves the active build intact.
    const patch = this.profession.resolvePatch({ id: patchId });

    if (patchId === this.patch.id) return;

    // Abandon the outgoing version immediately instead of waiting behind an invisible simulation.
    this.analysis.suspend();
    swapSelectedSkillsForPatch(this, patch.catalog);
    this.patch = patch;
    this.changed(true, true, { patchSwitch: true });
  }

  /** Invokes game-owned editor contributions while preserving the existing render order. */
  private renderBuildSections(includeGear: boolean): void {
    for (const section of this.adapter.buildEditor.sections) {
      if (includeGear || section.id !== 'gear') section.render(this);
    }
  }
}
