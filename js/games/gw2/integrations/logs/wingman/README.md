# gw2wingman import

Imports public gw2wingman `/log/<id>` links through `/api/getJson/<id>`. `normalize.ts` converts the HTML-embedded Elite
Insights format into the document validated by `../dps-report/parser.ts`, then reuses the
[dps.report reconstruction pipeline](../dps-report/README.md).

The conversion:

- Selects the phase with the largest span as the full-fight rotation source.
- Groups `[atSeconds, skillId, durationMs, statusId, quickness]` tuples by skill and converts cast seconds to
  milliseconds. It does not add a phase-start offset; the selected full-fight timeline must already use the report
  origin.
- Maps EI's short skill metadata fields (`aa`, `notAccurate`, `traitProc`, `gearProc`, `unconditionalProc`) to the
  report parser's names, preserving `isSwap`.
- Converts Reduced/Interrupted status to positive/negative `timeGained`; other statuses use zero. Nonpositive duration
  identifies instant casts in the shared report path.

The normalizer currently supplies player rotations only, so pet-animation selection requires a source that supplies
minion rotations. Downstream phase filtering, catalog matching, replay conversion, and warnings follow dps.report rules.

`url.ts` requires a gw2wingman host and a `/log/<id>` path rather than a bare ID, avoiding ambiguity with dps.report
IDs. Fetches use the canonical HTTPS API endpoint.
