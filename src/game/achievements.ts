import { LESSONS } from './lesson';
import { load, today, update, type Store } from './storage';

export interface AchDef { id: string; title: string; text: string }

export const ACHIEVEMENTS: AchDef[] = [
  { id: 'first-throw', title: 'Алғашқы лақтырыс', text: 'Сақаны бірінші рет лақтырдың' },
  { id: 'first-hit', title: 'Алғашқы дәл лақтырыс', text: 'Сақа нысанаға алғаш рет тиді' },
  { id: 'streak3', title: 'Қатарынан үшеу', text: 'Қатарынан 3 дәл лақтырыс' },
  { id: 'streak5', title: 'Қатарынан бесеу', text: 'Қатарынан 5 дәл лақтырыс' },
  { id: 'perfect', title: 'Мінсіз серия', text: 'Сабақтағы барлық виртуалды лақтырыс дәл болды' },
  { id: 'knock', title: 'Шеңберден шығару', text: 'Нысананы шеңберден шығардың' },
  { id: 'lesson', title: 'Бірінші сабақ', text: 'Бір сабақты КӨР-ден ЖЕТІСТІК-ке дейін өттің' },
  { id: 'reflect', title: 'Ойлана білу', text: 'Рефлексияның екі сұрағына да жауап бердің' },
  { id: 'all', title: 'Мерген жолы', text: 'Бес сабақтың бәрін аяқтадың' },
  { id: 'contest', title: 'Сайыскер', text: 'Мергендер сайысын соңына дейін өткіздің' },
  { id: 'free50', title: 'Тынымсыз', text: 'Еркін жаттығуда 50 лақтырыс' },
];

const EVT = 'asiq-ach';

function grant(s: Store, id: string, out: string[]) {
  if (!s.ach[id]) { s.ach[id] = today(); out.push(id); }
}

function announce(ids: string[]) {
  for (const id of ids) {
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (a) window.dispatchEvent(new CustomEvent(EVT, { detail: a }));
  }
}

export function onAchievement(fn: (a: AchDef) => void) {
  const h = (e: Event) => fn((e as CustomEvent<AchDef>).detail);
  window.addEventListener(EVT, h);
  return () => window.removeEventListener(EVT, h);
}

/** Учёт каждого виртуального броска (урок, свободная тренировка, сайыс) */
export function recordThrow(success: boolean, opts: { knock?: boolean; free?: boolean } = {}) {
  const got: string[] = [];
  update(s => {
    s.stats.throws += 1;
    if (success) { s.stats.hits += 1; s.stats.streak += 1; } else s.stats.streak = 0;
    s.stats.bestStreak = Math.max(s.stats.bestStreak, s.stats.streak);
    if (opts.free) { s.free.throws += 1; s.free.hits += success ? 1 : 0; }
    grant(s, 'first-throw', got);
    if (success) grant(s, 'first-hit', got);
    if (s.stats.streak >= 3) grant(s, 'streak3', got);
    if (s.stats.streak >= 5) grant(s, 'streak5', got);
    if (opts.knock) grant(s, 'knock', got);
    if (s.free.throws >= 50) grant(s, 'free50', got);
  });
  announce(got);
}

export function recordSeries(allHit: boolean) {
  const got: string[] = [];
  update(s => { if (allHit) grant(s, 'perfect', got); });
  announce(got);
}

export function recordLessonDone(reflected: boolean) {
  const got: string[] = [];
  update(s => {
    grant(s, 'lesson', got);
    if (reflected) grant(s, 'reflect', got);
    if (LESSONS.every(l => s.lessons[l.id]?.completed)) grant(s, 'all', got);
  });
  announce(got);
}

export function recordContest() {
  const got: string[] = [];
  update(s => grant(s, 'contest', got));
  announce(got);
}

export const unlocked = () => load().ach;
