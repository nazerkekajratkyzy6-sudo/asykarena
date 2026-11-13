// Параметры учебной физики. Это упрощение: масштаб и коэффициенты подобраны для игрового поля,
// а не для точного моделирования реального броска.

export const ASYQ_HALF: [number, number, number] = [0.22, 0.13, 0.15];
export const SAQA_HALF: [number, number, number] = [0.27, 0.16, 0.19];

export const PHYS = {
  groundFriction: 0.9,
  groundRestitution: 0.15,
  bodyFriction: 0.7,
  bodyRestitution: 0.2,
  linearDamping: 0.25,
  angularDamping: 0.8,
  saqaDensity: 4,
  asyqDensity: 1.5,
  launchAngle: 0.3, // рад, ~17° вверх
  speedMin: 3,
  speedRange: 9,
  // Начальное вращение отключено: кувыркающийся бокс отскакивал вбок даже при точном прицеле,
  // и совет «поверни» становился нечестным. Без вращения отклонение от линии прицела < 0,1 м.
  spin: 0,
};

export const SAQA_START: [number, number, number] = [0, SAQA_HALF[1] + 0.01, 0];

export function launchVelocity(dirX: number, dirZ: number, power: number) {
  const v = PHYS.speedMin + power * PHYS.speedRange;
  const c = Math.cos(PHYS.launchAngle);
  return {
    lin: { x: dirX * v * c, y: v * Math.sin(PHYS.launchAngle), z: dirZ * v * c },
    // вращение вокруг оси, перпендикулярной направлению (сақа кувыркается вперёд)
    ang: { x: dirZ * PHYS.spin, y: 0, z: -dirX * PHYS.spin },
  };
}

export type Vec2 = { x: number; z: number };

export interface TargetSetup {
  target: Vec2;
  neighbors: Vec2[];
  limit?: number; // граница за нысаной (м) для правила «control»
  ring?: number;  // радиус кольца нысаны для правила «knock»
}

export interface ThrowRecord {
  hit: boolean;
  neighborHit: boolean;
  power: number;
  aimErrorDeg: number; // + вправо от направления на цель, − влево
  trail: [number, number, number][];
  end: [number, number, number];
  target: Vec2;
  targetMoved: number;
}

export type FeedbackKind = 'hit' | 'right' | 'left' | 'short' | 'over' | 'unknown';

export interface Feedback {
  kind: FeedbackKind;
  title: string;
  text: string;
}

/** Разбор броска по фактической траектории. Совет даётся только когда причина определяется однозначно. */
export function analyzeThrow(r: ThrowRecord): Feedback {
  const sx = SAQA_START[0], sz = SAQA_START[2];
  const tx = r.target.x, tz = r.target.z;
  const dist = Math.hypot(tx - sx, tz - sz);
  const ux = (tx - sx) / dist, uz = (tz - sz) / dist;
  const rx = -uz, rz = ux; // вектор «вправо» относительно линии на цель

  const errTxt = Math.abs(r.aimErrorDeg) < 0.5 ? 'бағыт нысанаға дәл қаралған' :
    `бағыт ${Math.abs(r.aimErrorDeg).toFixed(1)}° ${r.aimErrorDeg > 0 ? 'оңға' : 'солға'} ауытқыған`;
  const powTxt = `күш ${Math.round(r.power * 100)}%`;

  if (r.hit) {
    const moved = r.targetMoved >= 0.05
      ? `Сақа нысанаға тиіп, оны ${r.targetMoved.toFixed(2)} м жылжытты.`
      : 'Сақа нысанаға тиді (нысана орнынан қозғала қойған жоқ).';
    return {
      kind: 'hit',
      title: 'Нысанаға тиді!',
      text: `${moved} Лақтырысыңда ${errTxt}, ${powTxt}. Осы бағытты есте сақта.`,
    };
  }

  // Ближайшая к цели точка траектории
  let best = r.trail[0] ?? r.end, bestD = Infinity;
  for (const p of r.trail) {
    const d = Math.hypot(p[0] - tx, p[2] - tz);
    if (d < bestD) { bestD = d; best = p; }
  }
  const lateral = (best[0] - tx) * rx + (best[2] - tz) * rz;
  const endAlong = (r.end[0] - sx) * ux + (r.end[2] - sz) * uz - dist;
  const maxAlong = Math.max(...r.trail.map(p => (p[0] - sx) * ux + (p[2] - sz) * uz)) - dist;
  const sideTol = 0.42;
  const neighbor = r.neighborHit ? ' Сақа көрші асыққа тиді.' : '';

  if (Math.abs(lateral) > sideTol && maxAlong > -0.6) {
    const right = lateral > 0;
    if (Math.abs(r.aimErrorDeg) < 1.5) {
      return {
        kind: 'unknown',
        title: right ? 'Сақа нысананың оң жағынан өтті' : 'Сақа нысананың сол жағынан өтті',
        text: `Бағыт нысанаға дәл қаралған (ауытқу ${Math.abs(r.aimErrorDeg).toFixed(1)}°), бірақ сақа жолда${r.neighborHit ? ' көрші асыққа соғылып' : ' секіріп'}, ${right ? 'оңға' : 'солға'} ауытқыды. Бағытты өзгертпе — тағы байқап көр.`,
      };
    }
    return {
      kind: right ? 'right' : 'left',
      title: right ? 'Сақа нысананың оң жағынан өтті' : 'Сақа нысананың сол жағынан өтті',
      text: `Нысанаға дейінгі ауытқу ≈ ${Math.abs(lateral).toFixed(2)} м.${neighbor} Келесі жолы бағытты сәл ${right ? 'солға' : 'оңға'} бұр (${errTxt}).`,
    };
  }
  if (maxAlong < -0.35) {
    return {
      kind: 'short',
      title: 'Сақа нысанаға жетпеді',
      text: `Нысанаға дейін ≈ ${Math.abs(maxAlong).toFixed(2)} м жетпеді (${powTxt}). Келесі жолы күшті сәл арттыр.`,
    };
  }
  if (best[1] > ASYQ_HALF[1] * 2 + 0.05 && endAlong > 0) {
    return {
      kind: 'over',
      title: 'Сақа нысананың үстінен ұшып өтті',
      text: `Сақа нысананың үстінен өтіп, ${endAlong.toFixed(2)} м әрі түсті (${powTxt}). Келесі жолы күшті сәл азайт.`,
    };
  }
  return {
    kind: 'unknown',
    title: 'Сақа нысанаға тимеді',
    text: `Сақа нысанаға ${bestD.toFixed(2)} м жақындады.${neighbor} Себебін бір мәнді анықтау мүмкін емес — траекторияға қарап, тағы байқап көр.`,
  };
}

