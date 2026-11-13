import { useCallback, useState } from 'react';
import { Demo, DEMO_LENGTH } from '../game/Demo';
import { Trainer } from '../game/Trainer';
import { evaluateThrow, type Evaluation, type ThrowRecord } from '../game/physics';
import { STEPS, STEP_HINT, levelOf, type LessonDef } from '../game/lesson';
import { MediaViewer, useMedia } from './Media';
import type { MediaItem } from '../game/media';
import { load, today, update, type LessonRun, type Part } from '../game/storage';
import { recordLessonDone, recordSeries, recordThrow } from '../game/achievements';
import { ControlsHelp, FeedbackBox, Modal, Stepper, TopBar } from '../ui/Common';

type Virtual = LessonRun['virtual'];

export function LessonScreen({ lesson, onHome, onList, onNextLesson }: {
  lesson: LessonDef; onHome: () => void; onList: () => void; onNextLesson?: () => void;
}) {
  const doneBefore = !!load().lessons[lesson.id]?.completed;
  const [session, setSession] = useState(0);
  return (
    <LessonFlow key={`${lesson.id}-${session}`} lesson={lesson} doneBefore={doneBefore}
      onHome={onHome} onList={onList} onNextLesson={onNextLesson} onRestart={() => setSession(s => s + 1)} />
  );
}

