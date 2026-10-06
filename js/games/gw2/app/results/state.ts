import type { ResultSortDirection } from '#gw2/app/results/breakdown/model.js';

/** Result table ordering belongs to the active build tab, independently of the simulation output. */
export interface ResultViewState {
  _skillSortCol?: string | null;
  _skillSortDir?: ResultSortDirection;
}

/** A new tab uses the breakdown's default total-damage ordering. */
export function emptyResultViewState(): ResultViewState {
  return { _skillSortCol: null, _skillSortDir: null };
}
