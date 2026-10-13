/**
 * Spellings buyers in Tashkent actually type (Cyrillic/Latin transliterations, slang)
 * → the canonical word used in listing titles. Each query word matches either form.
 */
const SYNONYMS: Record<string, string> = {
  айфон: "iphone",
  aifon: "iphone",
  ayfon: "iphone",
  iphnoe: "iphone",
  ipone: "iphone",
  макбук: "macbook",
  makbuk: "macbook",
  macbok: "macbook",
  самсунг: "samsung",
  samsug: "samsung",
  galaxi: "galaxy",
  галакси: "galaxy",
  редми: "redmi",
  сяоми: "xiaomi",
  ксиоми: "xiaomi",
  xiomi: "xiaomi",
  шаоми: "xiaomi",
  айпад: "ipad",
  aypad: "ipad",
  эирподс: "airpods",
  аирподс: "airpods",
  airpods: "airpods",
  airpod: "airpods",
  эпл: "apple",
  пс5: "playstation",
  ps5: "playstation",
  ps4: "playstation",
  плейстейшн: "playstation",
  сони: "sony",
  леново: "lenovo",
  асус: "asus",
  ноут: "ноутбук",
  noutbuk: "noutbuk",
  ноутбук: "ноутбук",
  наушник: "наушники",
  quloqchin: "quloqchin",
  telefon: "телефон",
};

export function canonicalWord(w: string): string | null {
  const c = SYNONYMS[w.toLowerCase()];
  return c && c !== w.toLowerCase() ? c : null;
}

/** "айфон 13" → "iphone 13" (used for fuzzy title matching). */
export function canonicalQuery(q: string): string {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((w) => canonicalWord(w) ?? w)
    .join(" ");
}
