import { useRef, useState } from "react";

/** Records a voice note with MediaRecorder (supported in Telegram's Android/iOS/desktop webviews). */
export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
      const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setAudio(new Blob(chunks, { type: r.mimeType || "audio/webm" }));
        setRecording(false);
      };
      r.start();
      rec.current = r;
      setRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function stop() {
    rec.current?.stop();
  }

  return { recording, audio, error, start, stop, clear: () => setAudio(null), supported: typeof MediaRecorder !== "undefined" };
}
