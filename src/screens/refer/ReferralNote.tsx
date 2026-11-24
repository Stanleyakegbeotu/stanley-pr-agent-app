/**
 * Note for the branch (owner, 2026-11-24): while referring, the agent can
 * OPTIONALLY type a short note and/or record a voice note, so the front desk
 * or manager knows the situation (an emergency, the patient is on the way...).
 * Both are attached to the referral and shown on its details.
 */
import { useEffect, useState } from 'react';
import { Mic, Pause, Send, StickyNote, Trash2 } from 'lucide-react';
import { useApp } from '@/app/store';
import { fmtDuration } from '@/domain/chat';
import { DRAFT_VOICE, deleteVoice, saveVoice, useVoice } from '@/domain/referralVoice';
import { AudioNote, useBlobUrl } from '@/screens/chat/ChatThread';
import { useVoiceRecorder } from '@/screens/chat/useVoiceRecorder';
import { Card, inputClass } from '@/ui/kit';

const MAX = 300;
const QUICK = ['Emergency, please attend to the patient quickly.', 'The patient is on the way now.', 'The patient is coming tomorrow.', 'Elderly patient, may need help moving around.', 'Please call me when the patient arrives.'];
const QUICK_LABEL = ['🚨 Emergency', '🚗 On the way now', '📅 Coming tomorrow', '🧓 Elderly patient', '📞 Call me on arrival'];

/** Summary step: type a note, tap a quick phrase, or record a voice note. */
export function ReferralNoteEditor() {
  const { draft, setDraft, showToast } = useApp();
  const note = draft.note ?? '';
  const voice = useVoice(DRAFT_VOICE);
  const rec = useVoiceRecorder();
  const voiceUrl = useBlobUrl(voice?.blob);

  // Keep the draft's "has a voice note" flag in step with what's stored.
  useEffect(() => {
    const has = voice ? { duration: voice.duration } : undefined;
    if ((draft.voiceNote?.duration ?? null) !== (has?.duration ?? null)) setDraft((d) => ({ ...d, voiceNote: has }));
  }, [voice]); // eslint-disable-line react-hooks/exhaustive-deps

  const setNote = (t: string) => setDraft((d) => ({ ...d, note: t.slice(0, MAX) }));
  const addQuick = (q: string) => {
    if (note.includes(q)) return;
    setNote(note.trim() ? `${note.trim()} ${q}` : q);
  };
  const start = async () => {
    try {
      await rec.start();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t start recording.');
    }
  };
  const done = async () => {
    const r = await rec.finish();
    if (r) await saveVoice(DRAFT_VOICE, { blob: r.blob, duration: r.duration }).catch(() => showToast('Couldn’t save the voice note on this phone.'));
  };

  return (
    <Card className="mb-3.5 p-5">
      <h2 className="flex items-center gap-2.5 text-[18px] font-bold text-ink">
        <StickyNote size={21} className="text-brand-600" /> Note for the branch
        <span className="text-[14px] font-normal text-muted">(optional)</span>
      </h2>
      <p className="mb-3 mt-1 text-[13.5px] leading-snug text-muted">Tell the front desk or manager anything they should know, like an emergency or that the patient is on the way.</p>

      <div className="mb-2.5 flex flex-wrap gap-2">
        {QUICK.map((q, i) => (
          <button key={q} type="button" onClick={() => addQuick(q)} aria-pressed={note.includes(q)} className={`press rounded-full px-3 py-1.5 text-[13px] font-medium ${note.includes(q) ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700'}`}>
            {QUICK_LABEL[i]}
          </button>
        ))}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Type a short note..." aria-label="Note for the branch" className={`${inputClass()} resize-none py-3 leading-snug`} />
      <p className="mt-1 text-right text-[12px] text-muted">
        {note.length}/{MAX}
      </p>

      {/* Voice note */}
      <div className="mt-2">
        {rec.state !== 'idle' ? (
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={rec.cancel} aria-label="Delete recording" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#e5484d]">
              <Trash2 size={20} />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full bg-page px-3.5 py-2.5 ring-1 ring-line">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full bg-[#e5484d] ${rec.state === 'recording' ? 'animate-pulse' : 'opacity-40'}`} />
              <span className="w-10 shrink-0 text-[14px] font-semibold tabular-nums text-ink">{fmtDuration(rec.seconds)}</span>
              <span className="flex h-6 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden">
                {(rec.levels.length ? rec.levels : [0.1]).map((l, i) => (
                  <span key={i} className="w-[3px] shrink-0 rounded-full bg-brand-500" style={{ height: `${Math.max(3, Math.round(l * 24))}px` }} />
                ))}
              </span>
            </div>
            <button type="button" onClick={rec.state === 'recording' ? rec.pause : rec.resume} aria-label={rec.state === 'recording' ? 'Pause recording' : 'Resume recording'} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#e5484d] shadow-sm ring-1 ring-line">
              {rec.state === 'recording' ? <Pause size={18} fill="currentColor" /> : <Mic size={19} />}
            </button>
            <button type="button" onClick={() => void done()} aria-label="Attach voice note" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-600 text-white shadow-[0_8px_18px_rgba(31,111,232,0.35)]">
              <Send size={18} />
            </button>
          </div>
        ) : voice && voiceUrl ? (
          <div className="flex items-center gap-2 rounded-2xl bg-[#d9eaff] px-3 py-2">
            <div className="min-w-0 flex-1">
              <AudioNote url={voiceUrl} seed="referral-draft" duration={voice.duration} />
            </div>
            <button type="button" onClick={() => void deleteVoice(DRAFT_VOICE)} aria-label="Remove voice note" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#d93036] hover:bg-white/60">
              <Trash2 size={19} />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => void start()} className="press flex w-full items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-brand-300 bg-brand-50/50 px-4 py-3 text-left">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
              <Mic size={19} />
            </span>
            <span>
              <span className="block text-[15px] font-semibold text-ink">Record a voice note</span>
              <span className="block text-[12.5px] text-muted">Tap once to start. You can pause, delete or attach it.</span>
            </span>
          </button>
        )}
      </div>
    </Card>
  );
}

/** Referral details: the note and voice note the agent attached. */
export function ReferralNoteView({ id, note, voiceNote }: { id: string; note?: string; voiceNote?: { duration: number } }) {
  const voice = useVoice(id);
  const url = useBlobUrl(voice?.blob);
  if (!note && !voiceNote) return null;
  return (
    <Card className="mb-3.5 p-5">
      <h2 className="mb-2 flex items-center gap-2.5 text-[17px] font-bold text-ink">
        <StickyNote size={19} className="text-brand-600" /> Your note to the branch
      </h2>
      {note && <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-2">{note}</p>}
      {voiceNote &&
        (url && voice ? (
          <div className="mt-3 rounded-2xl bg-[#d9eaff] px-3 py-2">
            <AudioNote url={url} seed={`referral-${id}`} duration={voice.duration} />
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-muted">🎤 Voice note ({fmtDuration(voiceNote.duration)}) attached.</p>
        ))}
    </Card>
  );
}
