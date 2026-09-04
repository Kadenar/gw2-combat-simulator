import assert from 'node:assert/strict';
import test from 'node:test';

import { dispatchPaletteActivation } from '#gw2/app/rotation/palette/view.js';

// Builds only the app surface used by palette activation so each branch stays isolated.
function activationApp(skills) {
  const catalog = {
    skills,
    skillsById: new Map(skills.map((skill) => [skill.id, skill])),
    skillsByName: new Map(skills.map((skill) => [skill.name, skill]))
  };
  const added = [];
  let professionAction;
  const app = {
    build: {
      rotation: [],
      startingWeaponSet: 1,
      weapons: ['', ''],
      alternateWeapons: ['', '']
    },
    adapter: {
      eliteSpecialization: () => 'Core',
      isSkillAvailable: () => true
    },
    profession: {
      catalog,
      ui: {
        isPaletteSkillInstant: () => false,
        resolvePaletteAction: () => professionAction
      }
    },
    activeCatalog: catalog,
    skills,
    skillById: catalog.skillsById,
    skillByName: catalog.skillsByName,
    results: null,
    attributeData: null,
    rotationInsertionIndex: null,
    changed() {},
    addRotation(name, options) {
      added.push({ name, options });
    }
  };
  return {
    app,
    added,
    setProfessionAction(value) {
      professionAction = value;
    }
  };
}

function activationEvent(skillId, { shiftKey = false, ctrlKey = false } = {}) {
  return {
    currentTarget: {
      dataset: { skillId: String(skillId) },
      classList: { contains: () => false },
      querySelector: () => null
    },
    shiftKey,
    ctrlKey
  };
}

test('palette activation dispatches ordinary and exceptional actions', () => {
  const ordinary = { id: 1, name: 'Ordinary', type: 'Utility', castTimeMs: 500, interruptCommitMs: 240 };
  const instant = { id: 2, name: 'Instant', type: 'Utility', castTimeMs: 0 };
  const dragonSlash = { id: 3, name: 'Dragon Slash', type: 'Profession', castTimeMs: 0, dragonSlash: true };
  const doubleEdge = { id: 4, name: 'Double Edge', type: 'Utility', handlerId: 'thief.double-edge' };
  const { app, added, setProfessionAction } = activationApp([ordinary, instant, dragonSlash, doubleEdge]);
  const opened = {};
  const editors = {
    openDuration(options) {
      opened.duration = options;
    },
    openDragonSlash(options) {
      opened.dragonSlash = options;
    },
    openDoubleEdge(options) {
      opened.doubleEdge = options;
    },
    openActivation(options) {
      opened.activation = options;
    }
  };

  dispatchPaletteActivation(app, ordinary.name, activationEvent(ordinary.id), editors);
  assert.deepEqual(added.pop(), { name: ordinary.name, options: { skillId: ordinary.id } });

  setProfessionAction({ type: 'cooldown-reset' });
  dispatchPaletteActivation(app, 'Profession Action', activationEvent(-1), editors);
  assert.deepEqual(app.build.rotation, [{ type: 'cooldown-reset' }]);
  setProfessionAction(undefined);

  dispatchPaletteActivation(app, '__wait', activationEvent(-2), editors);
  opened.duration.onApply(750);
  assert.deepEqual(added.pop(), { name: '__wait', options: { durationMs: 750 } });

  app.build.rotation = [];
  dispatchPaletteActivation(app, dragonSlash.name, activationEvent(dragonSlash.id), editors);
  assert.equal(opened.dragonSlash.insertionIndex, 0);
  opened.dragonSlash.onApply(3);
  assert.deepEqual(added.pop(), {
    name: dragonSlash.name,
    options: { skillId: dragonSlash.id, releaseAtCharges: 3 }
  });

  dispatchPaletteActivation(app, doubleEdge.name, activationEvent(doubleEdge.id), editors);
  opened.doubleEdge.onApply('backfire');
  assert.deepEqual(added.pop(), {
    name: doubleEdge.name,
    options: { skillId: doubleEdge.id, doubleEdgeOutcome: 'backfire' }
  });

  app.build.rotation = [{ type: 'cast', skillId: ordinary.id }];
  dispatchPaletteActivation(app, instant.name, activationEvent(instant.id, { shiftKey: true }), editors);
  assert.deepEqual(added.pop(), {
    name: instant.name,
    options: { skillId: instant.id, concurrentOffsetMs: 120 }
  });

  dispatchPaletteActivation(app, ordinary.name, activationEvent(ordinary.id, { ctrlKey: true }), editors);
  assert.equal(opened.activation.suggestedInterruptMs, 240);
  opened.activation.onApply(120);
  assert.deepEqual(added.pop(), {
    name: ordinary.name,
    options: { skillId: ordinary.id, interruptAfterMs: 120 }
  });
});
