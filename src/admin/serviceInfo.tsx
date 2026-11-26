/**
 * Test information written in STANLEY (owner, 2026-11-26): when a service is
 * added (or later edited), the person can write what the test is, what it is
 * used for, how it is done (one step per line), how to prepare, the sample,
 * the usual time and keywords, in free text boxes that grow, where Enter
 * starts a new line (it never submits). The service's Test guide shows this
 * instead of the general guide. Kept on this device until the cloud.
 */
import { useState, useSyncExternalStore } from 'react';
import type { TestGuide } from '@company/data/serviceGuide';
import { LongText } from './fields';
import { FieldLabel, inputCls } from './prManage';

export interface ServiceInfo {
  about: string;
  usedFor: string;
  /** One step per line. */
  procedure: string[];
  preparation: string;
  sample: string;
  duration: string;
  keywords: string[];
  at: string;
  by?: string;
}

const KEY = 'stanley.service.info.v1';
const listeners = new Set<() => void>();
let cache: Record<number, ServiceInfo> = load();
function load(): Record<number, ServiceInfo> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<number, ServiceInfo>;
  } catch {
    return {};
  }
}
export function saveServiceInfo(id: number, info: Omit<ServiceInfo, 'at'>) {
  cache = { ...cache, [id]: { ...info, at: new Date().toISOString() } };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage full: this session only */
  }
  listeners.forEach((l) => l());
}
export function useServiceInfo(id: number): ServiceInfo | undefined {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => cache[id],
  );
}

/** The written information over the general guide (empty parts fall back to the guide). */
export function mergeGuide(general: TestGuide, own: ServiceInfo | undefined): TestGuide & { written: boolean } {
  if (!own) return { ...general, written: false };
  return {
    ...general,
    about: own.about || general.about,
    usedFor: own.usedFor || general.usedFor,
    procedure: own.procedure.length ? own.procedure : general.procedure,
    preparation: own.preparation || general.preparation,
    sample: own.sample || general.sample,
    duration: own.duration || general.duration,
    keywords: own.keywords.length ? own.keywords : general.keywords,
    written: true,
  };
}

export interface InfoDraft {
  about: string;
  usedFor: string;
  procedure: string;
  preparation: string;
  sample: string;
  duration: string;
  keywords: string;
}
export const draftOf = (i?: ServiceInfo): InfoDraft => ({ about: i?.about ?? '', usedFor: i?.usedFor ?? '', procedure: (i?.procedure ?? []).join('\n'), preparation: i?.preparation ?? '', sample: i?.sample ?? '', duration: i?.duration ?? '', keywords: (i?.keywords ?? []).join(', ') });
export const infoFromDraft = (d: InfoDraft, by?: string): Omit<ServiceInfo, 'at'> => ({
  about: d.about.trim(),
  usedFor: d.usedFor.trim(),
  procedure: d.procedure
    .split('\n')
    .map((x) => x.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim())
    .filter(Boolean),
  preparation: d.preparation.trim(),
  sample: d.sample.trim(),
  duration: d.duration.trim(),
  keywords: d.keywords
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean),
  by,
});
export const draftHasContent = (d: InfoDraft) => Object.values(d).some((v) => v.trim());

/** The information fields (Add service and Edit test information). */
export function InfoFields({ d, set }: { d: InfoDraft; set: (d: InfoDraft) => void }) {
  const steps = d.procedure.split('\n').filter((x) => x.trim());
  const [preview, setPreview] = useState(false);
  const up = (k: keyof InfoDraft) => (v: string) => set({ ...d, [k]: v });
  return (
    <div className="space-y-4">
      <LongText label="What the test is" optional value={d.about} onChange={up('about')} max={400} minRows={2} placeholder={'For example: measures the amount of vitamin D in the blood.\nPress Enter for a new line.'} hint="One or two plain sentences for staff and PR agents." />
      <LongText label="What it is used for" optional value={d.usedFor} onChange={up('usedFor')} max={400} minRows={2} placeholder="For example: checks for vitamin D deficiency in bone pain or tiredness." />
      <div>
        <LongText label="How it is done" optional value={d.procedure} onChange={up('procedure')} max={1200} minRows={4} maxRows={12} placeholder={'One step per line, for example:\nThe patient gives the referral ID at the front desk and pays.\nA small blood sample is taken from the arm.\nThe sample goes to the laboratory.'} hint={steps.length ? `${steps.length} step${steps.length === 1 ? '' : 's'}. Each new line is a new step.` : 'Each new line becomes a numbered step.'} />
        {steps.length > 0 && (
          <button type="button" onClick={() => setPreview((p) => !p)} className="press mt-1.5 text-[12.5px] font-semibold text-brand-600">
            {preview ? 'Hide preview' : 'Preview the steps'}
          </button>
        )}
        {preview && steps.length > 0 && (
          <ol className="drop-down mt-2 list-decimal space-y-1 rounded-2xl bg-page py-3 pl-8 pr-3 text-[13.5px] text-ink">
            {steps.map((x, i) => (
              <li key={i}>{x.replace(/^\s*(\d+[.)]|[-•*])\s*/, '')}</li>
            ))}
          </ol>
        )}
      </div>
      <LongText label="How to prepare" optional value={d.preparation} onChange={up('preparation')} max={600} minRows={2} placeholder={'For example: no fasting needed.\nBring any previous results.'} />
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <FieldLabel label="Sample or test" optional />
          <input value={d.sample} onChange={(e) => up('sample')(e.target.value.slice(0, 60))} placeholder="Blood (serum)" className={inputCls()} />
        </label>
        <label className="block">
          <FieldLabel label="Usual time" optional />
          <input value={d.duration} onChange={(e) => up('duration')(e.target.value.slice(0, 60))} placeholder="Same day, 48 hours" className={inputCls()} />
        </label>
      </div>
      <LongText label="Keywords" optional value={d.keywords} onChange={up('keywords')} max={300} minRows={2} placeholder="Words people search with, separated by commas: vitamin d, bones, tiredness" hint="Helps staff and PR agents find this test." />
    </div>
  );
}
