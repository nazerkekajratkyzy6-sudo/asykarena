// Локальное хранение прогресса (только на этом устройстве, без персональных данных)
const KEY = 'asiq-arena-v1';
const PREF = 'asiq-arena-prefs';

export interface Part { label: string; hits: number; total: number }

export interface LessonRun {
  virtual: { hits: number; total: number; points?: number; maxPoints?: number; groups: Part[] };
  real: Part[];
  realDate: string | null;
  easy: string;
  improve: string;
  finishedAt: string | null;
}

export interface Store {
  lessons: Record<string, { runs: LessonRun[]; completed: boolean }>;
  free: { throws: number; hits: number };
  contests: { a: string; b: string; sa: number; sb: number; date: string }[];
  stats: { throws: number; hits: number; streak: number; bestStreak: number };
  ach: Record<string, string>; // id → дата получения
}

const empty = (): Store => ({
  lessons: {}, free: { throws: 0, hits: 0 }, contests: [],
  stats: { throws: 0, hits: 0, streak: 0, bestStreak: 0 }, ach: {},
});

// Перевод записей прототипа v0.1 в новый формат
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateRun(r: any): LessonRun {
  if (r && r.virtual) return r as LessonRun;
  return {
    virtual: { hits: r.virtualHits ?? 0, total: r.virtualTotal ?? 0, groups: [] },
    real: r.realHits == null ? [] : [{ label: 'Тиген лақтырыс', hits: r.realHits, total: r.realTotal }],
    realDate: r.realDate ?? null, easy: r.easy ?? '', improve: r.improve ?? '', finishedAt: r.finishedAt ?? null,
  };
}

export function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const s = { ...empty(), ...JSON.parse(raw) } as Store;
    for (const id of Object.keys(s.lessons)) s.lessons[id].runs = s.lessons[id].runs.map(migrateRun);
    return s;
  } catch {
    return empty();
  }
}

export function save(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* хранилище недоступно */ }
}

export function update(fn: (s: Store) => void) {
  const s = load();
  fn(s);
  save(s);
  return s;
}

export function clearAll() {
  try { localStorage.removeItem(KEY); } catch { /* */ }
}

export function today() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function getPref<T>(k: string, def: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(PREF) || '{}')[k];
    return v === undefined ? def : v;
  } catch { return def; }
}

export function setPref(k: string, v: unknown) {
  try {
    const o = JSON.parse(localStorage.getItem(PREF) || '{}');
    o[k] = v;
    localStorage.setItem(PREF, JSON.stringify(o));
  } catch { /* */ }
}