function LessonFlow({ lesson, doneBefore, onHome, onList, onNextLesson, onRestart }: {
  lesson: LessonDef; doneBefore: boolean; onHome: () => void; onList: () => void; onNextLesson?: () => void; onRestart: () => void;
}) {
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [virtual, setVirtual] = useState<Virtual | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);

  const go = (i: number) => { setStep(i); setMaxStep(m => Math.max(m, i)); window.scrollTo({ top: 0 }); };

  return (
    <div className="screen lesson">
      <div className="lesson-head no-print">
        <TopBar
          title={`${lesson.num}-сабақ · ${lesson.title}`}
          onBack={onList}
          right={<button className="text-btn" onClick={() => setConfirmRestart(true)}>Басынан</button>}
        />
        <Stepper step={step} maxStep={maxStep} onGo={go} />
        <div className="step-caption"><b>{STEPS[step]}</b> — {STEP_HINT[step]}</div>
      </div>

      {step === 0 && <SeeStep lesson={lesson} canSkip={doneBefore} onNext={() => go(1)} />}
      {step === 1 && <LearnStep lesson={lesson} onNext={() => go(2)} />}
      {step === 2 && <TrainStep lesson={lesson} onDone={v => { setVirtual(v); go(3); }} />}
      {step === 3 && <DoStep lesson={lesson} onNext={() => go(4)} />}
      {step === 4 && (
        <ResultStep lesson={lesson} virtual={virtual} onRestart={onRestart} onHome={onHome}
          onTrain={() => go(2)} onNextLesson={onNextLesson} />
      )}

      {confirmRestart && (
        <div className="modal-bg" onClick={() => setConfirmRestart(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Сабақты басынан бастау керек пе?</h3>
            <p>Осы сабақтағы ағымдағы жаттығу нәтижесі өшеді. Бұрын сақталған нәтижелер сақталады.</p>
            <div className="row">
              <button className="btn ghost" onClick={() => setConfirmRestart(false)}>Жоқ</button>
              <button className="btn primary" onClick={onRestart}>Иә, басынан</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- КӨР ---------- */
function SeeStep({ lesson, canSkip, onNext }: { lesson: LessonDef; canSkip: boolean; onNext: () => void }) {
  const [play, setPlay] = useState(0);
  const [cur, setCur] = useState(0);
  const [t, setT] = useState(0);
  const d = lesson.demoSteps[cur];
  return (
    <div className="stage-layout">
      <div className="stage-wrap">
        <Demo cfg={lesson.demo} playKey={play} onStep={setCur} onTime={setT} />
        <div className="demo-progress"><div style={{ width: `${(t / DEMO_LENGTH) * 100}%` }} /></div>
      </div>
      <aside className="panel">
        <div className="demo-steps">
          {lesson.demoSteps.map((s, i) => (
            <div key={i} className={`demo-step ${i === cur ? 'on' : i < cur ? 'past' : ''}`}>
              <span>{i + 1}</span>{s.title}
            </div>
          ))}
        </div>
        <h2 className="panel-h">{cur + 1}. {d.title}</h2>
        <p className="panel-p">{d.text}</p>
        <p className="note">Бұл — оқу сызбасы. Ол нақты лақтырудың дене қимылын дәл көрсетпейді.</p>
        <LessonMedia num={lesson.num} />
        <div className="row">
          <button className="btn ghost" onClick={() => { setPlay(p => p + 1); setCur(0); setT(0); }}>Қайта көру</button>
          <button className="btn primary" onClick={onNext}>Келесі</button>
        </div>
      </aside>
    </div>
  );
}

/** Мұғалім осы сабаққа байланыстырған нақты бейне/фото — КӨР қадамында */
function LessonMedia({ num }: { num: number }) {
  const { items } = useMedia();
  const [open, setOpen] = useState<MediaItem | null>(null);
  const mine = (items ?? []).filter(i => i.lesson === num);
  if (mine.length === 0) return null;
  return (
    <div className="lesson-media">
      <div className="lm-h">Нақты техниканың бейнесі</div>
      {mine.map(i => (
        <button key={i.id} className="lm-item" onClick={() => setOpen(i)}>
          <span className="lm-ic">{i.kind === 'video' ? '▶' : i.kind === 'photo' ? '▣' : '↗'}</span>{i.title}
        </button>
      ))}
      {open && <MediaViewer item={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ---------- ҮЙРЕН ---------- */
function LearnStep({ lesson, onNext }: { lesson: LessonDef; onNext: () => void }) {
  const [qi, setQi] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const q = lesson.quiz[qi];
  const ok = picked !== null && q.options[picked].ok;
  const pick = (i: number) => {
    if (ok) return;
    setPicked(i);
    if (!q.options[i].ok) setWrong(w => [...w, i]);
  };
  const next = () => {
    if (qi + 1 < lesson.quiz.length) { setQi(qi + 1); setPicked(null); setWrong([]); }
    else onNext();
  };
  return (
    <div className="center-col">
      <div className="card quiz">
        <div className="quiz-top">Сұрақ {qi + 1} / {lesson.quiz.length}</div>
        <h2 className="quiz-q">{q.q}</h2>
        <div className="options">
          {q.options.map((o, i) => {
            const cls = picked === i ? (o.ok ? 'right' : 'wrong') : wrong.includes(i) ? 'was-wrong' : '';
            return (
              <button key={i} className={`option ${cls}`} disabled={ok || wrong.includes(i)} onClick={() => pick(i)}>
                <span className="opt-l">{'ABC'[i]}</span>{o.t}
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <div className={`explain ${ok ? 'ok' : 'bad'}`}>
            <b>{ok ? 'Дұрыс!' : 'Қате.'}</b> {q.options[picked].why}
            {!ok && <div className="retry">Басқа жауапты таңдап көр.</div>}
          </div>
        )}
        {ok && (
          <button className="btn primary wide" onClick={next}>
            {qi + 1 < lesson.quiz.length ? 'Келесі сұрақ' : 'Жаттығуға өту'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- ЖАТТЫҚ ---------- */
function summarize(lesson: LessonDef, evs: Evaluation[]): Virtual {
  const hits = evs.filter(e => e.success).length;
  const groups: Part[] = (lesson.groups ?? []).map(g => ({
    label: g.label, total: g.to - g.from, hits: evs.slice(g.from, g.to).filter(e => e.success).length,
  }));
  const v: Virtual = { hits, total: lesson.throws, groups };
  if (lesson.scoring === 'knock') { v.points = evs.reduce((a, e) => a + e.points, 0); v.maxPoints = lesson.throws * 2; }
  return v;
}

function TrainStep({ lesson, onDone }: { lesson: LessonDef; onDone: (v: Virtual) => void }) {
  const [series, setSeries] = useState(0);
  const [evs, setEvs] = useState<Evaluation[]>([]);
  const [recs, setRecs] = useState<ThrowRecord[]>([]);
  const [fbOpen, setFbOpen] = useState(false);
  const [phase, setPhase] = useState('ready');
  const [guide, setGuide] = useState(lesson.guideDefault);
  const [help, setHelp] = useState(false);
  const idx = evs.length - (fbOpen ? 1 : 0);
  const finished = evs.length >= lesson.throws && fbOpen;
  const v = summarize(lesson, evs);
  const last = fbOpen ? evs[evs.length - 1] : null;
  const setup = lesson.setups[Math.min(idx, lesson.setups.length - 1)];

  const onResult = useCallback((r: ThrowRecord) => {
    const s = lesson.setups[Math.min(idx, lesson.setups.length - 1)];
    const e = evaluateThrow(r, lesson.scoring, s);
    recordThrow(e.success, { knock: e.points === 2 });
    setRecs(list => [...list, r]);
    setEvs(list => {
      const next = [...list, e];
      if (next.length === lesson.throws) recordSeries(next.every(x => x.success));
      return next;
    });
    setFbOpen(true);
  }, [lesson, idx]);

  const nextThrow = () => setFbOpen(false);
  const restart = () => { setEvs([]); setRecs([]); setFbOpen(false); setSeries(s => s + 1); };
  const groupNow = lesson.groups?.find(g => idx >= g.from && idx < g.to);

  const actions = last && (
    <>
      <FeedbackBox fb={last.fb} />
      {!finished && <button className="btn primary wide" onClick={nextThrow}>Келесі лақтырыс</button>}
      {finished && (
        <div className="series-end">
          <div className="big-score">{v.hits} / {v.total}</div>
          <div className="muted">
            Виртуалды дәлдік: {Math.round((v.hits / v.total) * 100)}%
            {v.points !== undefined && <> · Ұпай: {v.points} / {v.maxPoints}</>}
          </div>
          {v.groups.length > 0 && (
            <div className="group-line">{v.groups.map(g => <span key={g.label}>{g.label}: <b>{g.hits}/{g.total}</b></span>)}</div>
          )}
          <div className="row">
            <button className="btn ghost" onClick={restart}>Қайталау</button>
            <button className="btn primary" onClick={() => onDone(v)}>Келесі тапсырма</button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="stage-layout">
      <div className="stage-wrap">
        <Trainer
          setup={setup}
          roundKey={`${series}-${idx}`}
          seriesKey={series}
          enabled={!fbOpen && !help}
          showGuide={guide}
          onResult={onResult}
          onPhase={setPhase}
        />
        <div className="hud">
          <div className={`hud-chip lvl lv-${levelOf(lesson.num).id}`}>Деңгей: <b>{levelOf(lesson.num).title}</b></div>
          <div className="hud-chip">Лақтырыс <b>{Math.min(idx + 1, lesson.throws)} / {lesson.throws}</b></div>
          <div className="hud-chip">Дәл <b>{v.hits}</b></div>
          {v.points !== undefined && <div className="hud-chip">Ұпай <b>{v.points}</b></div>}
          {groupNow && <div className="hud-chip">{groupNow.label}</div>}
        </div>
        {!fbOpen && phase === 'ready' && (
          <div className="stage-tip">Көк шеңберді басып, <b>артқа тарт</b> да, жібер</div>
        )}
        {phase === 'flying' && <div className="stage-tip">Сақа ұшып барады…</div>}
        {actions && <div className="stage-sheet">{actions}</div>}
      </div>
      <aside className="panel">
        <h2 className="panel-h">Мақсат</h2>
        <p className="panel-p">{lesson.goal}.</p>
        <div className="rule"><b>Деңгей ережесі.</b> {lesson.rule}</div>
        <div className="dots">
          {Array.from({ length: lesson.throws }).map((_, i) => (
            <span key={i} className={`dot ${i < evs.length ? (evs[i].success ? (evs[i].points === 2 ? 'hit two' : 'hit') : 'miss') : i === idx ? 'cur' : ''}`} />
          ))}
        </div>
        {actions && <div className="desk-only">{actions}</div>}
        <ThrowTable recs={recs} evs={evs} />
        <div className="tools">
          <button className="text-btn" onClick={() => setHelp(true)}>Көмек</button>
          <label className="switch">
            <input type="checkbox" checked={guide} onChange={e => setGuide(e.target.checked)} />
            <span>Көмекші сызық</span>
          </label>
          {!finished && evs.length > 0 && <button className="text-btn" onClick={restart}>Сериясын қайталау</button>}
        </div>
      </aside>
      {help && <Modal title="Қалай лақтырамын?" onClose={() => setHelp(false)}><ControlsHelp /></Modal>}
    </div>
  );
}

/** Лақтырыстар талдауы: әр лақтырыстың бағыт ауытқуы, күші және нәтижесі */
function fmtDeg(d: number) {
  return Math.abs(d) < 0.5 ? 'дәл' : `${Math.abs(d).toFixed(1)}° ${d > 0 ? 'оңға' : 'солға'}`;
}
function ThrowTable({ recs, evs }: { recs: ThrowRecord[]; evs: Evaluation[] }) {
  if (recs.length === 0) return null;
  const avg = recs.reduce((a, r) => a + Math.abs(r.aimErrorDeg), 0) / recs.length;
  return (
    <div className="throws">
      <div className="throws-h">Лақтырыстар талдауы</div>
      <table>
        <thead><tr><th>№</th><th>Бағыт</th><th>Күш</th><th>Нәтиже</th></tr></thead>
        <tbody>
          {recs.map((r, i) => {
            const e = evs[i];
            return (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{fmtDeg(r.aimErrorDeg)}</td>
                <td>{Math.round(r.power * 100)}%</td>
                <td className={e?.success ? 'ok' : 'bad'}>{e ? (e.success ? (e.points === 2 ? '2 ұпай' : 'Дәл') : 'Қате') : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="throws-avg">Орташа бағыт ауытқуы: <b>{avg.toFixed(1)}°</b></div>
    </div>
  );
}

/* ---------- ОРЫНДА ---------- */
export function PracticeCard({ lesson }: { lesson: LessonDef }) {
  const c = lesson.card;
  return (
    <div className="card practice print-card">
      <div className="pc-head">
        <div className="pc-kicker">НАҚТЫ ОРЫНДА · {lesson.num}-сабақ</div>
        <h2>{c.title}</h2>
        <div className="pc-goal">Мақсаты: {c.goal}</div>
      </div>
      <div className="pc-big">{c.task}</div>
      <div className="pc-grid">
        <section>
          <h4>Құрал-жабдық</h4>
          <ul>{c.inventory.map(x => <li key={x}>{x}</li>)}</ul>
          <h4>Жағдай</h4>
          <ul>{c.conditions.map(x => <li key={x}>{x}</li>)}</ul>
        </section>
        <section>
          <h4>Қауіпсіздік</h4>
          <ul>{c.safety.map(x => <li key={x}>{x}</li>)}</ul>
        </section>
      </div>
      <h4>Нұсқаулық</h4>
      <ol>{c.steps.map(x => <li key={x}>{x}</li>)}</ol>
      <div className="pc-success"><b>Сәттілік белгісі:</b> {c.success}</div>
      <div className="pc-fields">
        {c.realFields.map(f => (
          <div key={f.label} className="pc-field-row">
            <span className="pc-fl">{c.realFields.length > 1 ? f.label : 'Лақтырыстар'}:</span>
            <span className="boxes">{Array.from({ length: f.total }).map((_, i) => <span key={i} className="box">{i + 1}</span>)}</span>
            <span>Нәтиже: ____ / {f.total}</span>
          </div>
        ))}
        {c.points && <div>Ұпай: ______</div>}
        <div>Мұғалімнің белгісі: ____________________</div>
        <div>Күні: ______________</div>
      </div>
    </div>
  );
}

function DoStep({ lesson, onNext }: { lesson: LessonDef; onNext: () => void }) {
  return (
    <div className="center-col">
      <PracticeCard lesson={lesson} />
      <p className="note center no-print">Нәтижені қосымша өзі өлшемейді: оны оқушы немесе мұғалім келесі қадамда қолмен енгізеді.</p>
      <div className="row center no-print">
        {/* В опубликованной странице claude.ai печать заблокирована — кнопку не показываем */}
        {import.meta.env.MODE !== 'artifact' && <button className="btn ghost" onClick={() => window.print()}>Карточканы басып шығару</button>}
        <button className="btn primary" onClick={onNext}>Орындадым — нәтижені енгізу</button>
      </div>
    </div>
  );
}

/* ---------- ЖЕТІСТІК ---------- */
const pct = (h: number, t: number) => (t ? Math.round((h / t) * 100) : 0);

function ResultStep({ lesson, virtual, onRestart, onHome, onTrain, onNextLesson }: {
  lesson: LessonDef; virtual: Virtual | null; onRestart: () => void; onHome: () => void; onTrain: () => void; onNextLesson?: () => void;
}) {
  const fields = lesson.card.realFields;
  const [real, setReal] = useState<(number | null)[]>(fields.map(() => null));
  const [easy, setEasy] = useState('');
  const [improve, setImprove] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  if (!virtual) {
    return (
      <div className="center-col">
        <div className="card">
          <p>Виртуалды жаттығу нәтижесі жоқ. Алдымен «ЖАТТЫҚ» қадамын орында.</p>
          <button className="btn primary" onClick={onTrain}>ЖАТТЫҚ қадамына өту</button>
        </div>
      </div>
    );
  }

  const filled = real.every(x => x !== null);
  const realHits = real.reduce<number>((a, x) => a + (x ?? 0), 0);
  const realTotal = fields.reduce((a, f) => a + f.total, 0);
  const paired = fields.length > 1 && virtual.groups.length === fields.length;

  const doSave = () => {
    const date = today();
    const run: LessonRun = {
      virtual,
      real: fields.map((f, i) => ({ label: f.label, total: f.total, hits: real[i] ?? 0 })),
      realDate: date, easy: easy.trim(), improve: improve.trim(), finishedAt: date,
    };
    update(s => {
      const l = s.lessons[lesson.id] ?? { runs: [], completed: false };
      l.runs.push(run);
      l.completed = true;
      s.lessons[lesson.id] = l;
    });
    recordLessonDone(!!easy.trim() && !!improve.trim());
    setSaved(date);
  };

  const setField = (i: number, val: number) => setReal(r => r.map((x, k) => (k === i ? val : x)));

  return (
    <div className="center-col">
      <div className="card">
        <h2 className="panel-h">Екі нәтиже — бөлек</h2>
        <div className="compare">
          <div className="cmp">
            <div className="cmp-k">Виртуалды жаттығу</div>
            <div className="cmp-v">{virtual.hits} / {virtual.total}</div>
            <div className="cmp-bar"><div className="v" style={{ width: `${pct(virtual.hits, virtual.total)}%` }} /></div>
            <div className="muted">
              {pct(virtual.hits, virtual.total)}% · қосымшада тіркелді
              {virtual.points !== undefined && <> · {virtual.points}/{virtual.maxPoints} ұпай</>}
            </div>
          </div>
          <div className="cmp">
            <div className="cmp-k">Нақты асықпен</div>
            <div className="cmp-v">{filled ? realHits : '—'} / {realTotal}</div>
            <div className="cmp-bar"><div className="r" style={{ width: `${filled ? pct(realHits, realTotal) : 0}%` }} /></div>
            <div className="muted">{filled ? `${pct(realHits, realTotal)}% · қолмен енгізілді` : 'енгізілмеген'}</div>
          </div>
        </div>

        {paired && (
          <div className="pairs">
            <div className="pair head"><span /><span>Виртуалды</span><span>Нақты</span></div>
            {fields.map((f, i) => (
              <div key={f.label} className="pair">
                <span className="pair-l">{f.label}</span>
                <span>{virtual.groups[i].hits}/{virtual.groups[i].total}</span>
                <span>{real[i] === null ? '—' : `${real[i]}/${f.total}`}</span>
              </div>
            ))}
          </div>
        )}
        <p className="note">Бұл екі көрсеткіш әртүрлі жағдайда алынған. Қосымша нақты лақтыруды өлшемейді, сондықтан оларды бірдей өлшем деп санамаймыз — тек өз өсуіңді бақылау үшін қатар қоямыз.</p>

        <h3 className="sub-h">Нақты нәтижені енгіз</h3>
        {fields.map((f, i) => (
          <div key={f.label} className="field-block">
            {fields.length > 1 && <div className="fb-label">{f.label}</div>}
            <div className="picker" role="radiogroup" aria-label={f.label}>
              {Array.from({ length: f.total + 1 }).map((_, k) => (
                <button key={k} role="radio" aria-checked={real[i] === k} className={`pick ${real[i] === k ? 'on' : ''}`}
                  disabled={!!saved} onClick={() => setField(i, k)}>{k}</button>
              ))}
            </div>
          </div>
        ))}

        <h3 className="sub-h">Рефлексия</h3>
        <label className="field">Маған не оңай болды?
          <textarea rows={2} value={easy} disabled={!!saved} onChange={e => setEasy(e.target.value)} />
        </label>
        <label className="field">Келесі жолы нені жақсартамын?
          <textarea rows={2} value={improve} disabled={!!saved} onChange={e => setImprove(e.target.value)} />
        </label>

        {!saved ? (
          <button className="btn primary wide" disabled={!filled} onClick={doSave}>
            {filled ? 'Нәтижені сақтау' : 'Алдымен нақты нәтижені таңда'}
          </button>
        ) : (
          <div className="saved">Сақталды · {saved}. Нәтиже тек осы құрылғыда сақталады.</div>
        )}
        <div className="row">
          <button className="btn ghost" onClick={onRestart}>Сабақты қайта бастау</button>
          {saved && onNextLesson ? (
            <button className="btn primary" onClick={onNextLesson}>Келесі сабақ</button>
          ) : (
            <button className="btn ghost" onClick={onHome}>Басты бет</button>
          )}
        </div>
      </div>
    </div>
  );
}
