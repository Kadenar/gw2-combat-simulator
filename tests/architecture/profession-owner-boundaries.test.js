import { assertIndependentProfessionOwners, professionSourceGraph } from '#tests/helpers/profession-source-graph.js';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const boundaries = {
  elementalist: [
    'core/state.ts',
    'core/traits/critical-eligibility.ts',
    'specializations/catalyst/mechanics/resources.ts'
  ],
  engineer: [
    'core/traits/firearms/index.ts',
    'specializations/holosmith/traits/forge-availability.ts',
    'specializations/holosmith/mechanics/photon-forge.ts'
  ],
  necromancer: [
    'core/mechanics/resources.ts',
    'core/traits/soul-reaping/procs.ts',
    'core/traits/soul-reaping/modifiers.ts',
    'core/traits/soul-reaping/life-force.ts',
    'core/traits/soul-reaping/shroud.ts',
    'specializations/ritualist/skills/spirit-actions.ts'
  ],
  ranger: [
    'core/traits/nature-magic/attributes.ts',
    'core/traits/skirmishing/attributes.ts',
    'core/traits/wilderness-survival/attributes.ts',
    'core/traits/nature-magic/index.ts',
    'core/traits/marksmanship/opening-strike.ts',
    'core/traits/skirmishing/movement.ts',
    'core/traits/marksmanship/beast-skills.ts',
    'core/traits/nature-magic/beast-skills.ts',
    'core/traits/wilderness-survival/poison.ts',
    'core/traits/skirmishing/index.ts',
    'specializations/soulbeast/skills/stance-skills.ts'
  ],
  revenant: [
    'core/mechanics/resources.ts',
    'core/mechanics/reactions.ts',
    'specializations/conduit/mechanics/affinity.ts',
    'specializations/conduit/mechanics/forms.ts',
    'specializations/herald/traits/index.ts',
    'specializations/renegade/skills/warband.ts',
    'specializations/vindicator/skills/profession-skills.ts'
  ],
  thief: [
    'core/mechanics/reactions.ts',
    'specializations/antiquary/mechanics/artifacts.ts',
    'specializations/antiquary/skills/artifact-actions.ts',
    'specializations/specter/mechanics/shadow-shroud.ts'
  ],
  guardian: ['specializations/luminary/mechanics/radiant-forge.ts', 'specializations/luminary/skills/hammer-impact.ts'],
  mesmer: ['family-resources.ts'],
  warrior: ['core/state.ts']
};

// These boundaries protect independent initialization, not a required filename or directory layout.
for (const [profession, entries] of Object.entries(boundaries)) {
  // Every registered line must initialize independently, including lines without separate support files.
  const traitRoot = path.resolve(import.meta.dirname, '../../js/games/gw2/professions', profession, 'core/traits');
  entries.push(
    ...readdirSync(traitRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `core/traits/${entry.name}/index.ts`)
  );
  test(`${profession} skill, trait, and resource owners remain independent of hook assembly`, () => {
    assertIndependentProfessionOwners(professionSourceGraph(profession), entries);
  });

  test(`${profession} owners load before profession composition in a fresh process`, () => {
    const imports = entries.map((entry) => `#gw2/professions/${profession}/${entry.replace(/\.ts$/, '.js')}`);
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `for (const entry of ${JSON.stringify(imports)}) await import(entry); await import('#gw2/professions/${profession}/profession.js');`
      ],
      { cwd: path.resolve(import.meta.dirname, '../..'), stdio: 'pipe' }
    );
  });
}
