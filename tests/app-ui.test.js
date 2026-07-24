import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  groupedOptions,
  option,
  PERMANENT_TARGET_CONDITIONS,
  PRIMARY_ATTRIBUTES,
  STACKING_TARGET_CONDITIONS,
} from "../js/app/app-ui.js";

test("shared app options escape labels and preserve selection state", () => {
  assert.equal(
    option("a&b", "a&b", "<label>", true),
    '<option value="a&amp;b" selected disabled>&lt;label&gt;</option>',
  );
  assert.equal(
    groupedOptions(
      [{ label: "Damage & support", items: ["Power"] }],
      "Power",
      value => `${value} <stat>`,
    ),
    '<optgroup label="Damage &amp; support"><option value="Power" selected>Power &lt;stat&gt;</option></optgroup>',
  );
});

test("shared app metadata owns common attributes and target conditions", () => {
  assert.equal(PRIMARY_ATTRIBUTES.includes("Condition Damage"), true);
  assert.equal(PERMANENT_TARGET_CONDITIONS.includes("Vulnerability"), true);
  assert.equal(STACKING_TARGET_CONDITIONS.has("Vulnerability"), true);
  assert.equal(STACKING_TARGET_CONDITIONS.has("Burning"), false);
});

test("shared app runtime and platform rotation helpers are profession neutral", async () => {
  const sources = await Promise.all([
    readFile(new URL("../js/app/app-runtime.js", import.meta.url), "utf8"),
    readFile(new URL("../js/platform/ui/rotation-results.js", import.meta.url), "utf8"),
  ]);
  const professionTerms = [
    "Mesmer",
    "Mirage",
    "Continuum",
    "Malicious Sorcery",
    "phantasm",
    "clone",
  ];

  for (const source of sources) {
    for (const term of professionTerms) {
      assert.equal(source.includes(term), false, term);
    }
  }
});
