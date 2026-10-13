/**
 * Speech-to-text behind an interface: Uzbek STT quality varies by provider,
 * so the provider must be swappable without touching the listing flow.
 */
export interface SpeechToText {
  readonly name: string;
  transcribe(audio: Buffer, opts: { mimeType: string; language?: "uz" | "ru" }): Promise<string>;
}

export class SttUnavailableError extends Error {}

export class DisabledSpeechToText implements SpeechToText {
  readonly name = "disabled";
  async transcribe(): Promise<string> {
    throw new SttUnavailableError("STT provider is not configured");
  }
}

/**
 * Any service exposing the common `POST /audio/transcriptions` multipart API
 * (Whisper-compatible: self-hosted faster-whisper / whisper.cpp servers, Groq, OpenAI, etc.).
 * Language hint is omitted for mixed uz/ru speech so the model auto-detects.
 */
export class HttpWhisperSpeechToText implements SpeechToText {
  readonly name = "whisper-http";

  constructor(
    private opts: { url: string; apiKey?: string; model: string; timeoutMs?: number },
  ) {}

  async transcribe(audio: Buffer, { mimeType, language }: { mimeType: string; language?: "uz" | "ru" }) {
    const form = new FormData();
    const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a" : mimeType.includes("mpeg") ? "mp3" : "webm";
    form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `voice.${ext}`);
    form.append("model", this.opts.model);
    if (language) form.append("language", language);
    form.append("response_format", "json");

    const res = await fetch(`${this.opts.url.replace(/\/$/, "")}/audio/transcriptions`, {
      method: "POST",
      headers: this.opts.apiKey ? { authorization: `Bearer ${this.opts.apiKey}` } : {},
      body: form,
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 30_000),
    });
    if (!res.ok) throw new SttUnavailableError(`STT failed: ${res.status}`);
    const body = (await res.json()) as { text?: string };
    return (body.text ?? "").trim();
  }
}
