/**
 * Chat (owner, 2026-11-23): WhatsApp-style conversation with the branch team
 * (the Front Desk person on duty, the Branch Manager, or the Admin).
 *  • Fixed header: who you're chatting with, their role, chat info/settings.
 *  • Fixed typing bar: Enter makes a NEW LINE (sending is the send button),
 *    emojis, attachments (photos/videos, camera, receipts/documents), and
 *    voice notes — one tap starts recording; pause/resume, delete or send.
 *  • Messages: swipe right to reply; press and hold (or right-click) for
 *    Reply · Copy · Delete; tap a photo to view it (media is never saved to the gallery);
 *    voice notes play with a waveform and speed control.
 * Offline-first: everything is saved on the phone (single tick) and delivered
 * when the cloud connection is available.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { ArrowLeft, BellOff, Users, Camera, Check, ChevronDown, Copy, FileText, Image as ImageIcon, Info, Mic, MoreVertical, Pause, Play, Paperclip, Reply, Send, Smile, Trash2, X } from 'lucide-react';
import { conversationById, type Conversation } from '@/data/team';
import { chatSettings, fmtDuration, fmtSize, markRead, previewOf, saveChatSettings, useChat, type ChatMsg, type MsgKind, type ReplyRef } from '@/domain/chat';
import { useNav } from '@/app/store';
import { EmptyState, ScreenHeader } from '@/ui/kit';
import { ConvAvatar, PersonAvatar } from '@/ui/avatars';
import { useVoiceRecorder } from './useVoiceRecorder';
import { useViewOnly } from '@/ui/privacy';

/* ─────────────── helpers ─────────────── */
export function useBlobUrl(blob?: Blob) {
  // Created inside the effect so a remount (React dev double-mount) never keeps a revoked link.
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return setUrl(undefined);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
function dayOf(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}
const kindOf = (f: File): MsgKind => (f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : 'file');
/** A stable fake waveform for a voice note (same shape every time). */
function bars(seed: string, n = 34) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  // Unsigned maths so every bar has a positive height (signed shifts made some notes look flat).
  return Array.from({ length: n }, (_, i) => 0.25 + ((((h >>> i % 24) ^ (i * 7919)) >>> 0) % 100) / 140);
}

const EMOJI: { label: string; list: string[] }[] = [
  { label: '😀', list: '😀 😃 😄 😁 😆 😅 😂 🤣 😊 🙂 😉 😍 🥰 😘 😋 😎 🤩 🥳 🤗 🤔 🤭 😐 😴 😌 😔 😢 😭 😤 😡 😱 😷 🤒 🤕 🥴 😇 🙏'.split(' ') },
  { label: '👍', list: '👍 👎 👌 ✌️ 🤞 👏 🙌 👋 🤝 💪 🙏 👀 ✋ ☝️ 👉 👈 🫡 🤲'.split(' ') },
  { label: '❤️', list: '❤️ 🧡 💛 💚 💙 💜 🤍 💯 ✅ ❌ ⭐ 🔥 🎉 🎊 ✨ 💡 ⏰ 📌'.split(' ') },
  { label: '🩺', list: '🩺 💊 💉 🩸 🧪 🔬 🏥 🚑 🩻 🦴 🧠 🫀 🫁 👨🏾‍⚕️ 👩🏾‍⚕️ 📋 📄 🧾 💰 💵 📞 📍 🗓️'.split(' ') },
];

/* ─────────────── screen ─────────────── */

