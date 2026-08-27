import { decodeGw2BuildTemplate, resolveGw2BuildTemplate } from '../../../platform/builds/templates/codec.js';
import { replaceBuildConfiguration } from '../state/persistence.js';

import type {
  Gw2BuildTemplateWeaponSet,
  ResolvedGw2BuildTemplate
} from '../../../platform/builds/templates/codec.js';
import type { ProfessionAppState } from '../../../../../app/profession/types.js';

interface BuildTemplateProfession {
  readonly code: number;
  readonly id: string;
  readonly name: string;
  readonly route: string;
}

const BUILD_TEMPLATE_PROFESSIONS: Readonly<Record<string, BuildTemplateProfession>> = Object.freeze({
  guardian: {
    code: 1,
    id: 'guardian',
    name: 'Guardian',
    route: 'guardian.html'
  },
  warrior: { code: 2, id: 'warrior', name: 'Warrior', route: 'warrior.html' },
  engineer: {
    code: 3,
    id: 'engineer',
    name: 'Engineer',
    route: 'engineer.html'
  },
  ranger: { code: 4, id: 'ranger', name: 'Ranger', route: 'ranger.html' },
  thief: { code: 5, id: 'thief', name: 'Thief', route: 'thief.html' },
  elementalist: {
    code: 6,
    id: 'elementalist',
    name: 'Elementalist',
    route: 'elementalist.html'
  },
  mesmer: { code: 7, id: 'mesmer', name: 'Mesmer', route: 'mesmer.html' },
  necromancer: {
    code: 8,
    id: 'necromancer',
    name: 'Necromancer',
    route: 'necromancer.html'
  },
  revenant: {
    code: 9,
    id: 'revenant',
    name: 'Revenant',
    route: 'revenant.html'
  }
});
const BUILD_TEMPLATE_PROFESSIONS_BY_CODE = new Map(
  Object.values(BUILD_TEMPLATE_PROFESSIONS).map((profession) => [profession.code, profession])
);

export interface BuildTemplateImportPreview extends ResolvedGw2BuildTemplate {
  readonly sourceCode: string;
}

export class BuildTemplateProfessionMismatchError extends Error {
  readonly actualProfession: BuildTemplateProfession;
  readonly currentProfession: BuildTemplateProfession;

  constructor(actualProfession: BuildTemplateProfession, currentProfession: BuildTemplateProfession) {
    super(
      `This build code is for ${actualProfession.name}. You are currently viewing the ${currentProfession.name} simulator.`
    );
    this.name = 'BuildTemplateProfessionMismatchError';
    this.actualProfession = actualProfession;
    this.currentProfession = currentProfession;
  }
}

function currentProfession(app: ProfessionAppState): BuildTemplateProfession {
  const profession = BUILD_TEMPLATE_PROFESSIONS[app.adapter.id];
  if (!profession) {
    throw new Error(`${app.adapter.id} does not support GW2 build templates.`);
  }

  return profession;
}

/** Decodes a build into reviewable selections without changing application state. */
export function previewBuildTemplateCode(app: ProfessionAppState, chatCode: string): BuildTemplateImportPreview {
  const current = app.build as ProfessionAppState['build'] & {
    readonly startAttunement?: string;
  };
  const expectedProfession = currentProfession(app);
  const decoded = decodeGw2BuildTemplate(chatCode);
  const actualProfession = BUILD_TEMPLATE_PROFESSIONS_BY_CODE.get(decoded.professionCode);
  if (actualProfession && actualProfession.code !== expectedProfession.code) {
    throw new BuildTemplateProfessionMismatchError(actualProfession, expectedProfession);
  }

  return Object.freeze({
    ...resolveGw2BuildTemplate(decoded, {
      catalog: app.activeCatalog,
      expectedProfession,
      preferredAttunement: String(current.startAttunement || 'Fire')
    }),
    sourceCode: String(chatCode).trim()
  });
}

/** Applies a previously reviewed preview while retaining gear stats and rotation. */
export function applyBuildTemplatePreview(
  app: ProfessionAppState,
  preview: BuildTemplateImportPreview,
  weapons: Gw2BuildTemplateWeaponSet | null = preview.weapons
): readonly string[] {
  const current = app.build;
  app.build = replaceBuildConfiguration(
    {
      ...current,
      ...(weapons ? { weapons: [...weapons] } : {}),
      specializations: [...preview.specializations],
      selectedSkills: {
        ...current.selectedSkills,
        ...preview.selectedSkills
      }
    },
    current,
    app.adapter
  );
  app.changed();
  return preview.warnings;
}
