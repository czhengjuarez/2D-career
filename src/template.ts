import { seedState } from './seed';
import type { AppState } from './types';

/** Where this method comes from — credited in the app and worth reading in full. */
export const SOURCE = {
  title: 'A Remuneration Method For Flat Organizations',
  author: 'Joost Minnaar',
  publisher: 'Corporate Rebels',
  year: '2022',
  url: 'https://www.corporate-rebels.com/blog/remuneration-method-for-flat-organizations',
};

/**
 * Point this at your repository to turn the "contribute" call to action into a link.
 * Left empty on purpose — nothing is invented here.
 */
export const REPO_URL = '';

/**
 * A starting file for anyone who would rather write their framework in JSON than click
 * through the editor: the full structure, one worked track, empty people and scores.
 */
export function buildTemplate(): AppState & { _readme: string[] } {
  const seed = seedState();
  const [example] = seed.tracks;
  return {
    _readme: [
      'Career framework import template.',
      'Levels are always 1 | 2 | 3. On the skills axis they read as A | B | C.',
      'tracks[].capabilities[].levels describes what each level looks like for that capability.',
      'leadership[] is shared by everyone, whatever their track.',
      'bands[].grades are the cells that share a pay figure, written as leadership digit + skill letter.',
      'currency is free text — a symbol, a code, or an empty string for bare numbers.',
      'people[] and assessments[] can stay empty; the app fills them as you use it.',
      'Delete this _readme key if you like — the app ignores unknown fields.',
    ],
    currency: seed.currency,
    tracks: [example],
    leadership: seed.leadership,
    people: [],
    assessments: [],
    bands: seed.bands,
  };
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
