import { createContext, useContext, useEffect, useState } from 'react';
import { STEPS } from '../game/lesson';
import type { Feedback } from '../game/physics';
import { CornerOrnament, Icon, type IconName } from './Art';

export function Ornament({ className = '' }: { className?: string }) {
  // Стилизованный «қошқар мүйіз»
  return (
    <svg className={`orn ${className}`} viewBox="0 0 120 40" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M60 36 V20 C60 6 42 4 43 16 C44 23 51 22 50 16" />
        <path d="M60 20 C60 6 78 4 77 16 C76 23 69 22 70 16" />
        <path d="M30 30 C22 30 18 22 24 18 C28 16 31 20 28 22" />
        <path d="M90 30 C98 30 102 22 96 18 C92 16 89 20 92 22" />
        <path d="M30 30 H50 M70 30 H90" />
      </g>
    </svg>
  );
}

/** Полоса-заголовок раздела в стиле плаката: голубая лента, иконка в круге */
export function SectionBar({ icon, title, right }: { icon: IconName; title: string; right?: React.ReactNode }) {
  return (
    <div className="section-bar">
      <span className="sb-ic"><Icon name={icon} size={20} /></span>
      <h2>{title}</h2>
      {right}
    </div>
  );
}

export function useFullscreen() {
  const [fs, setFs] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  const supported = !!document.documentElement.requestFullscreen;
  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  return { fs, toggle, supported };
}

/** Режим интерактивной панели: крупные элементы, полный экран, быстрое обнуление */
export const BoardCtx = createContext<{ board: boolean; setBoard: (b: boolean) => void; requestReset: () => void }>({
  board: false, setBoard: () => undefined, requestReset: () => undefined,
});
export const useBoard = () => useContext(BoardCtx);

export function TopBar({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  const { fs, toggle, supported } = useFullscreen();
  const { board, requestReset } = useBoard();
  return (
    <header className="topbar">
      <CornerOrnament className="tb-orn l" />
      <CornerOrnament className="tb-orn r" />
      <button className="icon-btn" onClick={onBack} aria-label="Басты бет">
        <svg viewBox="0 0 24 24" width="22" height="22"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div className="topbar-title">{title}</div>
      <div className="topbar-right">
        {right}
        {board && <button className="text-btn reset-btn" onClick={requestReset}>Нөлдеу</button>}
        {supported && (
          <button className="icon-btn" onClick={toggle} aria-label={fs ? 'Толық экраннан шығу' : 'Толық экран'} title={fs ? 'Толық экраннан шығу' : 'Толық экран'}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              {fs ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}

export function Stepper({ step, maxStep, onGo }: { step: number; maxStep: number; onGo: (i: number) => void }) {
  return (
    <nav className="stepper" aria-label="5ҚАДАМ">
      {STEPS.map((s, i) => {
        const state = i === step ? 'cur' : i < maxStep || (i <= maxStep && i !== step) ? 'done' : 'todo';
        const can = i <= maxStep && i !== step;
        return (
          <button key={s} className={`step ${state}`} disabled={!can} onClick={() => onGo(i)} aria-current={i === step ? 'step' : undefined}>
            <span className="step-n">{state === 'done' ? '✓' : i + 1}</span>
            <span className="step-t">{s}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function FeedbackBox({ fb }: { fb: Feedback }) {
  const icon = fb.kind === 'hit' ? '✓' : fb.kind === 'right' ? '→' : fb.kind === 'left' ? '←' : fb.kind === 'short' ? '↑' : fb.kind === 'over' ? '↓' : '•';
  return (
    <div className={`fb ${fb.kind === 'hit' ? 'ok' : 'miss'}`}>
      <span className="fb-icon">{icon}</span>
      <div>
        <div className="fb-title">{fb.title}</div>
        <div className="fb-text">{fb.text}</div>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
        <h3>{title}</h3>
        {children}
        <button className="btn primary wide" onClick={onClose}>Түсінікті</button>
      </div>
    </div>
  );
}

export function ControlsHelp() {
  return (
    <ol className="help-list">
      <li>Сақаның айналасындағы көк шеңберді саусақпен немесе тінтуірмен бас.</li>
      <li>Басқан күйде <b>артқа қарай тарт</b>: сақа тартқан жағыңа қарама-қарсы ұшады.</li>
      <li>Сары сызық — бағыт, ұзындығы мен «Күш» шкаласы — лақтыру күші.</li>
      <li>Саусақты жібер — сақа ұшады. Тоқтағаннан кейін нәтиже мен кеңес шығады.</li>
      <li>Көк сызық — сақаның нақты жүрген жолы.</li>
    </ol>
  );
}
