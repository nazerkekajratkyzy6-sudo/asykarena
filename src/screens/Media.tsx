import { SEED_MEDIA } from '../game/seedMedia';
import { useEffect, useRef, useState } from 'react';
import { CATS, getMediaBackend, kindOf, normalizeLink, type MediaBackend, type MediaCat, type MediaItem } from '../game/media';
import { LESSONS } from '../game/lesson';
import { SectionBar, TopBar } from '../ui/Common';

export function useMedia() {
  const [be, setBe] = useState<MediaBackend | null>(null);
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let alive = true;
    getMediaBackend().then(b => {
      if (!alive) return;
      setBe(b);
      unsub = b.subscribe(list => { setItems(list); setError(null); }, msg => setError(msg));
    });
    return () => { alive = false; unsub?.(); };
  }, []);
  return { be, items: [...SEED_MEDIA, ...(items ?? [])], error };
}

export function MediaViewer({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="viewer" onClick={e => e.stopPropagation()} role="dialog" aria-label={item.title}>
        <div className="viewer-head">
          <b>{item.title}</b>
          <button className="icon-btn" onClick={onClose} aria-label="Жабу">
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
          </button>
        </div>
        {item.kind === 'video' && <video src={item.url} controls autoPlay playsInline className="viewer-media" />}
        {item.kind === 'photo' && <img src={item.url} alt={item.title} className="viewer-media" />}
        {item.kind === 'link' && (
          <div className="viewer-link">
            <p>Бұл материал басқа сайтта орналасқан.</p>
            <a className="btn primary" href={item.url} target="_blank" rel="noopener noreferrer">Сілтемені ашу</a>
            <p className="muted break">{item.url}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MediaCard({ item, canEdit, onOpen, onDelete }: { item: MediaItem; canEdit: boolean; onOpen: () => void; onDelete: () => void }) {
  const cat = CATS.find(c => c.id === item.cat);
  const lesson = LESSONS.find(l => l.num === item.lesson);
  return (
    <article className="mcard">
      <button className="mthumb" onClick={onOpen} aria-label={`Ашу: ${item.title}`}>
        {item.kind === 'video' && <video src={item.url + '#t=0.5'} preload="metadata" muted playsInline />}
        {item.kind === 'photo' && <img src={item.url} alt="" loading="lazy" />}
        {item.kind === 'link' && <span className="mlink-ic" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
        </span>}
        {item.kind === 'video' && <span className="play" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M8 5v14l11-7z" fill="currentColor" /></svg></span>}
      </button>
      <div className="mbody">
        <div className="mtitle">{item.title}</div>
        <div className="mmeta">{cat?.title}{lesson ? ` · ${lesson.num}-сабақ` : ''}</div>
      </div>
      {canEdit && !item.id.startsWith('seed-') && <button className="mdel" onClick={onDelete} aria-label={`Өшіру: ${item.title}`}>Өшіру</button>}
    </article>
  );
}

function Uploader({ be, onDone }: { be: MediaBackend; onDone: () => void }) {
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState<MediaCat>('technique');
  const [lesson, setLesson] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    setMsg(null);
    if (!f) { setFile(null); return; }
    const k = kindOf(f);
    if (!k) { setMsg({ ok: false, t: 'Тек бейне немесе сурет файлын таңдаңыз.' }); return; }
    if (be.maxBytes && f.size > be.maxBytes) { setMsg({ ok: false, t: `Файл ${(f.size / 1048576).toFixed(1)} МБ. Бір файл 20 МБ-тан аспауы керек — бейнені қысқартыңыз немесе сығыңыз.` }); return; }
    setFile(f);
    if (k === 'photo') setCat('photo'); else if (cat === 'photo') setCat('technique');
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').slice(0, 80));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const t = title.trim();
    if (!t) { setMsg({ ok: false, t: 'Атауын жазыңыз.' }); return; }
    let l: string | undefined;
    if (mode === 'link') {
      const n = normalizeLink(link);
      if (!n) { setMsg({ ok: false, t: 'Сілтеме https:// деп басталуы керек.' }); return; }
      l = n;
    } else if (!file) { setMsg({ ok: false, t: 'Файлды таңдаңыз.' }); return; }
    setBusy(true);
    try {
      await be.add({ title: t, cat, lesson, file: mode === 'file' ? file! : undefined, link: l });
      setMsg({ ok: true, t: 'Қосылды.' });
      setFile(null); setLink(''); setTitle(''); setLesson(0);
      if (input.current) input.current.value = '';
      onDone();
    } catch (err) {
      setMsg({ ok: false, t: (err as Error).message || 'Жүктеу сәтсіз аяқталды.' });
    } finally { setBusy(false); }
  };

  return (
    <form className="uploader" onSubmit={submit}>
      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'file'} className={mode === 'file' ? 'on' : ''} onClick={() => setMode('file')}>Бейне немесе фото</button>
        <button type="button" role="tab" aria-selected={mode === 'link'} className={mode === 'link' ? 'on' : ''} onClick={() => setMode('link')}>Сілтеме (YouTube т.б.)</button>
      </div>
      {mode === 'file' ? (
        <label className="drop" htmlFor="media-file">
          <input id="media-file" ref={input} type="file" accept={be.mode === 'cloud' ? 'video/mp4,video/webm,image/png,image/jpeg,image/webp,image/gif' : 'video/*,image/*'}
            onChange={e => pick(e.target.files?.[0] ?? null)} />
          <span className="drop-t">{file ? file.name : 'Файлды таңдау'}</span>
          <span className="muted">{file ? `${(file.size / 1048576).toFixed(1)} МБ` : be.mode === 'cloud' ? 'MP4, WebM, JPG, PNG, WEBP · 20 МБ-қа дейін' : 'Бейне немесе сурет'}</span>
        </label>
      ) : (
        <label className="field">Сілтеме
          <input id="media-link" type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" value={link} onChange={e => setLink(e.target.value)} />
        </label>
      )}
      <label className="field">Атауы
        <input id="media-title" value={title} maxLength={80} onChange={e => setTitle(e.target.value)} placeholder="Мысалы: Асық ату техникасы" />
      </label>
      <div className="two">
        <label className="field">Бөлім
          <select id="media-cat" value={cat} onChange={e => setCat(e.target.value as MediaCat)}>
            {CATS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="field">Сабақпен байланыстыру
          <select id="media-lesson" value={lesson} onChange={e => setLesson(Number(e.target.value))}>
            <option value={0}>Жалпы</option>
            {LESSONS.map(l => <option key={l.id} value={l.num}>{l.num}. {l.title}</option>)}
          </select>
        </label>
      </div>
      {msg && <div className={`umsg ${msg.ok ? 'ok' : 'bad'}`}>{msg.t}</div>}
      <button className="btn primary wide" disabled={busy}>{busy ? 'Жүктелуде…' : 'Қосу'}</button>
    </form>
  );
}

export function MediaScreen({ onHome }: { onHome: () => void }) {
  const { be, items, error } = useMedia();
  const [filter, setFilter] = useState<MediaCat | 'all'>('all');
  const [open, setOpen] = useState<MediaItem | null>(null);
  const [del, setDel] = useState<MediaItem | null>(null);
  const [showUp, setShowUp] = useState(false);
  const list = (items ?? []).filter(i => filter === 'all' || i.cat === filter);
  const canEdit = !!be?.canEdit;

  return (
    <div className="screen">
      <TopBar title="Бейнесабақтар" onBack={onHome} />
      <div className="center-col wide">
        <SectionBar icon="video" title="Бейнесабақтар мен фотосуреттер" />
        <p className="lead">Нақты асық ату техникасы, жаттығу кешені және мектепішілік жарыс. Сабаққа байланыстырылған бейне сол сабақтың «КӨР» қадамында да шығады.</p>
        <div className="chips" role="tablist" aria-label="Бөлімдер">
          <button role="tab" aria-selected={filter === 'all'} className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>Барлығы{items ? ` · ${items.length}` : ''}</button>
          {CATS.map(c => {
            const n = (items ?? []).filter(i => i.cat === c.id).length;
            return <button key={c.id} role="tab" aria-selected={filter === c.id} className={`chip ${filter === c.id ? 'on' : ''}`} onClick={() => setFilter(c.id)}>{c.title}{items ? ` · ${n}` : ''}</button>;
          })}
        </div>

        {be && canEdit && (
          <div className="card upcard">
            <div className="up-head">
              <div>
                <b>Материал қосу</b>
                <div className="muted">{be.mode === 'cloud' ? 'Жүктелген материалды осы бетті ашқан барлық адам көреді.' : 'Файлдар тек осы құрылғының браузерінде сақталады.'}</div>
              </div>
              <button className="btn ghost" onClick={() => setShowUp(s => !s)}>{showUp ? 'Жабу' : 'Жүктеу'}</button>
            </div>
            {showUp && <Uploader be={be} onDone={() => undefined} />}
          </div>
        )}

        {!items && !error && <div className="empty"><div className="spinner" aria-hidden="true" />Материалдар жүктелуде…</div>}
        {error && <div className="umsg bad">{error}</div>}
        {items && list.length === 0 && (
          <div className="empty">
            <b>{filter === 'all' ? 'Әзірге материал жоқ' : 'Бұл бөлімде материал жоқ'}</b>
            <span className="muted">{canEdit ? '«Жүктеу» батырмасы арқылы алғашқы бейнені немесе фотоны қосыңыз.' : 'Мұғалім материал жүктегенде, ол осында шығады.'}</span>
          </div>
        )}
        {list.length > 0 && (
          <div className="mgrid">
            {list.map(i => <MediaCard key={i.id} item={i} canEdit={canEdit} onOpen={() => setOpen(i)} onDelete={() => setDel(i)} />)}
          </div>
        )}
      </div>
      {open && <MediaViewer item={open} onClose={() => setOpen(null)} />}
      {del && be && (
        <div className="modal-bg" onClick={() => setDel(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>«{del.title}» өшірілсін бе?</h3>
            <p>{be.mode === 'cloud' ? 'Материал барлық көрушіден өшеді. Қайтару мүмкін емес.' : 'Материал осы құрылғыдан өшеді.'}</p>
            <div className="row">
              <button className="btn ghost" onClick={() => setDel(null)}>Жоқ</button>
              <button className="btn danger" onClick={async () => { const d = del; setDel(null); try { await be.remove(d); } catch { /* */ } }}>Иә, өшіру</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
