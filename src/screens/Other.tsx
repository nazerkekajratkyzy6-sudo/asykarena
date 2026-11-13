import { useCallback, useMemo, useState } from 'react';
import { Trainer } from '../game/Trainer';
import { analyzeThrow, type Feedback, type TargetSetup, type ThrowRecord } from '../game/physics';
import { PROGRAM } from '../game/program';
import { LESSONS, LESSON_AIM, LEVELS, STEPS, STEP_HINT, levelOf, type LessonDef } from '../game/lesson';
import { load, today, update } from '../game/storage';
import { ACHIEVEMENTS, recordContest, recordThrow } from '../game/achievements';
import { ControlsHelp, FeedbackBox, Modal, SectionBar, TopBar, useBoard, useFullscreen } from '../ui/Common';
import { Icon, type IconName } from '../ui/Art';

export type Route = 'home' | 'lessons' | 'lesson' | 'free' | 'contest' | 'about' | 'results' | 'media';

/* ---------- Басты бет ---------- */
export function Home({ go }: { go: (r: Route) => void }) {
  const { supported, toggle, fs } = useFullscreen();
  const { board, setBoard, requestReset } = useBoard();
  const s = load();
  const done = LESSONS.filter(l => s.lessons[l.id]?.completed).length;
  const items: { r: Route; t: string; d: string; icon: IconName }[] = [
    { r: 'lessons', t: 'Сабақты бастау', d: `${LESSONS.length} сабақ · 5ҚАДАМ · өтілді: ${done}/${LESSONS.length}`, icon: 'play' },
    { r: 'free', t: 'Еркін жаттығу', d: 'Теориясыз, шексіз лақтырыс', icon: 'target' },
    { r: 'contest', t: 'Мергендер сайысы', d: 'Чемпион деңгейі: екі оқушы кезекпен', icon: 'trophy' },
    { r: 'media', t: 'Бейнесабақтар', d: 'Техника, жаттығу кешені, жарыс · бейне мен фото', icon: 'video' },
    { r: 'about', t: 'Асық ату туралы', d: 'Ойын, асық, қауіпсіздік', icon: 'book' },
    { r: 'results', t: 'Менің нәтижем', d: `Нәтижелер және жетістіктер · ${Object.keys(s.ach).length}/${ACHIEVEMENTS.length}`, icon: 'chart' },
  ];
  return (
    <div className="screen home">
      <header className="hero">
        <div className="hero-photo" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}media/photo-07.jpg)` }} aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-text">
            <div className="hero-kicker">Ұлттық ойын · «Асық ату» үйірмесі</div>
            <h1 className="logo">ASIQ ARENA</h1>
            <p className="tagline">Виртуалды ойыннан – шынайы шеберлікке</p>
            <p className="hero-sub">Ұлттық асық ату ойынын үйрететін интерактивті оқу тренажёры</p>
            <div className="hero-stats">
              <span><b>{LESSONS.length}</b>интерактивті сабақ</span>
              <span><b>68</b>сағаттық программа</span>
              <span><b>3D</b>физикалық тренажёр</span>
            </div>
          </div>
        </div>
      </header>

      <div className="home-body">
        <section className="home-sec">
          <SectionBar icon="route" title="«5ҚАДАМ» авторлық моделі" />
          <div className="model">
            {STEPS.map((st, i) => (
              <span key={st} className="model-step"><i>{i + 1}</i><b>{st}</b><small>{STEP_HINT[i]}</small></span>
            ))}
          </div>
        </section>

        <section className="home-sec">
          <SectionBar icon="star" title="Ойын деңгейлері" />
          <div className="levels">
            {LEVELS.map((l, i) => (
              <div key={l.id} className={`level lv-${l.id}`}>
                <b>{l.title}</b><small>{l.sub}</small>
                {i < LEVELS.length - 1 && <span className="lv-arrow" aria-hidden="true">›</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="home-sec">
          <SectionBar icon="screen" title="Сайттың құрылымы" />
          <div className="menu">
            {items.map((it, i) => (
              <button key={it.r} className={`menu-item ${i === 0 ? 'primary' : ''}`} onClick={() => go(it.r)}>
                <span className="mi-ic"><Icon name={it.icon} size={24} /></span>
                <span className="mi-txt">
                  <span className="mi-t">{it.t}</span>
                  <span className="mi-d">{it.d}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="home-tools">
          <label className="switch board-switch">
            <input type="checkbox" checked={board} onChange={e => {
              setBoard(e.target.checked);
              if (e.target.checked && supported && !fs) toggle();
            }} />
            <span>Интерактивті тақта режимі</span>
          </label>
          {supported && <button className="text-btn" onClick={toggle}>{fs ? 'Толық экраннан шығу' : 'Толық экран'}</button>}
          {board && <button className="text-btn" onClick={requestReset}>Барлығын нөлдеу</button>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Оқу маршруты ---------- */
export function LessonList({ onHome, onOpen }: { onHome: () => void; onOpen: (l: LessonDef) => void }) {
  const s = load();
  const nextIdx = LESSONS.findIndex(l => !s.lessons[l.id]?.completed);
  return (
    <div className="screen">
      <TopBar title="Оқу маршруты" onBack={onHome} />
      <div className="center-col">
        <div className="route-intro">
          <SectionBar icon="route" title={`${LESSONS.length} интерактивті сабақ — бір жол`} />
          <p className="muted">Сабақтарды ретімен өткен дұрыс: әр сабақ алдыңғысына сүйенеді. Мұғалім кез келген сабақты аша алады.</p>
        </div>
        {LEVELS.map(lv => (
          <section key={lv.id} className="route-level">
            <div className="route-lv-h"><span className={`lvchip lv-${lv.id}`}>{lv.title}</span><span className="muted">{lv.sub}</span></div>
            <ol className="route">
          {LESSONS.filter(l => (lv.lessons as readonly number[]).includes(l.num)).map(l => {
            const i = LESSONS.indexOf(l);
            const st = s.lessons[l.id];
            const last = st?.runs[st.runs.length - 1];
            const state = st?.completed ? 'done' : i === nextIdx ? 'next' : '';
            return (
              <li key={l.id} className={`route-item ${state}`}>
                <button onClick={() => onOpen(l)}>
                  <span className="ri-n">{st?.completed ? '✓' : l.num}</span>
                  <span className="ri-body">
                    <span className="ri-t">{l.title}</span>
                    <span className="ri-g">{l.goal}</span>
                    <span className="ri-meta">
                      {l.throws} виртуалды лақтырыс · {l.card.attempts} нақты лақтырыс
                      {last && <> · соңғы нәтиже: виртуалды {last.virtual.hits}/{last.virtual.total}, нақты {last.real.reduce((a, r) => a + r.hits, 0)}/{last.real.reduce((a, r) => a + r.total, 0)}</>}
                    </span>
                  </span>
                  <span className="ri-side">
                    <span className={`lvchip lv-${levelOf(l.num).id}`}>{levelOf(l.num).title}</span>
                    <span className="ri-tag">{st?.completed ? 'Өтілді' : i === nextIdx ? 'Келесі' : ''}</span>
                  </span>
                </button>
              </li>
            );
          })}
            </ol>
          </section>
        ))}
        <div className="route-intro">
          <SectionBar icon="route" title="68 сағаттық программа" />
          <p className="muted">Программаның 34 сабағы. Интерактивті сабақтары бар жолдар белгіленген; қалғандары — мұғалім өткізетін мәтіндік сабақтар.</p>
        </div>
        <div className="prog">
          {PROGRAM.map(sec => (
            <details key={sec.title} className="prog-sec">
              <summary>{sec.title}</summary>
              <ol>
                {sec.items.map(it => (
                  <li key={it.n} className={it.app ? 'has-app' : ''}>
                    <span className="prog-n">{it.n}</span>
                    <span className="prog-t">{it.title}</span>
                    {it.app && <span className="prog-tag">интерактивті</span>}
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Еркін жаттығу ---------- */
function randomSetup(): TargetSetup {
  const x = Math.round((Math.random() * 3 - 1.5) * 10) / 10;
  const z = -Math.round((3.5 + Math.random() * 4) * 10) / 10;
  return { target: { x, z }, neighbors: [{ x: x - 1, z }, { x: x + 1, z }] };
}

export function FreeTraining({ onHome }: { onHome: () => void }) {
  const [round, setRound] = useState(0);
  const [setup, setSetup] = useState<TargetSetup>(() => randomSetup());
  const [fb, setFb] = useState<Feedback | null>(null);
  const [stats, setStats] = useState({ throws: 0, hits: 0 });
  const [guide, setGuide] = useState(false);
  const [help, setHelp] = useState(false);

  const onResult = useCallback((r: ThrowRecord) => {
    setFb(analyzeThrow(r));
    setStats(s => ({ throws: s.throws + 1, hits: s.hits + (r.hit ? 1 : 0) }));
    recordThrow(r.hit, { free: true });
  }, []);

  const again = (newTarget: boolean) => {
    if (newTarget) setSetup(randomSetup());
    setFb(null);
    setRound(r => r + 1);
  };

  const actions = fb && (
    <>
      <FeedbackBox fb={fb} />
      <div className="row">
        <button className="btn ghost" onClick={() => again(false)}>Осы нысанаға тағы</button>
        <button className="btn primary" onClick={() => again(true)}>Жаңа нысана</button>
      </div>
    </>
  );

  return (
    <div className="screen lesson">
      <TopBar title="Еркін жаттығу" onBack={onHome} />
      <div className="stage-layout">
        <div className="stage-wrap">
          <Trainer setup={setup} roundKey={round} enabled={!fb && !help} showGuide={guide} onResult={onResult} />
          <div className="hud">
            <div className="hud-chip">Лақтырыс <b>{stats.throws}</b></div>
            <div className="hud-chip">Тиді <b>{stats.hits}</b></div>
            <div className="hud-chip">Дәлдік <b>{stats.throws ? Math.round((stats.hits / stats.throws) * 100) : 0}%</b></div>
          </div>
          {actions && <div className="stage-sheet">{actions}</div>}
        </div>
        <aside className="panel">
          <p className="panel-p">Бұл режим оқу маршрутын алмастырмайды: мұнда теория мен нақты тапсырма жоқ. Нысана әр жолы кездейсоқ жерде және қашықтықта тұрады.</p>
          {actions && <div className="desk-only">{actions}</div>}
          <div className="tools">
            <button className="text-btn" onClick={() => setHelp(true)}>Көмек</button>
            <label className="switch"><input type="checkbox" checked={guide} onChange={e => setGuide(e.target.checked)} /><span>Көмекші сызық</span></label>
            <button className="text-btn" onClick={() => setStats({ throws: 0, hits: 0 })}>Есептегішті нөлдеу</button>
          </div>
        </aside>
      </div>
      {help && <Modal title="Қалай лақтырамын?" onClose={() => setHelp(false)}><ControlsHelp /></Modal>}
    </div>
  );
}

/* ---------- Мергендер сайысы (2 оқушы кезекпен) ---------- */
const ROUNDS = 5;

export function Contest({ onHome }: { onHome: () => void }) {
  const [names, setNames] = useState<[string, string]>(['1-ойыншы', '2-ойыншы']);
  const [started, setStarted] = useState(false);
  const [turn, setTurn] = useState(0);
  const [scores, setScores] = useState<boolean[][]>([[], []]);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [game, setGame] = useState(0);
  const player = turn % 2;
  const roundNo = Math.floor(turn / 2);
  const over = turn >= ROUNDS * 2;
  const setup = LESSON_AIM.setups[roundNo % LESSON_AIM.setups.length];

  const onResult = useCallback((r: ThrowRecord) => {
    setFb(analyzeThrow(r));
    recordThrow(r.hit);
    setScores(s => { const n = [s[0].slice(), s[1].slice()]; n[turn % 2].push(r.hit); return n; });
  }, [turn]);

  const next = () => {
    const t = turn + 1;
    setFb(null);
    setTurn(t);
    if (t >= ROUNDS * 2) {
      const sa = scores[0].filter(Boolean).length, sb = scores[1].filter(Boolean).length;
      update(s => { s.contests.unshift({ a: names[0], b: names[1], sa, sb, date: today() }); s.contests = s.contests.slice(0, 20); });
      recordContest();
    }
  };
  const reset = () => { setTurn(0); setScores([[], []]); setFb(null); setGame(g => g + 1); };

  if (!started) {
    return (
      <div className="screen">
        <TopBar title="Мергендер сайысы" onBack={onHome} />
        <div className="center-col">
          <div className="card">
            <h2 className="panel-h">Екі оқушы кезекпен атады</h2>
            <p className="panel-p">Әр ойыншыға {ROUNDS} лақтырыс. Әр айналымда екеуіне бірдей нысана. Есімдерді енгізу міндетті емес; олар тек осы құрылғыда сақталады.</p>
            {[0, 1].map(i => (
              <label key={i} className="field">{i + 1}-ойыншы
                <input id={`player-${i}`} value={names[i]} maxLength={20} onChange={e => { const n = [...names] as [string, string]; n[i] = e.target.value; setNames(n); }} />
              </label>
            ))}
            <button className="btn primary wide" onClick={() => { setNames([names[0].trim() || '1-ойыншы', names[1].trim() || '2-ойыншы']); setStarted(true); }}>Сайысты бастау</button>
          </div>
        </div>
      </div>
    );
  }

  const sa = scores[0].filter(Boolean).length, sb = scores[1].filter(Boolean).length;
  const actions = fb && !over && (
    <>
      <FeedbackBox fb={fb} />
      <button className="btn primary wide" onClick={next}>{turn + 1 >= ROUNDS * 2 ? 'Қорытынды' : 'Келесі ойыншы'}</button>
    </>
  );
  const endBox = over && (
    <div className="series-end">
      <div className="big-score">{sa === sb ? 'Тең ойын' : `Жеңімпаз: ${sa > sb ? names[0] : names[1]}`}</div>
      <div className="muted">{names[0]} {sa} : {sb} {names[1]}</div>
      <div className="row">
        <button className="btn ghost" onClick={reset}>Қайта ойнау</button>
        <button className="btn primary" onClick={onHome}>Басты бет</button>
      </div>
    </div>
  );
  return (
    <div className="screen lesson">
      <TopBar title="Мергендер сайысы" onBack={onHome} />
      <div className="stage-layout">
        <div className="stage-wrap">
          <Trainer setup={setup} roundKey={`${game}-${turn}`} enabled={!fb && !over} showGuide={false} onResult={onResult} />
          {!over && <div className="turn-banner">Кезек: <b>{names[player]}</b> · {roundNo + 1}/{ROUNDS}-айналым</div>}
          {(actions || endBox) && <div className="stage-sheet">{actions}{endBox}</div>}
        </div>
        <aside className="panel">
          <div className="scoreboard">
            {[0, 1].map(i => (
              <div key={i} className={`sb ${!over && player === i ? 'on' : ''}`}>
                <div className="sb-n">{names[i]}</div>
                <div className="sb-s">{i === 0 ? sa : sb}</div>
                <div className="dots">{Array.from({ length: ROUNDS }).map((_, k) => <span key={k} className={`dot ${k < scores[i].length ? (scores[i][k] ? 'hit' : 'miss') : ''}`} />)}</div>
              </div>
            ))}
          </div>
          {(actions || endBox) && <div className="desk-only">{actions}{endBox}</div>}
        </aside>
      </div>
    </div>
  );
}

/* ---------- Асық ату туралы ---------- */
export function About({ onHome }: { onHome: () => void }) {
  return (
    <div className="screen">
      <TopBar title="Асық ату туралы" onBack={onHome} />
      <div className="center-col">
        <article className="card prose">
          <h2>Асық ату — қазақтың ұлттық ойыны</h2>
          <p>Асық — қойдың тобық сүйегі. Ойыншылар асықтарды қатарға тізіп, оларды сақамен атып ұтады. Ойын дәлдікті, көз мөлшерін және қолдың икемділігін дамытады.</p>
          <h3>Сақа</h3>
          <p>Сақа — ату үшін қолданылатын ірірек әрі ауырлау асық. Қосымшада ол қызыл-қоңыр түспен белгіленген.</p>
          <h3>Асықтың түсу қалпы</h3>
          <p>Асықтың төрт жағы бар: <b>алшы</b>, <b>тәйкі</b>, <b>бүк</b> және <b>шік</b>. Көптеген ойын түрлерінде асықтың қалай түскені маңызды.</p>
          <h3>Қауіпсіздік</h3>
          <ul>
            <li>Атыс бағытында ешкім тұрмайды.</li>
            <li>Сақаны адамға қарай лақтыруға болмайды.</li>
            <li>Асықтарды тек мұғалімнің белгісінен кейін жинаймыз.</li>
          </ul>
          <h3>Қосымша туралы</h3>
          <p>ASIQ ARENA — оқу тренажёры. Виртуалды алаң, қашықтық пен физика — оқу мақсатындағы жеңілдетулер. Ресми ережелер мен нормативтерді мұғалім нақтылайды.</p>
        </article>
      </div>
    </div>
  );
}

/* ---------- Менің нәтижем ---------- */
export function Results({ onHome, onReset }: { onHome: () => void; onReset: () => void }) {
  const s = useMemo(() => load(), []);
  const [confirm, setConfirm] = useState(false);
  const pct = (h: number, t: number) => (t ? Math.round((h / t) * 100) : 0);
  return (
    <div className="screen">
      <TopBar title="Менің нәтижем" onBack={onHome} />
      <div className="center-col">
        <div className="card">
          <h2 className="panel-h">Жетістіктер · {Object.keys(s.ach).length} / {ACHIEVEMENTS.length}</h2>
          <div className="ach-grid">
            {ACHIEVEMENTS.map(a => (
              <div key={a.id} className={`ach ${s.ach[a.id] ? 'on' : ''}`}>
                <span className="ach-ic" aria-hidden="true">{s.ach[a.id] ? '★' : '☆'}</span>
                <span><b>{a.title}</b><br /><span className="muted">{s.ach[a.id] ? s.ach[a.id] : a.text}</span></span>
              </div>
            ))}
          </div>
          <p className="muted">Барлық виртуалды лақтырыс: {s.stats.throws}, дәл: {s.stats.hits} · ең ұзақ дәл серия: {s.stats.bestStreak}</p>
        </div>

        {LESSONS.map(l => {
          const runs = s.lessons[l.id]?.runs ?? [];
          return (
            <div className="card" key={l.id}>
              <h2 className="panel-h">{l.num}-сабақ · {l.title}</h2>
              {runs.length === 0 ? <p className="muted">Әзірге сақталған нәтиже жоқ.</p> : (
                <div className="table-wrap">
                  <table className="res">
                    <thead><tr><th>Күні</th><th>Виртуалды</th><th>Нақты (қолмен)</th><th>Жақсартамын</th></tr></thead>
                    <tbody>
                      {runs.slice().reverse().map((r, i) => {
                        const rh = r.real.reduce((a, x) => a + x.hits, 0), rt = r.real.reduce((a, x) => a + x.total, 0);
                        return (
                          <tr key={i}>
                            <td>{r.finishedAt}</td>
                            <td>
                              {r.virtual.hits}/{r.virtual.total} · {pct(r.virtual.hits, r.virtual.total)}%
                              {r.virtual.points !== undefined && <><br />{r.virtual.points} ұпай</>}
                              {r.virtual.groups.length > 0 && <div className="sub">{r.virtual.groups.map(g => `${g.label}: ${g.hits}/${g.total}`).join(' · ')}</div>}
                            </td>
                            <td>
                              {rt ? `${rh}/${rt} · ${pct(rh, rt)}%` : '—'}
                              {r.real.length > 1 && <div className="sub">{r.real.map(g => `${g.label}: ${g.hits}/${g.total}`).join(' · ')}</div>}
                            </td>
                            <td>{r.improve || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        <div className="card">
          <h2 className="panel-h">Еркін жаттығу және сайыс</h2>
          <p>Еркін жаттығу: {s.free.throws} лақтырыс, {s.free.hits} тиді{s.free.throws ? ` · ${pct(s.free.hits, s.free.throws)}%` : ''}</p>
          {s.contests.length === 0 ? <p className="muted">Сайыс әлі өткізілмеген.</p> : (
            <ul className="plain">{s.contests.map((c, i) => <li key={i}>{c.date}: {c.a} {c.sa} : {c.sb} {c.b}</li>)}</ul>
          )}
          <p className="note">Дәлдік = дәл лақтырыс / барлық лақтырыс × 100%. Виртуалды және нақты нәтижелер бөлек көрсетіледі. Деректер тек осы құрылғының браузерінде сақталады; браузер деректерін тазаласаңыз, олар өшеді.</p>
          <button className="btn danger" onClick={() => setConfirm(true)}>Барлық нәтижені өшіру</button>
        </div>
      </div>
      {confirm && (
        <div className="modal-bg" onClick={() => setConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Барлық нәтиже өшірілсін бе?</h3>
            <p>Сабақтар, жетістіктер, сайыстар өшеді. Бұл әрекетті қайтару мүмкін емес.</p>
            <div className="row">
              <button className="btn ghost" onClick={() => setConfirm(false)}>Жоқ</button>
              <button className="btn danger" onClick={() => { setConfirm(false); onReset(); }}>Иә, өшіру</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
