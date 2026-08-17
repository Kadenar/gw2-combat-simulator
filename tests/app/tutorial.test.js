import assert from "node:assert/strict";
import test from "node:test";

import {
  activateTutorialPanel,
  restartTutorialAnimation,
  setTutorialAnimationState,
  tutorialPrefersReducedMotion,
} from "../../js/app/tutorial.js";

function tutorialImageStub(source = "tutorial.gif") {
  const attributes = new Map();
  const changes = [];
  return {
    attributes,
    changes,
    dataset: { tutorialSrc: source },
    ownerDocument: { defaultView: null },
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    removeAttribute(name) {
      attributes.delete(name);
      changes.push(`remove:${name}`);
    },
    setAttribute(name, value) {
      attributes.set(name, value);
      changes.push(`set:${name}:${value}`);
    },
  };
}

function tutorialChoiceStub(id) {
  const attributes = new Map();
  return {
    attributes,
    dataset: { tutorialChoice: id },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
  };
}

function tutorialPanelStub(id, image) {
  return {
    dataset: { tutorialPanel: id },
    hidden: false,
    querySelector(selector) {
      return selector === ".tutorial-animation" ? image : null;
    },
  };
}

test("tutorial GIF loads only while animation should play", () => {
  const image = tutorialImageStub();

  assert.equal(image.getAttribute("src"), null);
  setTutorialAnimationState(image, true);
  assert.equal(image.getAttribute("src"), "tutorial.gif");

  setTutorialAnimationState(image, false);
  assert.equal(image.getAttribute("src"), null);
});

test("tutorial picker shows and loads only the selected walkthrough", () => {
  const choices = [
    tutorialChoiceStub("quick-start"),
    tutorialChoiceStub("rotation-builder"),
    tutorialChoiceStub("analysis"),
  ];
  const quickImage = tutorialImageStub("quick-start.gif");
  const rotationImage = tutorialImageStub("rotation-builder.gif");
  const analysisImage = tutorialImageStub("analysis.gif");
  const panels = [
    tutorialPanelStub("quick-start", quickImage),
    tutorialPanelStub("rotation-builder", rotationImage),
    tutorialPanelStub("analysis", analysisImage),
  ];
  const root = {
    querySelectorAll(selector) {
      if (selector === "[data-tutorial-choice]") return choices;
      if (selector === "[data-tutorial-panel]") return panels;
      return [];
    },
  };

  activateTutorialPanel(root, "analysis", true);

  assert.equal(choices[0].attributes.get("aria-pressed"), "false");
  assert.equal(choices[1].attributes.get("aria-pressed"), "false");
  assert.equal(choices[2].attributes.get("aria-pressed"), "true");
  assert.equal(panels[0].hidden, true);
  assert.equal(panels[1].hidden, true);
  assert.equal(panels[2].hidden, false);
  assert.equal(quickImage.getAttribute("src"), null);
  assert.equal(rotationImage.getAttribute("src"), null);
  assert.equal(analysisImage.getAttribute("src"), "analysis.gif");
});

test("tutorial replay resets the cached GIF on the next animation frame", () => {
  const image = tutorialImageStub();
  const queuedFrames = [];
  const view = {
    requestAnimationFrame(callback) {
      queuedFrames.push(callback);
    },
  };

  setTutorialAnimationState(image, true);
  restartTutorialAnimation(image, view);
  assert.equal(image.getAttribute("src"), null);

  queuedFrames.shift()();
  queuedFrames.shift()();
  assert.equal(image.getAttribute("src"), "tutorial.gif");
});

test("tutorial honors the system reduced-motion preference", () => {
  assert.equal(
    tutorialPrefersReducedMotion({
      matchMedia: () => ({ matches: true }),
    }),
    true,
  );
  assert.equal(
    tutorialPrefersReducedMotion({
      matchMedia: () => ({ matches: false }),
    }),
    false,
  );
  assert.equal(tutorialPrefersReducedMotion(null), false);
});
