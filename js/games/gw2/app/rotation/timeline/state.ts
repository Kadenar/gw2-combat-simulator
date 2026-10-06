/** Timeline selection and proc filters follow the active build, while saved overlay preferences remain shared. */
export interface RotationTimelineSession {
  procVisibility?: Set<string>;
  procVisibilityKeys?: Set<string>;
  procFilterOpen?: boolean;
  procHighlightKey?: string | null;
  rotationSkillHighlightKey?: string | null;
}

export interface RotationTimelineState extends RotationTimelineSession {
  overlaySigilProcs?: boolean;
  overlayRelicProcs?: boolean;
  timelineOverlayVisibility?: Record<string, boolean>;
}

/** New build tabs have no selected proc or skill and derive their visible proc set from their own result. */
export function emptyRotationTimelineSession(): RotationTimelineSession {
  return {
    procVisibility: undefined,
    procVisibilityKeys: undefined,
    procFilterOpen: false,
    procHighlightKey: null,
    rotationSkillHighlightKey: null
  };
}
