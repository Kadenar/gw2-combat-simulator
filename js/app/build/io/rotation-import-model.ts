/** Read-only evidence surfaced after parsing but never applied to simulator state. */
export interface RotationImportObservation {
  readonly title: string;
  readonly summary: string;
  readonly detail: string;
}
