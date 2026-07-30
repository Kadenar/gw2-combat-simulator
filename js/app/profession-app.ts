import {
  createDefaultBuild,
  loadBuild,
  saveBuild,
} from "./build/persistence.js";
import { renderAssumptions } from "./build/assumptions-panel.js";
import { renderAttributes } from "./build/attributes-panel.js";
import { renderGear } from "./build/gear-panel.js";
import { bindPageControls } from "./build/page-controls.js";
import {
  initBuildTemplates,
  updateTemplateSelection,
} from "./build/presets.js";
import { normalizeSelectedSkills } from "./build/selection.js";
import { renderSkills } from "./build/skills-panel.js";
import { renderTraits } from "./build/traits-panel.js";
import { addRotation } from "./rotation/actions.js";
import { ModifierContributionRunner } from "./simulation/modifier-contribution-runner.js";
import { RandomDistributionRunner } from "./simulation/random-distribution-runner.js";
import {
  RELIC_NAMES as SHARED_RELIC_NAMES,
} from "../platform/gw2/gear-data.js";

import type {
  BuildTemplatePreset,
  BuildTemplateSelection,
  Gw2AppAdapter,
  ProfessionAppResult,
  ProfessionAppState,
  ProfessionAttributeData,
  ProfessionApplicationBuild,
  ProfessionRotationDragState,
  RotationActionOptions,
} from "./profession/types.js";

export class ProfessionApp implements ProfessionAppState {
  readonly adapter: Gw2AppAdapter;
  readonly profession: ProfessionAppState["profession"];
  build: ProfessionApplicationBuild;
  readonly skills: ProfessionAppState["skills"];
  readonly skillByName: ProfessionAppState["skillByName"];
  readonly skillById: ProfessionAppState["skillById"];
  readonly weaponData: ProfessionAppState["weaponData"];
  readonly relicNames: ProfessionAppState["relicNames"];
  readonly specializations: ProfessionAppState["specializations"];
  readonly resourceDefinitions: ProfessionAppState["resourceDefinitions"];
  readonly resourceDefinition: ProfessionAppState["resourceDefinition"];
  attributeWeaponSet: number;
  attributeData: ProfessionAttributeData | null;
  results: ProfessionAppResult | null;
  dragState: ProfessionRotationDragState | null;
  templatePresets: BuildTemplatePreset[];
  templateContainer: HTMLElement | null;
  currentTemplate: BuildTemplateSelection | null;
  templateUndoBuild: ProfessionApplicationBuild | null;
  readonly modifierContributionRunner: ModifierContributionRunner;
  readonly randomDistributionRunner: RandomDistributionRunner;

  constructor(adapter: Gw2AppAdapter) {
    if (!adapter?.profession) {
      throw new TypeError("ProfessionApp requires an app adapter.");
    }
    this.adapter = adapter;
    this.profession = adapter.profession;
    this.build = loadBuild(adapter);
    this.skills = [...this.profession.catalog.skills];
    this.skillByName = this.profession.catalog.skillsByName;
    this.skillById = this.profession.catalog.skillsById;
    this.weaponData = adapter.weaponData;
    this.relicNames = adapter.relicNames || SHARED_RELIC_NAMES;
    this.specializations = adapter.specializations;
    this.resourceDefinitions = (specialization: string) =>
      this.profession.ui.resourceViews({ specialization });
    this.resourceDefinition = (specialization: string) =>
      this.resourceDefinitions(specialization)[0] || null;
    this.attributeWeaponSet = 1;
    this.attributeData = null;
    this.results = null;
    this.dragState = null;
    this.templatePresets = [];
    this.templateContainer = null;
    this.currentTemplate = null;
    this.templateUndoBuild = null;
    this.modifierContributionRunner = new ModifierContributionRunner(this);
    this.randomDistributionRunner = new RandomDistributionRunner(this);
  }

  init(): void {
    bindPageControls(this);
    this.changed();
    initBuildTemplates(this);
    document.getElementById("loading-overlay")?.classList.add("hidden");
  }

  changed(rebuildStatic = true, rebuildGear = rebuildStatic): void {
    const previousContributions = this.results?.contributions;
    normalizeSelectedSkills(this);
    this.adapter.recalculate(this);
    this.results =
      this.adapter.runSimulation(this) as ProfessionAppResult;
    if (Array.isArray(previousContributions)) {
      this.results.contributions = previousContributions;
    }
    this.randomDistributionRunner.schedule();
    this.modifierContributionRunner.schedule();
    saveBuild(this.build, this.adapter);
    if (rebuildStatic) {
      if (rebuildGear) renderGear(this);
      renderTraits(this);
      renderAttributes(this);
      renderSkills(this);
      renderAssumptions(this);
    }
    updateTemplateSelection(this);
    this.adapter.renderRotationBuilder(this);
  }

  addRotation(
    name: string,
    options: RotationActionOptions = {},
  ): void {
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
  }

  runRandomDistribution(): void {
    this.randomDistributionRunner.run();
  }

  resetBuild(): void {
    this.build = createDefaultBuild(this.adapter);
    this.changed();
  }
}
