// Векторная графика в стиле ASIQ ARENA: казахский орнамент, юрта и горы, золотой асық.

export function CornerOrnament({ className = '' }: { className?: string }) {
  // «Қошқар мүйіз» — угловой элемент. Зеркалится через CSS.
  return (
    <svg className={className} viewBox="0 0 140 140" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 132 V60 C8 26 34 8 66 8 H132" />
        <path d="M22 132 V68 C22 42 40 22 70 22 H132" opacity=".55" />
        <path d="M40 92 C40 62 64 50 82 62 C96 72 88 92 72 88 C62 86 64 74 72 74" />
        <path d="M92 40 C62 40 50 64 62 82" />
        <path d="M92 40 C108 40 116 54 108 64 C102 72 92 66 96 60" />
        <path d="M40 92 C40 108 54 116 64 108 C72 102 66 92 60 96" />
      </g>
    </svg>
  );
}

export function GoldAsyq({ className = '', red = false }: { className?: string; red?: boolean }) {
  const id = red ? 'gr' : 'gg';
  const [a, b, c] = red ? ['#e07a5a', '#b0442c', '#7d2c1a'] : ['#fbe39a', '#e0b04a', '#a4741f'];
  return (
    <svg className={className} viewBox="0 0 200 120" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset=".55" stopColor={b} />
          <stop offset="1" stopColor={c} />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="108" rx="78" ry="8" fill="#000" opacity=".18" />
      <g fill={`url(#${id})`} stroke={c} strokeWidth="2">
        <ellipse cx="38" cy="58" rx="30" ry="44" />
        <ellipse cx="162" cy="58" rx="30" ry="44" />
        <rect x="40" y="26" width="120" height="66" rx="30" />
      </g>
      <ellipse cx="100" cy="40" rx="30" ry="9" fill={c} opacity=".45" />
      <ellipse cx="74" cy="34" rx="22" ry="6" fill="#fff" opacity=".35" />
      <ellipse cx="30" cy="34" rx="9" ry="14" fill="#fff" opacity=".3" />
    </svg>
  );
}

export function YurtScene({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 260 150" aria-hidden="true">
      <path d="M0 130 L52 52 L80 86 L118 30 L170 112 L196 76 L260 130 Z" fill="#6f93bd" opacity=".55" />
      <path d="M118 30 L104 52 L112 50 L118 58 L126 48 L133 52 Z" fill="#fff" opacity=".9" />
      <path d="M52 52 L44 64 L52 62 L58 68 L62 66 Z" fill="#fff" opacity=".8" />
      <path d="M0 140 C60 120 200 120 260 140 V150 H0 Z" fill="#3f7a4f" opacity=".7" />
      <g transform="translate(78 62)">
        <path d="M6 44 C6 24 30 12 52 12 C74 12 98 24 98 44 Z" fill="#f0cf74" stroke="#a4741f" strokeWidth="2" />
        <rect x="6" y="44" width="92" height="34" fill="#f7e2a4" stroke="#a4741f" strokeWidth="2" />
        <path d="M6 52 H98" stroke="#b0442c" strokeWidth="4" />
        <path d="M6 70 H98" stroke="#b0442c" strokeWidth="3" />
        <rect x="42" y="50" width="20" height="28" rx="2" fill="#8a5a33" />
        <path d="M44 12 H60 L56 4 H48 Z" fill="#a4741f" />
        <path d="M20 30 L34 22 M84 30 L70 22" stroke="#a4741f" strokeWidth="2" />
      </g>
    </svg>
  );
}

type IconName = 'target' | 'bulb' | 'gear' | 'screen' | 'star' | 'video' | 'trophy' | 'chart' | 'play' | 'book' | 'users' | 'route' | 'medal';

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const p: Record<IconName, JSX.Element> = {
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>,
    bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></>,
    gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
    screen: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
    star: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />,
    video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3z" /></>,
    trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" /></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    play: <path d="M8 5v14l11-7z" fill="currentColor" />,
    book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /></>,
    users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.2A5 5 0 0 1 21.5 20" /></>,
    route: <><circle cx="5" cy="18" r="2.5" /><circle cx="19" cy="6" r="2.5" /><path d="M7.5 18H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7.5" /></>,
    medal: <><circle cx="12" cy="15" r="6" /><path d="M8.5 3L12 9l3.5-6M12 12.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p[name]}
    </svg>
  );
}
export type { IconName };
