/**
 * Voice-note recorder (owner, 2026-11-23): one tap starts recording (no
 * press-and-hold), it can be paused and resumed, deleted, or sent. Shows the
 * running time and the live sound level for the waveform.
 * Uses the phone's microphone through the browser (MediaRecorder); in the
 * native app the same flow uses the native recorder.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type RecState = 'idle' | 'recording' | 'paused';

export function useVoiceRecorder() {
  const [state, setState] = useState<RecState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const raf = useRef(0);
  const tick = useRef(0);
  const elapsed = useRef(0);

  const stopAll = useCallback(() => {
    cancelAnimationFrame(raf.current);
    window.clearInterval(tick.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => undefined);
    ctx.current = null;
  }, []);
  useEffect(() => stopAll, [stopAll]);

  /** Start recording at once. Throws a plain-words error if the mic can't be used. */
  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Voice notes need a secure connection (HTTPS) or the installed app — the microphone isn’t available here.');
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new Error('Allow microphone access to record a voice note.');
    }
    stream.current = s;
    chunks.current = [];
    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(s, type ? { mimeType: type } : undefined);
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.start(250);
    rec.current = r;
    elapsed.current = 0;
    setSeconds(0);
    setLevels([]);
    setState('recording');
    tick.current = window.setInterval(() => {
      if (rec.current?.state === 'recording') {
        elapsed.current += 0.2;
        setSeconds(elapsed.current);
      }
    }, 200);
    // Live level for the waveform.
    try {
      const ac = new AudioContext();
      ctx.current = ac;
      const an = ac.createAnalyser();
      an.fftSize = 256;
      ac.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      let last = 0;
      const loop = (t: number) => {
        if (t - last > 90 && rec.current?.state === 'recording') {
          last = t;
          an.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          setLevels((l) => [...l.slice(-47), Math.min(1, peak / 64)]);
        }
        raf.current = requestAnimationFrame(loop);
      };
      raf.current = requestAnimationFrame(loop);
    } catch {
      /* no level meter — recording still works */
    }
  }, []);

  const pause = useCallback(() => {
    if (rec.current?.state === 'recording') {
      rec.current.pause();
      setState('paused');
    }
  }, []);
  const resume = useCallback(() => {
    if (rec.current?.state === 'paused') {
      rec.current.resume();
      setState('recording');
    }
  }, []);

  const cancel = useCallback(() => {
    if (rec.current && rec.current.state !== 'inactive') {
      rec.current.onstop = null;
      rec.current.stop();
    }
    rec.current = null;
    stopAll();
    setState('idle');
    setSeconds(0);
    setLevels([]);
  }, [stopAll]);

  /** Stop and hand back the recording. */
  const finish = useCallback(
    () =>
      new Promise<{ blob: Blob; duration: number; levels: number[] } | null>((resolve) => {
        const r = rec.current;
        if (!r) return resolve(null);
        const keep = levels;
        r.onstop = () => {
          const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' });
          const duration = Math.max(1, Math.round(elapsed.current));
          rec.current = null;
          stopAll();
          setState('idle');
          setSeconds(0);
          setLevels([]);
          resolve(blob.size ? { blob, duration, levels: keep } : null);
        };
        if (r.state === 'paused') r.resume();
        r.stop();
      }),
    [levels, stopAll],
  );

  return { state, seconds, levels, start, pause, resume, cancel, finish };
}
