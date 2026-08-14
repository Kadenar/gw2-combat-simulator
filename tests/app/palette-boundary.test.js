import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared palette modules contain no profession-specific policy", async () => {
  const viewSource = await readFile(
    new URL("../../js/app/rotation/palette-view.ts", import.meta.url),
    "utf8",
  );
  const modelSource = await readFile(
    new URL("../../js/app/rotation/palette-model.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(
    viewSource,
    /elementalist|weaver|attunement|pistolBullets|Elemental Explosion|vindicator|chronomancer|continuum|revenant|engineer/i,
  );
  assert.doesNotMatch(
    modelSource,
    /vindicator|chronomancer|continuum|revenant|engineer/i,
  );
});
