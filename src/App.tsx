import { useEffect, useMemo, useState } from 'react';
import { LessonScreen } from './screens/Lesson';
import { About, Contest, FreeTraining, Home, LessonList, Results, type Route } from './screens/Other';
import { LESSONS, LESSON_AIM, type LessonDef } from './game/lesson';
import { MediaScreen } from './screens/Media';
import { clearAll, getPref, setPref } from './game/storage';
import { onAchievement, type AchDef } from './game/achievements';
import { BoardCtx } from './ui/Common';

export default function App() {
  const [route, setRoute] = useState<Route>('home');
  const [lesson, setLesson] = useState<LessonDef>(LESSON_AIM);
  const [board, setBoardState] = useState<boolean>(() => getPref('board', false));
  const [resetAsk, setResetAsk] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [toasts, setToasts] = useState<(AchDef & { k: number })[]>([]);

  useEffect(() => {
    document.documentElement.classList.toggle('board', board);
  }, [board]);

  useEffect(() => onAchievement(a => {
    const k = Date.now() + Math.random();
    setToasts(t => [...t, { ...a, k }]);
    setTimeout(() => setToasts(t => t.filter(x => x.k !== k)), 4200);
  }), []);

  const ctx = useMemo(() => ({
    board,
    setBoard: (b: boolean) => { setBoardState(b); setPref('board', b); },
    requestReset: () => setResetAsk(true),
  }), [board]);

  const doReset = () => {
    clearAll();
    setResetAsk(false);
    setResetKey(k => k + 1);
    setRoute('home');
  };

  const home = () => setRoute('home');
  const openLesson = (l: LessonDef) => { setLesson(l); setRoute('lesson'); window.scrollTo({ top: 0 }); };
  const nextOf = (l: LessonDef) => LESSONS[LESSONS.indexOf(l) + 1];

  let screen: React.ReactNode;
  switch (route) {
    case 'lessons': screen = <LessonList onHome={home} onOpen={openLesson} />; break;
    case 'lesson': {
      const n = nextOf(lesson);
      screen = <LessonScreen lesson={lesson} onHome={home} onList={() => setRoute('lessons')} onNextLesson={n ? () => openLesson(n) : undefined} />;
      break;
    }
    case 'free': screen = <FreeTraining onHome={home} />; break;
    case 'contest': screen = <Contest onHome={home} />; break;
    case 'about': screen = <About onHome={home} />; break;
    case 'media': screen = <MediaScreen onHome={home} />; break;
    case 'results': screen = <Results onHome={home} onReset={doReset} />; break;
    default: screen = <Home go={setRoute} />;
  }

  return (
    <BoardCtx.Provider value={ctx}>
      <div key={resetKey} className="app">{screen}</div>
      {toasts.length > 0 && (
        <div className="toasts" aria-live="polite">
          {toasts.map(t => (
            <div key={t.k} className="toast"><span className="toast-ic">★</span><span><b>Жетістік: {t.title}</b><br />{t.text}</span></div>
          ))}
        </div>
      )}
      {resetAsk && (
        <div className="modal-bg" onClick={() => setResetAsk(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Барлығын нөлдеу керек пе?</h3>
            <p>Осы құрылғыдағы барлық нәтиже, жетістік және сайыс өшеді, қосымша басты бетке оралады. Келесі оқушы таза бастайды.</p>
            <div className="row">
              <button className="btn ghost" onClick={() => setResetAsk(false)}>Жоқ</button>
              <button className="btn danger" onClick={doReset}>Иә, нөлдеу</button>
            </div>
          </div>
        </div>
      )}
    </BoardCtx.Provider>
  );
}
