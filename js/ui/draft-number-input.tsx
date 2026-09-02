import { useEffect, useState } from 'react';
import type { InputHTMLAttributes, Ref } from 'react';

export interface DraftNumberInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'onBlur'
> {
  readonly value: number;
  readonly onCommit: (draft: string) => number;
  readonly inputRef?: Ref<HTMLInputElement>;
}

/** Keeps numeric edits local until blur so typing does not trigger application work for every keystroke. */
export function DraftNumberInput({ value, onCommit, inputRef, ...props }: DraftNumberInputProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  return (
    <input
      {...props}
      ref={inputRef}
      type='number'
      value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => setDraft(String(onCommit(draft)))}
    />
  );
}
