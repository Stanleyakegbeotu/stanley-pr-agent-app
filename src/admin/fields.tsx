/**
 * Long text fields (owner, 2026-11-25): anything people write in their own
 * words (addresses, reasons, notes, descriptions, messages) is a multi-line
 * box, never a single line: Enter starts a new line like in chat, the box
 * grows with the text (up to about eight lines, then it scrolls), and it can
 * show what to write and how much room is left. Short facts (phone, hours,
 * amounts) stay single-line inputs.
 */
import { useEffect, useId, useRef, type TextareaHTMLAttributes } from 'react';
import { FieldErr, FieldLabel } from './prManage';

const LINE = 24; // px per line at the field's font size and line height

export function LongText({
  value,
  onChange,
  label,
  required,
  optional,
  hint,
  error,
  max,
  minRows = 3,
  maxRows = 8,
  placeholder,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  required?: boolean;
  optional?: boolean;
  /** What to write, shown under the box. */
  hint?: string;
  error?: string | null;
  /** Character limit; shows "120 of 300" when set. */
  max?: number;
  minRows?: number;
  maxRows?: number;
  placeholder?: string;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  // Grow with the text: reset, then fit the content (within the row limits).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const min = minRows * LINE + 26;
    const cap = maxRows * LINE + 26;
    el.style.height = `${Math.min(cap, Math.max(min, el.scrollHeight + 2))}px`;
    el.style.overflowY = el.scrollHeight + 2 > cap ? 'auto' : 'hidden';
  }, [value, minRows, maxRows]);
  const near = max != null && value.length > max * 0.85;
  return (
    <div>
      {label && (
        <label htmlFor={id}>
          <FieldLabel label={label} required={required} optional={optional} />
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(max != null ? e.target.value.slice(0, max) : e.target.value)}
        placeholder={placeholder}
        rows={minRows}
        enterKeyHint="enter"
        autoCapitalize="sentences"
        className={`block w-full resize-none rounded-2xl border-[1.5px] bg-white px-4 py-3 text-[15px] leading-6 text-ink outline-none ring-4 transition-[box-shadow,border-color] placeholder:text-faint ${error ? 'border-[#e5484d] ring-[#fde3e3]' : 'border-brand-500 ring-brand-100'}`}
        {...rest}
      />
      {(hint || max != null) && !error && (
        <span className="mt-1 flex items-start justify-between gap-3 text-[12px] leading-snug text-muted">
          <span>{hint}</span>
          {max != null && <span className={`shrink-0 tabular-nums ${near ? 'font-semibold text-warn-ink' : ''}`}>{`${value.length} of ${max}`}</span>}
        </span>
      )}
      <FieldErr msg={error} />
    </div>
  );
}
