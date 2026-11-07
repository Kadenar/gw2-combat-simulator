import type { BuildWorkspace } from '#gw2/app/build/state/workspace.js';
import type { BuildTemplatePreset, BuildTemplateSelection } from '#gw2/app/build/types.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';

/** Selection and replacement undo travel with a build tab; catalog DOM and pending fetches belong to the library. */
export interface BuildLibrarySession {
  currentTemplate: BuildTemplateSelection | null;
  templateUndo: {
    build: Gw2CanonicalBuild;
    name?: string;
    resetBuild?: Gw2CanonicalBuild;
    selection: BuildTemplateSelection | null;
    message: string;
  } | null;
}

export type TemplateLoadAction = 'build' | 'rotation' | 'template' | 'new-tab';

/** Identity and destination stay fixed even if another selection supersedes this download. */
export interface LibraryLoadRequest {
  readonly action: TemplateLoadAction;
  readonly workspace: BuildWorkspace | undefined;
  readonly tabId: string | undefined;
  readonly patchId: string;
  readonly revision: number;
}

export interface BuildLibraryState extends BuildLibrarySession {
  templatePresets: BuildTemplatePreset[];
  templateContainer: HTMLElement | null;
  libraryLoad?: LibraryLoadRequest;
  /** Progress is scoped to a revision so ordinary rotation edits dismiss it. */
  templateRotationLoading?: { revision: number; fetching: boolean };
}

/** Each new tab starts without a selected template or a replacement to undo. */
export function emptyBuildLibrarySession(): BuildLibrarySession {
  return { currentTemplate: null, templateUndo: null };
}
