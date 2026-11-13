// Бейнесабақтар мен фотосуреттер.
// Два хранилища за одним интерфейсом:
//  • «cloud» — страница опубликована на claude.ai: файлы в хранилище артефакта (assets),
//    список — в его базе (db). Загружает учитель (редактор), видят все, кто открыл ссылку.
//  • «local» — Vercel / один HTML-файл: файлы в IndexedDB этого браузера (без сервера, по ТЗ).

export type MediaCat = 'technique' | 'training' | 'contest' | 'photo';
export type MediaKind = 'video' | 'photo' | 'link';

export const CATS: { id: MediaCat; title: string; hint: string }[] = [
  { id: 'technique', title: 'Асық ату техникасы', hint: 'Дұрыс қалып, көздеу, лақтыру' },
  { id: 'training', title: 'Жаттығу кешені', hint: 'Сабақтағы жаттығулар' },
  { id: 'contest', title: 'Мектепішілік жарыс', hint: 'Сайыс, жарыс сәттері' },
  { id: 'photo', title: 'Фотосуреттер', hint: 'Сабақтан, жарыстан суреттер' },
];

export interface MediaItem {
  id: string;
  title: string;
  cat: MediaCat;
  kind: MediaKind;
  lesson: number;       // 0 — жалпы, 1..5 — сабаққа байланысты (КӨР қадамында көрсетіледі)
  url: string;          // көрсету адресі
  createdAt: number;
  assetId?: string;
}

export interface NewMedia {
  title: string;
  cat: MediaCat;
  lesson: number;
  file?: File;
  link?: string;
}

export interface MediaBackend {
  mode: 'cloud' | 'local';
  canEdit: boolean;
  maxBytes: number | null;
  subscribe(cb: (items: MediaItem[]) => void, onError?: (msg: string) => void): () => void;
  add(m: NewMedia): Promise<void>;
  remove(item: MediaItem): Promise<void>;
}

export const CLOUD_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];

export function kindOf(file: File): MediaKind | null {
  if (file.type.startsWith('image/')) return 'photo';
  if (file.type.startsWith('video/')) return 'video';
  return null;
}

export function normalizeLink(raw: string): string | null {
  const s = raw.trim();
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch { return null; }
}

/* ---------------- cloud (claude.ai) ---------------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function errText(e: Any): string {
  const code = e?.code;
  if (code === 'too_large') return 'Файл тым үлкен: бір файл 20 МБ-тан аспауы керек.';
  if (code === 'unsupported_type') return 'Бұл формат қабылданбайды. Бейне — MP4 немесе WebM, сурет — JPG, PNG, WEBP, GIF.';
  if (code === 'quota_or_state' || code === 'quota_exceeded') return 'Сақтау орны толды. Ескі материалдарды өшіріп, қайталап көріңіз.';
  if (code === 'rate_limited' || code === 'resource_exhausted') return 'Тым жиі жүктелді. Бір минуттан кейін қайталаңыз.';
  if (code === 'not_granted' || code === 'invalid_argument') return 'Жүктеуге рұқсат жоқ: материалды тек мұғалім (редактор) қоса алады.';
  return 'Жүктеу сәтсіз аяқталды. Қайталап көріңіз.';
}

function cloudBackend(db: Any, assets: Any): MediaBackend {
  const col = db.collection('media');
  return {
    mode: 'cloud',
    canEdit: !!assets,
    maxBytes: 20 * 1024 * 1024,
    subscribe(cb, onError) {
      let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => onError?.('Материалдар әзірге жүктелмеді. Байланысты тексеріңіз.'), 10000);
      const unsub = col.onSnapshot((snap: Any) => {
        if (!snap.metadata.fromCache && timer) { clearTimeout(timer); timer = null; }
        const items: MediaItem[] = snap.docs.filter((d: Any) => d.exists).map((d: Any) => {
          const v = d.data() as Any;
          return {
            id: d.id, title: String(v.title ?? ''), cat: v.cat, kind: v.kind, lesson: Number(v.lesson ?? 0),
            createdAt: Number(v.createdAt ?? 0), assetId: v.assetId,
            url: v.kind === 'link' ? String(v.link ?? '') : '/_blob/' + v.assetId,
          };
        });
        cb(items.sort((a, b) => b.createdAt - a.createdAt));
      }, () => { if (timer) clearTimeout(timer); timer = null; onError?.('Материалдарды оқу мүмкін болмады.'); });
      return () => { if (timer) clearTimeout(timer); unsub(); };
    },
    async add(m) {
      const base = { title: m.title, cat: m.cat, lesson: m.lesson, createdAt: Date.now() };
      if (m.link) { await col.add({ ...base, kind: 'link', link: m.link }); return; }
      if (!m.file || !assets) throw new Error('Жүктеуге рұқсат жоқ.');
      const kind = kindOf(m.file);
      if (!kind || !CLOUD_TYPES.includes(m.file.type)) throw new Error(errText({ code: 'unsupported_type' }));
      if (m.file.size > 20 * 1024 * 1024) throw new Error(errText({ code: 'too_large' }));
      let res: Any;
      try { res = await assets.upload(m.file); } catch (e) { throw new Error(errText(e)); }
      try { await col.add({ ...base, kind, assetId: res.id }); } catch (e) { throw new Error(errText(e)); }
    },
    async remove(item) {
      await col.doc(item.id).delete();
      if (item.assetId && assets) { try { await assets.delete(item.assetId); } catch { /* файл уже удалён */ } }
    },
  };
}

