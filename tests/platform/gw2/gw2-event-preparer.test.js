import assert from "node:assert/strict";
import test from "node:test";

import {
  isGw2NonWeaponEffectEvent,
} from "../../../js/platform/gw2/event-ownership.js";
import {
  createGw2EventPreparer,
} from "../../../js/platform/gw2/scheduler/event-preparer.js";
import {
  weaponStrengthProfileIdForEvent,
} from "../../../js/platform/gw2/weapon-strength.js";

test("non-weapon effect ownership has one canonical classifier", () => {
  assert.equal(isGw2NonWeaponEffectEvent({ actorType: "effect" }), true);
  for (const source of [
    "Trait",
    "SIGIL",
    "relic",
    "Food",
    "equipment",
  ]) {
    assert.equal(
      isGw2NonWeaponEffectEvent({ actorType: "player", source }),
      true,
      source,
    );
  }
  assert.equal(
    isGw2NonWeaponEffectEvent({ actorType: "summon", source: "Phantasm" }),
    false,
  );
  assert.equal(
    isGw2NonWeaponEffectEvent({ actorType: "player", source: " Trait " }),
    false,
  );
  assert.equal(
    weaponStrengthProfileIdForEvent({
      type: "damage",
      at: 0,
      source: "Equipment",
      sourceId: "equipment.proc",
      actorType: "player",
      coefficient: 1,
    }),
    "nonweapon.unequipped",
  );
});

test("event preparation groups related triggered packets per simulation pass", () => {
  let activationOrder = 0;
  const context = {
    catalog: {
      skillsById: new Map(),
      skillsByName: new Map(),
    },
    config: { primaryWeapon: "Dagger" },
    state: { activeWeaponSet: 1, profession: {} },
    createActivationId(kind) {
      activationOrder += 1;
      return `${kind}:test:${activationOrder}`;
    },
  };
  const preparer = createGw2EventPreparer();
  const packet = {
    type: "damage",
    at: 1,
    source: "Trait",
    sourceId: "trait.proc",
    actorType: "effect",
    skillName: "Trait Proc",
    coefficient: 0.5,
    activationId: "cast:7",
    triggeredBy: "cast:7",
  };

  const first = preparer.prepare(context, packet);
  const second = preparer.prepare(context, { ...packet, at: 1.25 });
  const unrelated = preparer.prepare(context, {
    ...packet,
    at: 1.5,
    sourceId: "trait.other",
  });

  assert.equal(first.activationId, "effect:test:1");
  assert.equal(second.activationId, first.activationId);
  assert.equal(unrelated.activationId, "effect:test:2");
  assert.equal(first.weaponStrengthProfileId, "nonweapon.unequipped");
  assert.equal(second.weaponStrengthProfileId, "nonweapon.unequipped");
  assert.equal(activationOrder, 2);

  const marker = {
    type: "marker",
    at: 2,
    source: "System",
    sourceId: "marker",
  };
  assert.equal(preparer.prepare(context, marker), marker);
});
