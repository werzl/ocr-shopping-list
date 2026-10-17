import Dexie, { type Table } from 'dexie';

export interface ShoppingListItem {
  name: string;
  checked: boolean;
}

export interface SavedSession {
  id: 'current';
  shoppingList: ShoppingListItem[];
  imageId?: 'current';
  categories?: boolean;
  fileName: string;
}

export interface LoadedSession extends SavedSession {
  image: Blob | null;
}

interface SavedImage {
  id: 'current';
  blob: Blob;
}

// Keep each schema version fixed when adding future migrations.
const INITIAL_SCHEMA_VERSION = 1;

const db = new Dexie('HandyList');
db.version(INITIAL_SCHEMA_VERSION).stores({ sessions: 'id', images: 'id' });
const sessions: Table<SavedSession, string> = db.table('sessions');
const images: Table<SavedImage, string> = db.table('images');
const obsoleteStorageKeys = ['base64Image', 'base64FileName', 'shoppingList'];

export async function loadSession(): Promise<LoadedSession> {
  const existing = await db.transaction('r', sessions, images, async () => {
    const session = await sessions.get('current');
    if (!session)
      return undefined;

    const image = session.imageId ? await images.get(session.imageId) : undefined;
    if (session.imageId && !image)
      throw new Error('Saved image is missing');

    return { ...session, image: image?.blob ?? null };
  });

  try {
    obsoleteStorageKeys.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    // A blocked localStorage API must not prevent IndexedDB use.
    console.warn('Could not remove old localStorage data.', error);
  }

  if (existing)
    return existing;

  return { id: 'current', shoppingList: [], fileName: '', image: null };
}

// Omitted imageChange leaves image bytes untouched; null explicitly clears them.
export async function saveSession(session: SavedSession, imageChange?: Blob | null): Promise<void> {
  if (imageChange === undefined) {
    await sessions.put(session);

    return;
  }

  await db.transaction('rw', sessions, images, async () => {
    if (imageChange) {
      await images.put({ id: 'current', blob: imageChange });
    } else {
      await images.delete('current');
    }

    await sessions.put(session);
  });
}

export function isStorageFull(error: unknown): boolean {
  if (!error || typeof error !== 'object')
    return false;

  const failure = error as { name?: string; inner?: unknown };

  return failure.name === 'QuotaExceededError' ||
    (failure.inner !== error && isStorageFull(failure.inner));
}
