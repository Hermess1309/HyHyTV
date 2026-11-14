export interface ContinueWatchingItem {
  id: string;
  slug: string;
  title: string;
  posterPath: string;
  backdropPath?: string;
  mediaType: 'movie' | 'tv';
  episodeName?: string;
  episodeIndex?: number;
  serverName?: string;
  currentTime: number;
  duration: number;
  progress: number; // percentage 0-100
  lastWatched: number;
  source?: 'kkphim' | 'vsmov';
}

const STORAGE_KEY = 'hyhy_continue_watching';

export function getContinueWatching(): ContinueWatchingItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      return list.sort((a, b) => b.lastWatched - a.lastWatched);
    }
  } catch (e) {
    console.warn('Failed to parse continue watching list', e);
  }
  return [];
}

export function saveContinueWatching(
  item: Omit<ContinueWatchingItem, 'lastWatched' | 'progress'> & { progress?: number }
): void {
  try {
    const list = getContinueWatching();
    if (item.duration <= 0) return;
    const progress = Math.min(100, Math.round((item.currentTime / item.duration) * 100));

    // If watched > 96%, consider completed and remove
    if (progress >= 96) {
      removeContinueWatching(item.slug);
      return;
    }
    // Only save if watched at least 5 seconds
    if (item.currentTime < 5) return;

    const existingIdx = list.findIndex((x) => x.slug === item.slug);
    const updatedItem: ContinueWatchingItem = {
      ...item,
      progress,
      lastWatched: Date.now(),
    };

    if (existingIdx >= 0) {
      list[existingIdx] = updatedItem;
    } else {
      list.unshift(updatedItem);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 20)));
  } catch (e) {
    console.warn('Failed to save continue watching', e);
  }
}

export function removeContinueWatching(slug: string): void {
  try {
    const list = getContinueWatching().filter((x) => x.slug !== slug);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to remove continue watching item', e);
  }
}
