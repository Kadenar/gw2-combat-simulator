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

export class ProfessionApp {
  constructor(adapter) {
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
    this.resourceDefinitions = (specialization) =>
      this.profession.ui.resourceViews({ specialization });
    this.resourceDefinition = (specialization) =>
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

  init() {
    bindPageControls(this);
    this.changed();
    initBuildTemplates(this);
    document.getElementById("loading-overlay")?.classList.add("hidden");
  }

  changed(rebuildStatic = true, rebuildGear = rebuildStatic) {
    const previousContributions = this.results?.contributions;
    normalizeSelectedSkills(this);
    this.adapter.recalculate(this);
    this.adapter.runSimulation(this);
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

  addRotation(name, options = {}) {
    addRotation(this, name, options);
  }

  renderGear() {
    renderGear(this);
  }

  renderTraits() {
    renderTraits(this);
  }

  renderAttributes() {
    renderAttributes(this);
  }

  renderSkills() {
    renderSkills(this);
  }

  renderAssumptions() {
    renderAssumptions(this);
  }

  runRandomDistribution() {
    this.randomDistributionRunner.run();
  }

  resetBuild() {
    this.build = createDefaultBuild(this.adapter);
    this.changed();
  }
}
