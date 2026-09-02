import { useState } from 'react';
import { renderReact } from '#ui/react-root.js';

export interface RotationWarning {
  readonly message?: unknown;
  readonly text?: unknown;
  readonly time?: unknown;
}

export interface RotationWarningOptions {
  readonly open?: boolean;
}

interface NormalizedRotationWarning {
  readonly message: string;
  readonly time: string;
}

/** Normalizes string and structured warnings before the React view displays them. */
export function normalizeRotationWarnings(
  warnings: readonly (RotationWarning | string)[] = []
): NormalizedRotationWarning[] {
  return warnings
    .filter((warning) => warning != null)
    .map((warning) =>
      typeof warning === 'object'
        ? {
            message: String(warning.message ?? warning.text ?? ''),
            time: warning.time == null ? '' : String(warning.time)
          }
        : { message: String(warning), time: '' }
    );
}

/** Owns warning disclosure state so simulation rerenders do not close a user's open panel. */
function RotationWarnings({
  initiallyOpen,
  warnings
}: {
  readonly initiallyOpen: boolean;
  readonly warnings: readonly NormalizedRotationWarning[];
}) {
  const [open, setOpen] = useState(initiallyOpen);
  if (!warnings.length) return null;
  return (
    <details className='rotation-warnings-wrap' open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Warnings ({warnings.length})</summary>
      <ul className='rotation-warnings-content'>
        {warnings.map((warning, index) => (
          <li key={`${warning.time}:${warning.message}:${index}`}>
            {warning.time ? <span className='rotation-warning-time'>{warning.time}</span> : null}
            <span className='rotation-warning-message'>{warning.message}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Renders rotation warnings into their stable React-owned container. */
export function mountRotationWarnings(
  container: HTMLElement | null | undefined,
  warnings: readonly (RotationWarning | string)[] = [],
  { open = false }: RotationWarningOptions = {}
): void {
  if (!container) return;
  renderReact(container, <RotationWarnings warnings={normalizeRotationWarnings(warnings)} initiallyOpen={open} />);
}
