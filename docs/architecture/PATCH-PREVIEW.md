# Patch preview navigation

Patch previews let the simulator evaluate upcoming balance changes alongside live content. The manifest and patch
implementation determine which edits and replacement modules are available.

## Authoring workflow

1. Run `npm run author:patch-preview` and open the local address printed by the server.
2. Edit the preview metadata and affected declarations, then review Overview & source.
3. Save and inspect the diff in [active-preview.ts](../../js/games/gw2/integrations/patches/active-preview.ts).
4. Rebuild before comparing the updated preview with live data.

The [authoring server](../../scripts/patch-preview/patch-preview-authoring-server.mjs) validates and writes the draft.
The [editor](../../js/games/gw2/app/patch-authoring/) owns its browser UI. Saving source does not rebuild the simulator;
commands and lifecycle scripts live in [package.json](../../package.json).

## Locate an edit

| Concern                                   | Owner                                                                                                                                                                                        |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Active preview content                    | [active-preview.ts](../../js/games/gw2/integrations/patches/active-preview.ts)                                                                                                               |
| Manifest grammar and validation           | [authoring/patches.ts](../../js/games/gw2/integrations/patches/authoring/patches.ts)                                                                                                         |
| Editable numeric fields and selectors     | [authoring/fields.ts](../../js/games/gw2/integrations/patches/authoring/fields.ts), owning skill and profile field declarations                                                              |
| Native module variants                    | [authoring/module-types.ts](../../js/games/gw2/integrations/patches/authoring/module-types.ts), [authoring/profession.ts](../../js/games/gw2/integrations/patches/authoring/profession.ts)   |
| Provisional values                        | [authoring/provisional-values.ts](../../js/games/gw2/integrations/patches/authoring/provisional-values.ts)                                                                                   |
| Resolved selection                        | [selection.ts](../../js/games/gw2/integrations/patches/selection.ts), [active-profession.ts](../../js/games/gw2/integrations/patches/active-profession.ts)                                   |
| Generated change descriptions             | [overview-generation.ts](../../js/games/gw2/integrations/patches/authoring/overview-generation.ts), [build-overview.ts](../../js/games/gw2/integrations/patches/authoring/build-overview.ts) |
| Simulator controls and cached comparisons | [app/patch-preview/](../../js/games/gw2/app/patch-preview/)                                                                                                                                  |

Follow the owning skill or trait declaration before adding a patch entry. Existing field registries and validation
distinguish numeric edits from behavior that needs a replacement module. Read current declarations for exact selectors
and supported fields.

## Validation and promotion

`npm run patch-preview:report` resolves affected preview content and prints a promotion checklist.
`npm run patch-preview:report -- --promotion` adds promotion checks, including unresolved provisional values. The
executable workflow lives in [patch-preview-report.mjs](../../scripts/patch-preview/patch-preview-report.mjs).

Promotion applies changes to live owners, resolves replacement modules and preset trait selections, then removes the
shipped overlay. Inspect the report and source diff for the active preview's actual work. Use
[AGENTS.md](../../AGENTS.md#testing-policy) to choose validation; release validation uses `npm run check:all`.

[Authoring tests](../../tests/games/gw2/app/patch-authoring/),
[selection tests](../../tests/games/gw2/app/patch-skill-selection.test.js), and
[comparison-cache tests](../../tests/games/gw2/app/patch-results.test.js) provide focused examples.
