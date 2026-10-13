import type { CheckResult, Lang } from "@ishonch/shared";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

export interface Me {
  id: string;
  language: Lang;
  role: string;
  acceptedTerms: boolean;
  checks: { perDay: number; remaining: number };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function createApi(initData: string | null) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...(initData ? { authorization: `tma ${initData}` } : {}), ...init.headers },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, body.error ?? "error", body.message ?? res.statusText);
    return body as T;
  }
  const json = (method: string, data: unknown): RequestInit => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });

  return {
    me: () => request<Me>("/me"),
    acceptTerms: () => request("/me/accept-terms", { method: "POST" }),
    setLanguage: (language: Lang) => request("/me", json("PATCH", { language })),
    deleteAccount: () => request("/me", { method: "DELETE" }),
    createCheck: (lang: Lang, text: string, images: Blob[]) => {
      const form = new FormData();
      form.append("lang", lang);
      if (text.trim()) form.append("text", text.trim());
      images.forEach((img, i) => form.append("images", img, `screenshot-${i}.jpg`));
      return request<CheckResult>("/checks", { method: "POST", body: form });
    },
    getCheck: (id: string) => request<CheckResult>(`/checks/${encodeURIComponent(id)}`),
  };
}

export type Api = ReturnType<typeof createApi>;

/** Downscale screenshots to ≤1600px JPEG: faster upload and fewer AI tokens. */
export async function compressImage(file: File, maxSide = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
}
