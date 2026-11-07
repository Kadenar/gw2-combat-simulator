/** Capture is the application seam; every projected fact must come from that input even after the session changes. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { capturePaletteInput } from '#gw2/app/rotation/palette/input.js';
import { projectPalette } from '#gw2/app/rotation/palette/model.js';
import { paletteHtml } from '#gw2/app/rotation/palette/view.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { paletteInputFixture } from '#tests/helpers/palette.js';
import { professionUiFixture } from '#tests/helpers/presentation.js';

test('captured cursor facts drive the whole palette independently of later application state', () => {
  const catalog = createCanonicalCatalog({
    skills: [{ id: 990201, name: 'Observed utility', type: 'Utility', castTimeMs: 0, effects: [] }]
  });
  const skill = catalog.skillsById.get(990201);
  const cursor = {
    atSeconds: 5,
    activeWeaponSet: 1,
    cooldownsBySkillId: { [skill.id]: { remainingMs: 3000, readyAtMs: 8000 } },
    ammoBySkillId: { [skill.id]: { charges: 1, maximum: 2, nextRechargeAt: 8 } },
    availability: { [skill.id]: { ready: true } },
    profession: { [STATE.RESOURCE]: 2 }
  };
  const ui = professionUiFixture({
    resourceViews: ({ professionState, simulationTime }) => {
      assert.equal(simulationTime, 5);
      return [{ id: 'focus', value: professionState[STATE.RESOURCE], maximum: 10, paletteSkillId: skill.id }];
    }
  });
  const facts = paletteInputFixture({
    catalog,
    ui,
    build: {
      selectedSkillIds: { utility1: skill.id },
      rotation: [
        { type: 'cast', skillId: skill.id },
        { type: 'cast', skillId: skill.id }
      ]
    }
  });
  let previews = 0;
  const patch = {};
  const app = {
    build: facts.build,
    patch,
    activeCatalog: catalog,
    weaponData: facts.weaponData,
    rotationInsertionIndex: 1,
    profession: { ui, resolveProfession: () => ({ canSwapWeaponSetsInCombat: true }) },
    adapter: {
      eliteSpecialization: () => 'Core',
      isSkillAvailable: facts.isSkillAvailable,
      slotLoadout: null,
      skillTooltip: (candidate, selectedPatch, build) => {
        assert.equal(candidate.id, skill.id);
        assert.equal(selectedPatch, patch);
        assert.equal(build, facts.build);
        return { description: 'Captured tooltip', facts: [] };
      },
      rotationPreviewAt: (_app, index) => {
        assert.equal(index, 1);
        previews += 1;
        return { planningState: cursor };
      }
    },
    analysis: {
      state: {
        results: {
          rotationEndTime: 20,
          events: [{ type: 'combat_start', at: 10 }],
          planningState: { ...cursor, atSeconds: 20, profession: { [STATE.RESOURCE]: 9 } }
        }
      }
    }
  };
  const input = capturePaletteInput(app);
  assert.equal(previews, 1);
  assert.equal(input.planning, cursor);
  assert.equal(input.combatReferenceMs, 10000);

  // Replacing the live result must not change the captured observation or let a callback reach back into the session.
  app.analysis.state.results = null;
  for (const key of Object.keys(app)) {
    Object.defineProperty(app, key, {
      get() {
        throw new Error(`Projection reread application ${key}`);
      }
    });
  }

  const projection = projectPalette(input);
  const tile = projection.utilityGroup.skills[0];
  assert.equal(tile.cooldownLabel, '3.000s');
  assert.equal(tile.ammo.current, 1);
  assert.equal(tile.resource.value, 2);
  assert.equal(projection.resources[0].value, 2);
  assert.equal(tile.tooltip.description, 'Captured tooltip');
  assert.equal(tile.contextDisabled, false);
  assert.equal(previews, 1);
  assert.ok(paletteHtml(projection).includes('Observed utility'));
});

test('captured combat origin remains independent of the cursor clock for cooldown labels', () => {
  const catalog = createCanonicalCatalog({
    skills: [{ id: 990202, name: 'Observed recharge', type: 'Utility', castTimeMs: 0, effects: [] }]
  });
  const skill = catalog.skillsById.get(990202);
  const input = paletteInputFixture({
    catalog,
    combatReferenceMs: 10000,
    build: { selectedSkillIds: { utility1: skill.id } },
    planning: {
      atSeconds: 5,
      activeWeaponSet: 1,
      cooldownsBySkillId: { [skill.id]: { remainingMs: 3000, readyAtMs: 8000 } },
      ammoBySkillId: {},
      availability: { [skill.id]: { ready: true } },
      profession: {}
    }
  });
  assert.match(projectPalette(input).utilityGroup.skills[0].castDetails, /Available at: -2\.000s/);
});
