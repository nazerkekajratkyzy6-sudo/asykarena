import type { MediaItem } from './media';

// Материалы, которые поставляются вместе с сайтом (фото и видео турнира).
// Они видны всем без облака и не удаляются из интерфейса.
const base = import.meta.env.BASE_URL;

const photos: MediaItem[] = Array.from({ length: 32 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return {
    id: `seed-photo-${n}`,
    title: `Жарыс сәті ${i + 1}`,
    cat: 'contest' as const,
    kind: 'photo' as const,
    lesson: 0,
    url: `${base}media/photo-${n}.jpg`,
    createdAt: 0,
  };
});

const videos: MediaItem[] = [1, 2].map(i => ({
  id: `seed-video-0${i}`,
  title: `Жарыс бейнесі ${i}`,
  cat: 'contest' as const,
  kind: 'video' as const,
  lesson: 0,
  url: `${base}media/video-0${i}.mp4`,
  createdAt: 0,
}));

export const SEED_MEDIA: MediaItem[] = [...videos, ...photos];
