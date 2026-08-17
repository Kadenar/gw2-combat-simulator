import assert from "node:assert/strict";
import test from "node:test";

import {
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

test("tutorial GIF loads only while animation should play", () => {
  const image = tutorialImageStub();

  assert.equal(image.getAttribute("src"), null);
  setTutorialAnimationState(image, true);
  assert.equal(image.getAttribute("src"), "tutorial.gif");

  setTutorialAnimationState(image, false);
  assert.equal(image.getAttribute("src"), null);
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