/** Учебная оценка броска по явному правилу уровня. */
export interface Evaluation {
  fb: Feedback;
  success: boolean; // засчитан как «дәл лақтырыс»
  points: number;   // для правила «knock»
}

export function alongBeyondTarget(r: ThrowRecord) {
  const sx = SAQA_START[0], sz = SAQA_START[2];
  const dx = r.target.x - sx, dz = r.target.z - sz;
  const d = Math.hypot(dx, dz);
  return ((r.end[0] - sx) * dx + (r.end[2] - sz) * dz) / d - d;
}

export function evaluateThrow(r: ThrowRecord, scoring: 'hit' | 'control' | 'knock', setup?: { limit?: number; ring?: number }): Evaluation {
  const base = analyzeThrow(r);
  if (scoring === 'hit') return { fb: base, success: r.hit, points: r.hit ? 1 : 0 };

  if (scoring === 'control') {
    const limit = setup?.limit ?? 1.5;
    if (!r.hit) return { fb: base, success: false, points: 0 };
    const beyond = alongBeyondTarget(r);
    if (beyond > limit) {
      return {
        fb: {
          kind: 'over',
          title: 'Тиді, бірақ күш артық',
          text: `Сақа нысанаға тиді, бірақ нысанадан ${beyond.toFixed(2)} м әрі тоқтап, шекарадан асып кетті (күш ${Math.round(r.power * 100)}%). Бұл қашықтыққа күшті сәл азайт.`,
        },
        success: false, points: 0,
      };
    }
    return {
      fb: {
        kind: 'hit',
        title: 'Дәл әрі бақыланған лақтырыс!',
        text: `Сақа нысанаға тиіп, шекарадан бұрын тоқтады (нысанадан ${Math.max(0, beyond).toFixed(2)} м әрі). Күш ${Math.round(r.power * 100)}% осы қашықтыққа сай келді.`,
      },
      success: true, points: 1,
    };
  }

  // knock
  const R = setup?.ring ?? 0.6;
  if (!r.hit) return { fb: base, success: false, points: 0 };
  if (r.targetMoved > R) {
    return {
      fb: { kind: 'hit', title: 'Шеңберден шығардың! +2 ұпай', text: `Нысана ${r.targetMoved.toFixed(2)} м жылжып, сары шеңберден шықты. Бағыт та, күш те дұрыс.` },
      success: true, points: 2,
    };
  }
  return {
    fb: { kind: 'hit', title: 'Нысанаға тиді: +1 ұпай', text: `Нысана ${r.targetMoved.toFixed(2)} м жылжыды, бірақ шеңберде қалды (шеңбер радиусы ${R} м).` },
    success: true, points: 1,
  };
}
