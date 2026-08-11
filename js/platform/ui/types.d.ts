import type {
  ProfessionPaletteGroup,
  LegacyRotationItem,
  SchedulerRecord,
  SkillId,
} from "../engine/types.js";

export interface AmmoView {
  readonly current?: number;
  readonly maximum?: number;
  readonly pips?: readonly boolean[];
}

export interface PaletteResourceView {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly maximum: number;
}

export interface PaletteStatusIconView {
  readonly icon: string;
  readonly label: string;
  readonly title?: string;
}

export interface PaletteSkillView extends SchedulerRecord {
  readonly name?: string;
  readonly skillId?: SkillId | null;
  readonly title?: string;
  readonly icon?: string;
  readonly variantBadge?: string;
  readonly color?: string;
  readonly disabled?: boolean;
  readonly contextDisabled?: boolean;
  readonly concealed?: boolean;
  readonly highlighted?: boolean;
  readonly draggable?: boolean;
  readonly cooldownLabel?: string;
  readonly ammo?: AmmoView | null;
  readonly resource?: PaletteResourceView | null;
  readonly virtual?: boolean;
}

export interface PaletteGroupView {
  readonly label?: string;
  readonly color?: string;
  readonly className?: string;
  readonly skills?: readonly PaletteSkillView[];
  readonly statusIcon?: PaletteStatusIconView;
}

export interface NormalizedPaletteGroup extends Omit<
  ProfessionPaletteGroup,
  "skillEntries"
> {
  readonly skillEntries: SchedulerRecord[];
  readonly reservedSkillIds: readonly number[];
  readonly color: string;
  readonly className: string;
  readonly stackId: string;
  readonly resourceAnchor: boolean;
}

export type PaletteMouseEvent = MouseEvent & {
  readonly currentTarget: HTMLElement;
};

export type PaletteDragEvent = DragEvent & {
  readonly currentTarget: HTMLElement;
};

export interface PaletteInteractionHandlers {
  readonly onActivate?: (name: string, event: PaletteMouseEvent) => unknown;
  readonly onDragStart?: (name: string, event: PaletteDragEvent) => unknown;
  readonly onDragEnd?: (name: string, event: PaletteDragEvent) => unknown;
}

export interface EventLogDescriptor {
  readonly type: string;
  readonly description: string;
  readonly className?: string;
  readonly order?: number;
  readonly flags?: string[];
}

export interface NormalizedEventLogDescriptor extends EventLogDescriptor {
  readonly className: string;
  readonly order: number;
  readonly flags: string[];
}

export interface EventLogRow extends EventLogDescriptor {
  readonly at: number;
  readonly rowClassName?: string;
  readonly phantasmClone?: boolean;
}

export interface EventLogFilter {
  readonly id: string;
  readonly label: string;
  readonly predicate?: (row: EventLogRow) => boolean;
}

export interface EventLogMountOptions {
  readonly filters?: readonly EventLogFilter[];
  readonly initiallyOpen?: boolean;
  readonly title?: string;
  readonly filename?: string;
}

export interface RotationDragState extends SchedulerRecord {
  readonly source?: string;
  readonly index?: number;
  readonly name?: string;
  readonly skillId?: SkillId;
}

export interface TimelineInteractionOptions {
  readonly rotation: Array<LegacyRotationItem | SchedulerRecord>;
  readonly getDragState: () => RotationDragState | null | undefined;
  readonly setDragState: (value: RotationDragState | null) => void;
  readonly resolvePaletteEntry?: (
    name: string,
    drag: RotationDragState | null | undefined,
    insertAt: number,
  ) =>
    | LegacyRotationItem
    | SchedulerRecord
    | Array<LegacyRotationItem | SchedulerRecord>
    | null
    | undefined;
  readonly onChanged?: () => void;
  readonly onRemove?: (index: number, event?: Event) => unknown;
  readonly onTruncate?: (index: number, event?: Event) => unknown;
  readonly onEditOffset?: (index: number, event?: Event) => unknown;
  readonly onEditActivation?: (index: number, event?: Event) => unknown;
  readonly onEditInterrupt?: (index: number, event?: Event) => unknown;
  readonly onEditReleaseAtCharges?: (index: number, event?: Event) => unknown;
  readonly onEditWait?: (index: number, event?: Event) => unknown;
}