export function ChatThread({ id }: { id: string }) {
  const { back, showToast } = useNav();
  const conv = conversationById(id);
  const { messages, send, remove, clear } = useChat(id);
  const [reply, setReply] = useState<ReplyRef | null>(null);
  const [menuFor, setMenuFor] = useState<ChatMsg | null>(null);
  const [viewer, setViewer] = useState<ChatMsg | null>(null);
  const [info, setInfo] = useState(false);
  const [muted, setMuted] = useState(() => chatSettings(id).muted);
  const end = useRef<HTMLDivElement>(null);
  const [barH, setBarH] = useState(76);

  // Keep the newest message in view.
  useLayoutEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);
  // Opening the chat reads it (clears its unread count on the Inbox icon).
  useEffect(() => {
    markRead(id);
  }, [id, messages.length]);

  if (!conv)
    return (
      <>
        <ScreenHeader title="Messages" />
        <EmptyState sticker="speech" title="Conversation not found" text="It may have been closed." />
      </>
    );

  const replyRef = (m: ChatMsg): ReplyRef => ({ id: m.id, from: m.from, sender: m.from === 'them' ? (m.sender ?? conv.name) : undefined, kind: m.kind, preview: previewOf(m).slice(0, 90) });

  return (
    <div className="-mx-5 md:-mx-8">
      {/* Fixed header */}
      <header className="sticky top-0 z-30 flex min-h-16 items-center gap-2 border-b border-line bg-white/95 px-2 pt-[var(--safe-top)] backdrop-blur-xl">
        <button type="button" onClick={back} aria-label="Back" className="press grid h-11 w-11 place-items-center rounded-full text-ink">
          <ArrowLeft size={23} />
        </button>
        <button type="button" onClick={() => setInfo(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Chat info">
          <ConvAvatar conv={conv} size={42} />
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-bold text-ink">{conv.name}</span>
            <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted">
              {muted && <BellOff size={12} className="shrink-0" />}
              <span className="truncate">{conv.role}</span>
            </span>
          </span>
        </button>
        <button type="button" onClick={() => setInfo(true)} aria-label="Chat settings" className="press grid h-11 w-11 place-items-center rounded-full text-ink-2">
          <MoreVertical size={21} />
        </button>
      </header>

      {/* Messages */}
      <div className="min-h-[calc(100dvh-4rem)] bg-[radial-gradient(circle_at_1px_1px,#dfe7f3_1px,transparent_0)] bg-[length:22px_22px] px-3 pt-3" style={{ paddingBottom: barH + 16 }}>
        <p className="mx-auto mb-3 max-w-xs rounded-xl bg-[#fff6dc] px-3 py-2 text-center text-[12px] leading-snug text-[#7a5b12] shadow-sm">🔒 Encrypted on this phone. For logistics only.</p>
        <p className="mx-auto mb-3 max-w-sm rounded-xl bg-[#fdecec] px-3 py-2 text-center text-[12px] font-medium leading-snug text-[#7a271a] shadow-sm">{id.startsWith('adm-') ? 'Don’t send patient results or ID photos here. Patient records stay in STANLEY.' : 'Don’t send patient results, request forms or ID photos here. Use the request and Results sections.'}</p>
        {messages.length === 0 && (
          <div className="mx-auto mt-10 flex max-w-xs flex-col items-center rounded-3xl bg-white/90 px-5 py-6 text-center shadow-sm">
            <ConvAvatar conv={conv} size={64} />
            <p className="mt-3 text-[16px] font-bold text-ink">Say hello to {conv.shared ? 'the front desk' : conv.name.split(' ')[0]}</p>
            <p className="mt-1 text-[13.5px] leading-snug text-muted">{conv.shared ? 'Whoever is on shift at the front desk will reply here.' : 'Send a message, photo, document or voice note.'}</p>
          </div>
        )}
        {messages.map((m, i) => {
          const showDay = i === 0 || dayOf(messages[i - 1]!.at) !== dayOf(m.at);
          return (
            <div key={m.id}>
              {showDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-lg bg-white/90 px-3 py-1 text-[12px] font-medium text-ink-2 shadow-sm">{dayOf(m.at)}</span>
                </div>
              )}
              <Bubble m={m} convName={conv.name} showSender={conv.shared} onReply={() => setReply(replyRef(m))} onMenu={() => setMenuFor(m)} onOpenImage={() => setViewer(m)} />
            </div>
          );
        })}
        <div ref={end} />
      </div>

      <Composer
        reply={reply}
        convName={conv.name}
        onCancelReply={() => setReply(null)}
        onHeight={setBarH}
        onSend={async (m) => {
          await send({ ...m, replyTo: reply ?? undefined });
          setReply(null);
        }}
        onError={showToast}
      />

      {menuFor && (
        <ActionSheet
          m={menuFor}
          onClose={() => setMenuFor(null)}
          onReply={() => (setReply(replyRef(menuFor)), setMenuFor(null))}
          onCopy={async () => {
            try {
              await navigator.clipboard.writeText(menuFor.text ?? '');
              showToast('Message copied');
            } catch {
              showToast('Couldn’t copy on this device');
            }
            setMenuFor(null);
          }}
          onDelete={async () => {
            await remove(menuFor.id);
            setMenuFor(null);
            showToast('Message deleted');
          }}
        />
      )}
      {viewer && <ImageViewer m={viewer} onClose={() => setViewer(null)} />}
      {info && (
        <ChatInfo
          conv={conv}
          muted={muted}
          media={messages.filter((m) => !m.deleted && m.blob && (m.kind === 'image' || m.kind === 'video')).length}
          onMute={(v) => {
            setMuted(v);
            saveChatSettings(id, { muted: v });
            showToast(v ? 'Notifications muted for this chat' : 'Notifications on');
          }}
          onClear={async () => {
            await clear();
            setInfo(false);
            showToast('Chat cleared on this phone');
          }}
          onClose={() => setInfo(false)}
        />
      )}
    </div>
  );
}

