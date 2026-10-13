import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROMPTS_DIR } from "@ishonch/shared/node";

export interface Prompt {
  id: string;
  version: number;
  model: "fast" | "strong";
  maxTokens: number;
  effort: "low" | "medium" | "high";
  body: string;
}

const cache = new Map<string, Prompt>();

function parse(file: string): Prompt {
  const raw = readFileSync(file, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`Prompt ${file} has no front matter`);
  const meta = Object.fromEntries(
    m[1]!.split("\n").map((line) => {
      const i = line.indexOf(":");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
  );
  return {
    id: meta.id!,
    version: Number(meta.version),
    model: meta.model === "strong" ? "strong" : "fast",
    maxTokens: Number(meta.max_tokens ?? 2000),
    effort: (meta.effort as Prompt["effort"]) ?? "low",
    body: m[2]!.trim(),
  };
}

/** Loads the latest version of `<id>.v<N>.md` (or a specific version). */
export function loadPrompt(id: string, version?: number, dir = PROMPTS_DIR): Prompt {
  const key = `${dir}:${id}:${version ?? "latest"}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const versions = readdirSync(dir)
    .map((f) => f.match(new RegExp(`^${id}\\.v(\\d+)\\.md$`)))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => Number(m[1]))
    .sort((a, b) => b - a);
  const v = version ?? versions[0];
  if (v === undefined || !versions.includes(v)) throw new Error(`Prompt ${id} v${version ?? "?"} not found`);

  const prompt = parse(join(dir, `${id}.v${v}.md`));
  cache.set(key, prompt);
  return prompt;
}

export function renderPrompt(body: string, vars: Record<string, string | number> = {}): string {
  return body.replace(/\{\{(\w+)\}\}/g, (m, name: string) => (vars[name] !== undefined ? String(vars[name]) : m));
}