/* ---------------- local (IndexedDB) ---------------- */
const DB_NAME = 'asiq-arena-media';
const STORE = 'items';

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return idb().then(d => new Promise<T>((res, rej) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => res(req.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}

function localBackend(): MediaBackend {
  const listeners = new Set<(items: MediaItem[]) => void>();
  const urls = new Map<string, string>();
  const emit = async () => {
    let rows: Any[] = [];
    try { rows = await tx<Any[]>('readonly', s => s.getAll()); } catch { rows = []; }
    const items: MediaItem[] = rows.map(r => {
      let url = r.link ?? '';
      if (r.blob) {
        if (!urls.has(r.id)) urls.set(r.id, URL.createObjectURL(r.blob));
        url = urls.get(r.id)!;
      }
      return { id: r.id, title: r.title, cat: r.cat, kind: r.kind, lesson: r.lesson, createdAt: r.createdAt, url };
    }).sort((a, b) => b.createdAt - a.createdAt);
    listeners.forEach(l => l(items));
  };
  return {
    mode: 'local',
    canEdit: typeof indexedDB !== 'undefined',
    maxBytes: null,
    subscribe(cb) { listeners.add(cb); emit(); return () => listeners.delete(cb); },
    async add(m) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const base = { id, title: m.title, cat: m.cat, lesson: m.lesson, createdAt: Date.now() };
      if (m.link) {
        await tx('readwrite', s => s.put({ ...base, kind: 'link', link: m.link }));
      } else {
        const kind = m.file && kindOf(m.file);
        if (!m.file || !kind) throw new Error('Тек бейне немесе сурет файлын таңдаңыз.');
        try { await tx('readwrite', s => s.put({ ...base, kind, blob: m.file })); }
        catch { throw new Error('Файлды сақтау мүмкін болмады: құрылғыда орын жетпеуі мүмкін.'); }
      }
      await emit();
    },
    async remove(item) {
      await tx('readwrite', s => s.delete(item.id));
      const u = urls.get(item.id);
      if (u) { URL.revokeObjectURL(u); urls.delete(item.id); }
      await emit();
    },
  };
}

let backend: Promise<MediaBackend> | null = null;

export function getMediaBackend(): Promise<MediaBackend> {
  if (!backend) {
    backend = (async () => {
      const c = (window as Any).claude;
      if (c && typeof c.use === 'function') {
        try {
          const db = await c.use('db');
          if (db) {
            const assets = await c.use('assets');
            return cloudBackend(db, assets);
          }
        } catch { /* ниже — локальное хранилище */ }
      }
      return localBackend();
    })();
  }
  return backend;
}