/* ─────────────── message bubble ─────────────── */

const SENDER_TINTS = ['text-[#d6336c]', 'text-[#0c8599]', 'text-[#7048e8]', 'text-[#e8590c]', 'text-[#2f9e44]'];
const senderTint = (name: string) => SENDER_TINTS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % SENDER_TINTS.length];

function Bubble({ m, convName, showSender, onReply, onMenu, onOpenImage }: { m: ChatMsg; convName: string; showSender: boolean; onReply: () => void; onMenu: () => void; onOpenImage: () => void }) {
  const mine = m.from === 'me';
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);
  const hold = useRef(0);

  const down = (e: RPointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    swiping.current = false;
    window.clearTimeout(hold.current);
    hold.current = window.setTimeout(() => {
      if (!swiping.current) onMenu();
    }, 480);
  };
  const move = (e: RPointerEvent) => {
    if (!start.current) return;
    const x = e.clientX - start.current.x;
    const y = e.clientY - start.current.y;
    if (Math.abs(x) > 8 || Math.abs(y) > 8) window.clearTimeout(hold.current);
    if (!swiping.current && x > 12 && Math.abs(x) > Math.abs(y) * 1.4) swiping.current = true;
    if (swiping.current) setDx(Math.max(0, Math.min(84, x)));
  };
  const up = () => {
    window.clearTimeout(hold.current);
    if (swiping.current && dx > 56 && !m.deleted) onReply();
    start.current = null;
    swiping.current = false;
    setDx(0);
  };

  return (
    <div className={`relative mb-1.5 flex items-start gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
      <span className="pointer-events-none absolute left-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white text-brand-600 shadow" style={{ opacity: Math.min(1, dx / 56), transform: `translateY(-50%) scale(${0.6 + Math.min(0.4, dx / 140)})` }}>
        <Reply size={16} />
      </span>
      {/* Always-visible actions button (owner): Reply · Copy · Delete without needing a long press. */}
      <button
        type="button"
        onClick={onMenu}
        aria-label="Message actions"
        title="Reply or delete"
        className={`press mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-2/70 transition hover:bg-white hover:text-ink hover:shadow-sm active:bg-white ${mine ? 'order-first' : 'order-last'}`}
        style={{ opacity: dx ? 0 : 1 }}
      >
        <MoreVertical size={17} />
      </button>
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onContextMenu={(e) => (e.preventDefault(), onMenu())}
        className={`relative max-w-[82%] select-none rounded-[18px] px-2.5 pb-1.5 pt-1.5 text-[15px] leading-snug shadow-[0_1px_2px_rgba(11,23,48,0.12)] ${mine ? 'rounded-br-[6px] bg-[#d9eaff] text-ink' : 'rounded-bl-[6px] bg-white text-ink'}`}
        style={{ transform: `translateX(${dx}px)`, transition: dx ? 'none' : 'transform 200ms ease', touchAction: 'pan-y' }}
      >
        {showSender && !mine && m.sender && <p className={`px-1 pb-0.5 text-[12.5px] font-semibold ${senderTint(m.sender)}`}>{m.sender}</p>}
        {m.replyTo && !m.deleted && (
          <div className={`mb-1.5 rounded-lg border-l-4 px-2.5 py-1.5 text-[13px] ${m.replyTo.from === 'me' ? 'border-brand-600 bg-brand-600/10' : 'border-violet bg-violet/10'}`}>
            <p className={`text-[12px] font-semibold ${m.replyTo.from === 'me' ? 'text-brand-700' : 'text-violet'}`}>{m.replyTo.from === 'me' ? 'You' : (m.replyTo.sender ?? convName)}</p>
            <p className="line-clamp-2 text-ink-2">{m.replyTo.preview}</p>
          </div>
        )}
        {m.deleted ? (
          <p className="px-1 italic text-muted">🚫 {mine ? 'You deleted this message' : 'This message was deleted'}</p>
        ) : (
          <Body m={m} onOpenImage={onOpenImage} />
        )}
        <span className="float-right ml-2 mt-1 flex items-center gap-1 text-[11px] text-muted">
          {timeOf(m.at)}
          {mine && !m.deleted && (m.status === 'delivered' ? <span className="text-brand-600">✓✓</span> : <Check size={13} aria-label="Saved on this phone, waiting to be delivered" />)}
        </span>
      </div>
    </div>
  );
}

function Body({ m, onOpenImage }: { m: ChatMsg; onOpenImage: () => void }) {
  const url = useBlobUrl(m.blob);
  if (m.kind === 'image' && url)
    return (
      <>
        <button type="button" onClick={onOpenImage} className="block overflow-hidden rounded-xl">
          <img src={url} alt="" className="max-h-72 w-[240px] max-w-full object-cover" />
        </button>
        {m.text && <p className="mt-1.5 whitespace-pre-wrap break-words px-1">{m.text}</p>}
      </>
    );
  if (m.kind === 'video' && url)
    return (
      <>
        <video src={url} controls playsInline preload="metadata" className="max-h-72 w-[260px] max-w-full rounded-xl bg-black" />
        {m.text && <p className="mt-1.5 whitespace-pre-wrap break-words px-1">{m.text}</p>}
      </>
    );
  if (m.kind === 'file')
    return (
      <>
        <div className="flex w-[240px] max-w-full items-center gap-3 rounded-xl bg-white/70 p-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#ffe9e2] text-[#d9480f]">
            <FileText size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold">{m.fileName}</span>
            <span className="text-[12px] text-muted">{fmtSize(m.size)}</span>
          </span>
        </div>
        {m.text && <p className="mt-1.5 whitespace-pre-wrap break-words px-1">{m.text}</p>}
      </>
    );
  if (m.kind === 'audio' && url) return <AudioNote url={url} seed={m.id} duration={m.duration ?? 0} />;
  return <p className="whitespace-pre-wrap break-words px-1">{m.text}</p>;
}

/** Voice-note player: play/pause, waveform progress, time, speed. */
export function AudioNote({ url, seed, duration }: { url: string; seed: string; duration: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [rate, setRate] = useState(1);
  const wave = useMemo(() => bars(seed), [seed]);
  const total = duration || audio.current?.duration || 0;
  const progress = total ? Math.min(1, t / total) : 0;
  return (
    <div className="flex w-[250px] max-w-full items-center gap-2.5 py-0.5">
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setT(0);
        }}
      />
      <button
        type="button"
        onClick={() => {
          const a = audio.current!;
          if (playing) a.pause();
          else void a.play();
          setPlaying(!playing);
        }}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-600 text-white"
      >
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className="flex h-7 cursor-pointer items-center gap-[2px]"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            if (audio.current && total) audio.current.currentTime = ((e.clientX - r.left) / r.width) * total;
          }}
        >
          {wave.map((h, i) => (
            <span key={i} className={`w-[3px] rounded-full ${i / wave.length <= progress ? 'bg-brand-600' : 'bg-[#a9bfdc]'}`} style={{ height: `${Math.round(h * 26)}px` }} />
          ))}
        </div>
        <p className="text-[11.5px] text-muted">{fmtDuration(playing || t ? t : total)}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
          setRate(next);
          if (audio.current) audio.current.playbackRate = next;
        }}
        className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[11.5px] font-bold text-ink-2"
        aria-label="Playback speed"
      >
        {rate}×
      </button>
    </div>
  );
}

/* ─────────────── typing bar ─────────────── */

interface Outgoing {
  kind: MsgKind;
  text?: string;
  blob?: Blob;
  fileName?: string;
  mime?: string;
  size?: number;
  duration?: number;
}

function Composer({ reply, convName, onCancelReply, onSend, onHeight, onError }: { reply: ReplyRef | null; convName: string; onCancelReply: () => void; onSend: (m: Outgoing) => Promise<void>; onHeight: (h: number) => void; onError: (t: string) => void }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [emoji, setEmoji] = useState(false);
  const [attach, setAttach] = useState(false);
  const [tab, setTab] = useState(0);
  const box = useRef<HTMLTextAreaElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const docs = useRef<HTMLInputElement>(null);
  const rec = useVoiceRecorder();

  // Grow the text box with its content (up to ~6 lines); report the bar height so messages stay above it.
  useLayoutEffect(() => {
    const el = box.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    }
  }, [text]);
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight]);

  const canSend = text.trim().length > 0 || files.length > 0;
  const send = async () => {
    if (!canSend) return;
    const caption = text.trim();
    if (files.length) {
      for (let i = 0; i < files.length; i++) {
        const f = files[i]!;
        await onSend({ kind: kindOf(f), blob: f, fileName: f.name, mime: f.type, size: f.size, text: i === 0 ? caption || undefined : undefined });
      }
    } else await onSend({ kind: 'text', text: caption });
    setText('');
    setFiles([]);
    setEmoji(false);
  };
  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const ok = [...list].filter((f) => f.size <= 50 * 1024 * 1024);
    if (ok.length < list.length) onError('Files over 50 MB can’t be sent.');
    setFiles((x) => [...x, ...ok].slice(0, 10));
    setAttach(false);
  };
  const insertEmoji = (e: string) => {
    const el = box.current;
    const at = el?.selectionStart ?? text.length;
    setText((t) => t.slice(0, at) + e + t.slice(el?.selectionEnd ?? at));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + e.length, at + e.length);
    });
  };
  const startVoice = async () => {
    try {
      setEmoji(false);
      setAttach(false);
      await rec.start();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Couldn’t start recording.');
    }
  };
  const sendVoice = async () => {
    const r = await rec.finish();
    if (r) await onSend({ kind: 'audio', blob: r.blob, mime: r.blob.type, size: r.blob.size, duration: r.duration });
  };

  return (
    <div ref={bar} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[#f7f9fd]/97 pb-[max(10px,var(--safe-bottom))] pt-2 backdrop-blur-xl md:left-[264px]">
      {/* Reply preview */}
      {reply && rec.state === 'idle' && (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-xl border-l-4 border-brand-600 bg-white px-3 py-2 shadow-sm">
          <Reply size={16} className="mt-0.5 shrink-0 text-brand-600" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-brand-700">Replying to {reply.from === 'me' ? 'yourself' : (reply.sender ?? convName)}</p>
            <p className="truncate text-[13px] text-ink-2">{reply.preview}</p>
          </div>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply" className="text-muted">
            <X size={18} />
          </button>
        </div>
      )}
      {/* Chosen attachments */}
      {files.length > 0 && rec.state === 'idle' && (
        <div className="mx-3 mb-2 flex gap-2 overflow-x-auto">
          {files.map((f, i) => (
            <FileChip key={`${f.name}-${i}`} f={f} onRemove={() => setFiles((x) => x.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}

      {rec.state !== 'idle' ? (
        /* Recording a voice note */
        <div className="mx-3 flex items-center gap-2.5">
          <button type="button" onClick={rec.cancel} aria-label="Delete recording" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#e5484d]">
            <Trash2 size={21} />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full bg-white px-3.5 py-2.5 shadow-sm ring-1 ring-line">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full bg-[#e5484d] ${rec.state === 'recording' ? 'animate-pulse' : 'opacity-40'}`} />
            <span className="w-11 shrink-0 text-[14px] font-semibold tabular-nums text-ink">{fmtDuration(rec.seconds)}</span>
            <span className="flex h-6 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden">
              {(rec.levels.length ? rec.levels : [0.1]).map((l, i) => (
                <span key={i} className="w-[3px] shrink-0 rounded-full bg-brand-500" style={{ height: `${Math.max(3, Math.round(l * 24))}px` }} />
              ))}
            </span>
            <span className="shrink-0 text-[11.5px] text-muted">{rec.state === 'paused' ? 'Paused' : 'Recording'}</span>
          </div>
          <button type="button" onClick={rec.state === 'recording' ? rec.pause : rec.resume} aria-label={rec.state === 'recording' ? 'Pause recording' : 'Resume recording'} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#e5484d] shadow-sm ring-1 ring-line">
            {rec.state === 'recording' ? <Pause size={19} fill="currentColor" /> : <Mic size={20} />}
          </button>
          <button type="button" onClick={() => void sendVoice()} aria-label="Send voice note" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-600 text-white shadow-[0_8px_18px_rgba(31,111,232,0.35)]">
            <Send size={19} />
          </button>
        </div>
      ) : (
        <div className="mx-3 flex items-end gap-2">
          <div className="flex min-w-0 flex-1 items-end rounded-[24px] bg-white shadow-sm ring-1 ring-line">
            <button type="button" onClick={() => (setEmoji((v) => !v), setAttach(false))} aria-label="Emojis" aria-pressed={emoji} className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${emoji ? 'text-brand-600' : 'text-ink-2'}`}>
              {emoji ? <ChevronDown size={22} /> : <Smile size={22} />}
            </button>
            <textarea
              ref={box}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setEmoji(false)}
              placeholder="Message"
              aria-label="Message"
              enterKeyHint="enter"
              className="max-h-[140px] min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[15.5px] leading-snug text-ink outline-none"
            />
            <div className="relative">
              <button type="button" onClick={() => (setAttach((v) => !v), setEmoji(false))} aria-label="Attach" aria-expanded={attach} className="grid h-11 w-11 place-items-center rounded-full text-ink-2">
                <Paperclip size={21} />
              </button>
              {attach && (
                <div className="absolute bottom-12 right-0 z-10 grid w-[230px] gap-1 rounded-2xl bg-white p-2 shadow-[0_18px_40px_rgba(11,23,48,0.2)] ring-1 ring-line">
                  <AttachItem icon={<ImageIcon size={19} />} tone="bg-[#efe7ff] text-violet" label="Photos & videos" onClick={() => gallery.current?.click()} />
                  <AttachItem icon={<Camera size={19} />} tone="bg-[#ffe7ee] text-[#d6336c]" label="Camera" onClick={() => camera.current?.click()} />
                  <AttachItem icon={<FileText size={19} />} tone="bg-[#e7f1ff] text-brand-600" label="Receipt or document" onClick={() => docs.current?.click()} />
                </div>
              )}
            </div>
          </div>
          {canSend ? (
            <button type="button" onClick={() => void send()} aria-label="Send" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-600 text-white shadow-[0_8px_18px_rgba(31,111,232,0.35)]">
              <Send size={19} />
            </button>
          ) : (
            <button type="button" onClick={() => void startVoice()} aria-label="Record a voice note" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-600 text-white shadow-[0_8px_18px_rgba(31,111,232,0.35)]">
              <Mic size={21} />
            </button>
          )}
        </div>
      )}

      {emoji && rec.state === 'idle' && (
        <div className="mx-3 mt-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-line">
          <div className="mb-1 flex gap-1 border-b border-line pb-1">
            {EMOJI.map((g, i) => (
              <button key={g.label} type="button" onClick={() => setTab(i)} className={`rounded-lg px-3 py-1 text-[18px] ${tab === i ? 'bg-brand-50' : ''}`} aria-pressed={tab === i}>
                {g.label}
              </button>
            ))}
          </div>
          <div className="grid max-h-44 grid-cols-8 gap-1 overflow-y-auto">
            {EMOJI[tab]!.list.map((e) => (
              <button key={e} type="button" onClick={() => insertEmoji(e)} className="press grid h-10 place-items-center rounded-lg text-[24px] hover:bg-page" aria-label={`Insert ${e}`}>
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      <input ref={gallery} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
      <input ref={docs} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
    </div>
  );
}

function AttachItem({ icon, tone, label, onClick }: { icon: React.ReactNode; tone: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press flex items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[14.5px] font-medium text-ink hover:bg-page">
      <span className={`grid h-9 w-9 place-items-center rounded-full ${tone}`}>{icon}</span>
      {label}
    </button>
  );
}

function FileChip({ f, onRemove }: { f: File; onRemove: () => void }) {
  const url = useBlobUrl(f.type.startsWith('image/') ? f : undefined);
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-line">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center p-1 text-center text-[10px] leading-tight text-ink-2">{f.type.startsWith('video/') ? '🎥' : '📄'} {f.name.slice(0, 14)}</span>}
      <button type="button" onClick={onRemove} aria-label={`Remove ${f.name}`} className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-ink/70 text-white">
        <X size={12} />
      </button>
    </div>
  );
}

/* ─────────────── sheets ─────────────── */

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div data-slide-layer className="fade-in fixed inset-0 z-[70] flex items-end justify-center bg-[#0b1730]/40 md:items-center" onClick={onClose}>
      <div data-sheet-panel className="sheet-up w-full max-w-md rounded-t-[26px] bg-white p-3 pb-[max(14px,var(--safe-bottom))] shadow-2xl md:rounded-[26px]" onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto mb-2 block h-1.5 w-10 rounded-full bg-line md:hidden" />
        {children}
      </div>
    </div>
  );
}

function ActionSheet({ m, onClose, onReply, onCopy, onDelete }: { m: ChatMsg; onClose: () => void; onReply: () => void; onCopy: () => void; onDelete: () => void }) {
  const viewOnly = useViewOnly();
  const [confirm, setConfirm] = useState(false);
  const row = (icon: React.ReactNode, label: string, onClick: () => void, danger = false) => (
    <button type="button" onClick={onClick} className={`press flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-left text-[15.5px] font-medium hover:bg-page ${danger ? 'text-[#d93036]' : 'text-ink'}`}>
      {icon}
      {label}
    </button>
  );
  return (
    <Sheet onClose={onClose}>
      <p className="mb-1 truncate px-3 text-[13px] text-muted">{m.deleted ? 'Deleted message' : previewOf(m)}</p>
      {confirm ? (
        <>
          <p className="px-3 py-2 text-[15px] text-ink">Delete this message from this phone?</p>
          {row(<Trash2 size={20} />, 'Delete for me', onDelete, true)}
          {row(<X size={20} />, 'Cancel', () => setConfirm(false))}
        </>
      ) : (
        <>
          {!m.deleted && row(<Reply size={20} />, 'Reply', onReply)}
          {!m.deleted && !viewOnly && (m.text || m.kind === 'text') && row(<Copy size={20} />, 'Copy text', onCopy)}
          {row(<Trash2 size={20} />, 'Delete', () => setConfirm(true), true)}
        </>
      )}
    </Sheet>
  );
}

function ImageViewer({ m, onClose }: { m: ChatMsg; onClose: () => void }) {
  const url = useBlobUrl(m.blob);
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black">
      <div className="flex items-center justify-between px-2 pt-[max(8px,var(--safe-top))] text-white">
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center">
          <X size={24} />
        </button>
        <span className="text-[14px]">{timeOf(m.at)}</span>
        <span className="w-11" />
      </div>
      <div className="flex flex-1 items-center justify-center p-2" onClick={onClose}>
        {url && <img src={url} alt="" className="max-h-full max-w-full object-contain" />}
      </div>
      {m.text && <p className="px-4 pb-[max(16px,var(--safe-bottom))] text-center text-[15px] text-white/90">{m.text}</p>}
    </div>
  );
}

function ChatInfo({ conv, muted, media, onMute, onClear, onClose }: { conv: Conversation; muted: boolean; media: number; onMute: (v: boolean) => void; onClear: () => void; onClose: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Sheet onClose={onClose}>
      <div className="flex flex-col items-center px-3 pb-3 pt-2 text-center">
        <ConvAvatar conv={conv} size={72} />
        <p className="mt-2 text-[19px] font-bold text-ink">{conv.name}</p>
        <p className="text-[13.5px] text-muted">{conv.role}</p>
      </div>
      {conv.shared && (
        <div className="mb-3 rounded-2xl bg-page p-3">
          <p className="flex items-center gap-2 px-1 text-[13px] font-semibold text-ink-2">
            <Users size={16} /> Front desk team, shared inbox
          </p>
          <p className="px-1 pb-1 text-[12.5px] leading-snug text-muted">They work in shifts. Your messages go to whoever is on duty, and every reply shows who sent it.</p>
          <ul>
            {conv.members.map((p) => {
              const on = conv.face?.id === p.id;
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                  <PersonAvatar person={p} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-ink">{p.name}</span>
                    <span className="text-[12.5px] text-muted">{p.role}{p.employment ? `, ${p.employment}` : ''}</span>
                  </span>
                  {on ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-[#e6f7ee] px-2.5 py-1 text-[12px] font-semibold text-[#16794a]">
                      <span className="h-2 w-2 rounded-full bg-[#22c55e]" /> On duty
                    </span>
                  ) : (
                    <span className="text-[12px] text-muted">Off shift</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="divide-y divide-line rounded-2xl bg-page">
        <label className="flex items-center justify-between gap-3 px-4 py-3.5">
          <span className="flex items-center gap-3 text-[15px] text-ink">
            <BellOff size={19} className="text-ink-2" /> Mute notifications
          </span>
          <button type="button" role="switch" aria-checked={muted} onClick={() => onMute(!muted)} className={`relative h-7 w-12 rounded-full transition ${muted ? 'bg-brand-600' : 'bg-[#cfd8e6]'}`}>
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${muted ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </label>
        <div className="flex items-center justify-between px-4 py-3.5 text-[15px] text-ink">
          <span className="flex items-center gap-3">
            <ImageIcon size={19} className="text-ink-2" /> Photos & videos
          </span>
          <span className="text-muted">{media}</span>
        </div>
        <div className="flex items-start gap-3 px-4 py-3.5 text-[13.5px] text-ink-2">
          <Info size={19} className="mt-0.5 shrink-0 text-ink-2" /> Messages and files are saved on this phone and delivered when the cloud connection is available.
        </div>
      </div>
      {confirm ? (
        <div className="mt-3 rounded-2xl bg-[#fff1f1] p-3">
          <p className="mb-2 text-[14px] text-ink">Clear every message in this chat from this phone?</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClear} className="press flex-1 rounded-xl bg-[#d93036] py-2.5 text-[14.5px] font-semibold text-white">
              Clear chat
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="press flex-1 rounded-xl bg-white py-2.5 text-[14.5px] font-semibold text-ink ring-1 ring-line">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="press mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-semibold text-[#d93036]">
          <Trash2 size={18} /> Clear chat
        </button>
      )}
    </Sheet>
  );
}
