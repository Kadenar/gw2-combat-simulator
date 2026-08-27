import {
  bindPageControls,
  createDefaultBuild,
  initBuildTemplates,
  loadBuild,
  normalizeSelectedSkills,
  renderAssumptions,
  renderAttributes,
  renderGear,
  renderSkills,
  renderTraits,
  saveBuild,
  updateTemplateSelection
} from './build/index.js';
import { addRotation } from './rotation/editing/actions.js';
import { mountRotationClipboard } from './rotation/editing/clipboard.js';
import { recordRotationHistory } from './rotation/editing/history.js';
import { mountRotationDisplayControls } from './rotation/timeline/display-controls.js';
import { ModifierContributionRunner } from './simulation/modifier-contribution-runner.js';
import { RandomDistributionRunner } from './simulation/random-distribution-runner.js';
import { RelicComparisonRunner } from './simulation/relic-comparison-runner.js';
import { RELIC_NAMES as SHARED_RELIC_NAMES } from '../platform/gw2/equipment/relics/catalog.js';
import { readStoredRotationProcOverlayVisibility } from './rotation/timeline/proc-overlays.js';
import { mountPatchPreviewControls } from './simulation/patch-preview-view.js';
import { BaselineSimulationRunner } from './simulation/baseline-simulation-runner.js';
import { renderRotationEditor, renderSimulationOutput } from './rotation/index.js';
import { SIMULATOR_VIEW_CHANGE_EVENT } from './profession/navigation.js';

import type {
  BuildTemplatePreset,
  BuildTemplateSelection,
  Gw2AppAdapter,
  ProfessionAppResult,
  ProfessionAppState,
  BaselineSimulationOutput,
  ProfessionChangeOptions,
  ProfessionAttributeData,
  ProfessionApplicationBuild,
  ProfessionRotationDragState,
  RotationActionOptions
} from './profession/types.js';

export class ProfessionApp implements ProfessionAppState {
  readonly adapter: Gw2AppAdapter;
  readonly profession: ProfessionAppState['profession'];
  activeCatalog: ProfessionAppState['activeCatalog'];
  patchId: string;
  patchComparison: ProfessionAppState['patchComparison'];
  build: ProfessionApplicationBuild;
  skills: ProfessionAppState['skills'];
  skillByName: ProfessionAppState['skillByName'];
  skillById: ProfessionAppState['skillById'];
  readonly weaponData: ProfessionAppState['weaponData'];
  readonly relicNames: ProfessionAppState['relicNames'];
  readonly specializations: ProfessionAppState['specializations'];
  readonly resourceDefinitions: ProfessionAppState['resourceDefinitions'];
  attributeWeaponSet: number;
  attributeData: ProfessionAttributeData | null;
  results: ProfessionAppResult | null;
  buildRevision: number;
  resultRevision: number;
  simulationStatus: ProfessionAppState['simulationStatus'];
  simulationError: string;
  dragState: ProfessionRotationDragState | null;
  rotationInsertionIndex: number | null;
  rotationSelection: ProfessionAppState['rotationSelection'];
  rotationSelectionMode: boolean;
  rotationClipboard: ProfessionAppState['rotationClipboard'];
  overlaySigilProcs: boolean;
  overlayRelicProcs: boolean;
  templatePresets: BuildTemplatePreset[];
  templateContainer: HTMLElement | null;
  currentTemplate: BuildTemplateSelection | null;
  templateUndoBuild: ProfessionApplicationBuild | null;
  readonly modifierContributionRunner: ModifierContributionRunner;
  readonly randomDistributionRunner: RandomDistributionRunner;
  readonly relicComparisonRunner: RelicComparisonRunner;
  readonly baselineSimulationRunner: BaselineSimulationRunner;
  private initialRenderGeneration: number;
  private deferredRotationRenderRevision: number | null;

  constructor(adapter: Gw2AppAdapter) {
    if (!adapter?.profession) {
      throw new TypeError('ProfessionApp requires an app adapter.');
    }

    this.adapter = adapter;
    this.profession = adapter.profession;
    this.activeCatalog = this.profession.catalog;
    this.patchId = 'current';
    this.patchComparison = null;
    this.build = loadBuild(adapter);
    this.skills = [...this.activeCatalog.skills];
    this.skillByName = this.activeCatalog.skillsByName;
    this.skillById = this.activeCatalog.skillsById;
    this.weaponData = adapter.weaponData;
    this.relicNames = adapter.relicNames || SHARED_RELIC_NAMES;
    this.specializations = adapter.specializations;
    this.resourceDefinitions = (specialization: string) => this.profession.ui.resourceViews({ specialization });
    this.attributeWeaponSet = 1;
    this.attributeData = null;
    this.results = null;
    this.buildRevision = 0;
    this.resultRevision = 0;
    this.simulationStatus = 'idle';
    this.simulationError = '';
    this.dragState = null;
    this.rotationInsertionIndex = null;
    this.rotationSelection = null;
    this.rotationSelectionMode = false;
    this.rotationClipboard = [];
    // Restore timeline display preferences independently from the saved build and simulation configuration.
    this.overlaySigilProcs = readStoredRotationProcOverlayVisibility(document, 'sigil');
    this.overlayRelicProcs = readStoredRotationProcOverlayVisibility(document, 'relic');
    this.templatePresets = [];
    this.templateContainer = null;
    this.currentTemplate = null;
    this.templateUndoBuild = null;
    this.modifierContributionRunner = new ModifierContributionRunner(this);
    this.randomDistributionRunner = new RandomDistributionRunner(this);
    this.relicComparisonRunner = new RelicComparisonRunner(this);
    this.baselineSimulationRunner = new BaselineSimulationRunner(this);
    this.initialRenderGeneration = 0;
    this.deferredRotationRenderRevision = null;
  }

