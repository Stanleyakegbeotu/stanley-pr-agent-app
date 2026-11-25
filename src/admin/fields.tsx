/**
 * Long text fields (owner, 2026-11-25): anything people write in their own
 * words (addresses, reasons, notes, descriptions, messages) is a multi-line
 * box, never a single line: Enter starts a new line like in chat, the box
 * grows with the text (up to about eight lines, then it scrolls), and it can
 * show what to write and how much room is left. Short facts (phone, hours,
 * amounts) stay single-line inputs.
 */
import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { emailProblem, nameProblem, onlyEmail, onlyName, onlyPhone, phoneProblem, websiteProblem } from '@/ui/fieldRules';
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

/* ─────────────── fields that only accept what they are for ─────────────── */

export type RuleKind = 'phone' | 'email' | 'name' | 'website';
const RULES: Record<RuleKind, { clean: (v: string) => string; problem: (v: string, req: boolean) => string | null; type: string; inputMode: 'tel' | 'email' | 'text' | 'url'; autoComplete: string; placeholder: string; hint?: string }> = {
  phone: { clean: onlyPhone, problem: phoneProblem, type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '08031234567', hint: 'Numbers only. Start with 0, or + and the country code.' },
  email: { clean: onlyEmail, problem: emailProblem, type: 'email', inputMode: 'email', autoComplete: 'email', placeholder: 'name@gmail.com' },
  name: { clean: onlyName, problem: (v, req) => nameProblem(v, req), type: 'text', inputMode: 'text', autoComplete: 'name', placeholder: 'Full name' },
  website: { clean: (v) => v.replace(/\s/g, ''), problem: (v) => websiteProblem(v), type: 'url', inputMode: 'url', autoComplete: 'url', placeholder: 'example.com' },
};
/** The same check a form runs before saving. */
export const ruleProblem = (kind: RuleKind, v: string, required = false) => RULES[kind].problem(v, required);

/**
 * A single-line field with its own rules: it filters what can be typed
 * (letters never appear in a phone number), checks the value when you leave
 * the field or press save, and says what is wrong in one sentence.
 */
export function RuleInput({ kind, label, value, onChange, required, optional, hint, placeholder, showError, error, autoComplete, ...rest }: { kind: RuleKind; label?: string; value: string; onChange: (v: string) => void; required?: boolean; optional?: boolean; hint?: string; placeholder?: string; /** The form tried to save: show the problem even if the field wasn't visited. */ showError?: boolean; /** An extra problem from the form (e.g. already in use). */ error?: string | null; autoComplete?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const r = RULES[kind];
  const [touched, setTouched] = useState(false);
  const problem = error ?? ((touched || showError) && (value.trim() || showError) ? r.problem(value, !!required) : null);
  return (
    <div>
      {label && <FieldLabel label={label} required={required} optional={optional} />}
      <input
        type={r.type}
        inputMode={r.inputMode}
        autoComplete={autoComplete ?? r.autoComplete}
        autoCapitalize={kind === 'name' ? 'words' : 'off'}
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(kind === 'name' ? capitalise(r.clean(e.target.value)) : r.clean(e.target.value))}
        onBlur={() => setTouched(true)}
        placeholder={placeholder ?? r.placeholder}
        aria-invalid={!!problem}
        className={`min-h-12 w-full rounded-2xl border-[1.5px] bg-white px-4 text-[15px] text-ink outline-none ring-4 placeholder:text-faint ${problem ? 'border-[#e5484d] ring-[#fde3e3]' : 'border-brand-500 ring-brand-100'}`}
        {...rest}
      />
      {problem ? <FieldErr msg={problem} /> : (hint ?? r.hint) && <span className="mt-1 block text-[12px] text-muted">{hint ?? r.hint}</span>}
    </div>
  );
}
const capitalise = (v: string) => v.replace(/(^|[\s'’-])(\p{Ll})/gu, (_m, a: string, b: string) => a + b.toUpperCase());
