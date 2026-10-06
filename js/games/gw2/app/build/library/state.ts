import type { BuildTemplatePreset, BuildTemplateSelection } from '#gw2/app/build/types.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';

/** Selection and replacement undo travel with a build tab; catalog DOM and pending fetches belong to the library. */
export interface BuildLibrarySession {
  currentTemplate: BuildTemplateSelection | null;
  templateUndoBuild: Gw2CanonicalBuild | null;
  templateUndoMessage?: string;
}

export interface BuildLibraryState extends BuildLibrarySession {
  templatePresets: BuildTemplatePreset[];
  templateContainer: HTMLElement | null;
  /** Progress is scoped to a revision so ordinary rotation edits dismiss it. */
  templateRotationLoading?: { revision: number; fetching: boolean };
}

/** Each new tab starts without a selected template or a replacement to undo. */
export function emptyBuildLibrarySession(): BuildLibrarySession {
  return { currentTemplate: null, templateUndoBuild: null, templateUndoMessage: '' };
}