  async init(): Promise<void> {
    mountPatchPreviewControls(this);
    mountRotationClipboard(this);
    bindPageControls(this);
    document.addEventListener(SIMULATOR_VIEW_CHANGE_EVENT, () => {
      const results = document.getElementById('rotation-results');

      if (document.body?.dataset.simulatorView === 'analysis' && results?.dataset.analysisStale === 'true') {
        this.adapter.renderResults(this);
      }
    });
    const templatesReady = initBuildTemplates(this);
    this.updateSimulationStateSynchronously();
    renderGear(this);
    renderTraits(this);
    renderAttributes(this);
    renderSkills(this);
    this.renderAssumptions();
    await templatesReady;
    // Commit the asynchronously inserted templates under the loading overlay.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    document.getElementById('loading-overlay')?.classList.add('hidden');
    this.scheduleInitialDeferredRender();
  }

  changed(rebuildStatic = true, rebuildGear = rebuildStatic, options: ProfessionChangeOptions = {}): void {
    this.initialRenderGeneration += 1;
    const revision = this.prepareSimulationState();
    this.baselineSimulationRunner.schedule(revision);

    if (rebuildStatic) {
      if (rebuildGear) renderGear(this);
      renderTraits(this);
      renderAttributes(this);
      renderSkills(this);
      this.renderAssumptions();
    }

    updateTemplateSelection(this);
    // Rotation-only edits keep the resolved builder intact until the worker can paint the new commands and results
    // together; otherwise every edit briefly collapses result-derived timeline rows and causes visible flicker.
    const deferRotationRender = !rebuildStatic || options.deferRotationRender === true;

    if (deferRotationRender) this.deferredRotationRenderRevision = revision;
    else {
      this.deferredRotationRenderRevision = null;
      renderRotationEditor(this);
    }
  }

  /** Commits cheap build derivations now and assigns the immutable revision used by worker results. */
  private prepareSimulationState(): number {
    recordRotationHistory(this);
    normalizeSelectedSkills(this);
    this.adapter.recalculate(this);
    saveBuild(this.build, this.adapter);
    this.buildRevision += 1;
    this.simulationStatus = 'queued';
    this.simulationError = '';

    if (document.body) document.body.dataset.simulationStatus = this.simulationStatus;
    return this.buildRevision;
  }

  /** Preserves synchronous first paint while all edit-triggered baselines use the worker. */
  private updateSimulationStateSynchronously(): void {
    const revision = this.prepareSimulationState();
    const output = this.adapter.calculateBaselineSimulation(this.adapter.baselineSimulationRequest(this));
    this.commitBaselineSimulation(output, revision, false);
  }

  publishBaselineSimulation(output: BaselineSimulationOutput, revision: number): void {
    this.commitBaselineSimulation(output, revision, true);
  }

  /** Rejects stale completions before publishing any result-dependent UI or follow-up work. */
  private commitBaselineSimulation(output: BaselineSimulationOutput, revision: number, render: boolean): void {
    if (revision !== this.buildRevision) return;
    const renderDeferredRotation = this.deferredRotationRenderRevision === revision;

    if (renderDeferredRotation) this.deferredRotationRenderRevision = null;
    const previousContributions = this.results?.contributions;
    this.results = output.result as ProfessionAppResult;
    this.patchComparison = output.patchComparison;

    if (Array.isArray(previousContributions)) this.results.contributions = previousContributions;
    this.resultRevision = revision;
    this.simulationStatus = 'idle';
    this.simulationError = '';

    if (document.body) document.body.dataset.simulationStatus = this.simulationStatus;
    this.randomDistributionRunner.schedule();
    this.modifierContributionRunner.schedule();
    this.relicComparisonRunner.schedule();

    if (render) {
      if (renderDeferredRotation) this.adapter.renderRotationBuilder(this);
      else renderSimulationOutput(this);
    }
  }

  failBaselineSimulation(error: unknown, revision: number): void {
    if (revision !== this.buildRevision) return;
    const renderDeferredRotation = this.deferredRotationRenderRevision === revision;

    if (renderDeferredRotation) this.deferredRotationRenderRevision = null;
    this.simulationStatus = 'error';
    this.simulationError = error instanceof Error ? error.message : String(error || 'Simulation failed.');

    if (document.body) document.body.dataset.simulationStatus = this.simulationStatus;

    if (renderDeferredRotation) this.adapter.renderRotationBuilder(this);
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

  addRotation(name: string, options: RotationActionOptions = {}): void {
    addRotation(this, name, options);
  }

  renderGear(): void {
    renderGear(this);
  }

  renderTraits(): void {
    renderTraits(this);
  }

  renderAttributes(): void {
    renderAttributes(this);
  }

  renderSkills(): void {
    renderSkills(this);
  }

  renderAssumptions(): void {
    renderAssumptions(this);
    mountRotationDisplayControls(this);
  }

  runRandomDistribution(): void {
    this.randomDistributionRunner.run();
  }

  runRelicComparison(): void {
    this.relicComparisonRunner.run();
  }

  selectPatch(patchId: string): void {
    const catalog = this.profession.catalogFor
      ? this.profession.catalogFor(patchId)
      : patchId === 'current'
        ? this.profession.catalog
        : null;

    if (!catalog) throw new TypeError(`Unknown patch ${patchId}.`);

    if (patchId === this.patchId) return;
    this.patchId = patchId;
    this.activeCatalog = catalog;
    this.skills = [...catalog.skills];
    this.skillByName = catalog.skillsByName;
    this.skillById = catalog.skillsById;
    this.changed();
  }

  resetBuild(): void {
    this.build = createDefaultBuild(this.adapter);
    this.changed();
  }
}
