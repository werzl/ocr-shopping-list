import Dexie, { type Table } from 'dexie';
import type { Category } from './categories';

export interface ShoppingListItem {
  name: string;
  checked: boolean;
  category?: Category | 'Eggs' | 'Veg';
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
  id: string;
  blob: Blob;
}

// Keep each schema version fixed when adding future migrations.
const INITIAL_SCHEMA_VERSION = 1;

export function createListDatabase(name = 'HandyList'): Dexie {
  const db = new Dexie(name);
  db.version(INITIAL_SCHEMA_VERSION).stores({ sessions: 'id', images: 'id' });
  db.version(2).stores({ sessions: 'id', images: 'id', lists: 'id, updatedAt' }).upgrade(async transaction => {
    const previous = await transaction.table<SavedSession>('sessions').get('current');
    if (previous && (previous.shoppingList.length > 0 || previous.imageId)) {
      await transaction.table('lists').put({
        ...previous, name: 'Imported list', createdAt: Date.now(), updatedAt: Date.now(),
      });
    }

    await transaction.table('sessions').delete('current');
  });

  return db;
}

const db = createListDatabase();
const sessions: Table<SavedSession, string> = db.table('sessions');
const images: Table<SavedImage, string> = db.table('images');
const lists: Table<SavedList, string> = db.table('lists');
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

export interface SavedList {
  id: string;
  name: string;
  shoppingList: ShoppingListItem[];
  imageId?: string;
  categories?: boolean;
  fileName: string;
  createdAt: number;
  updatedAt: number;
}

export interface LoadedList extends SavedList {
  image: Blob | null;
}

export class ListMissingError extends Error {
  constructor() {
    super('This list no longer exists.');
    this.name = 'ListMissingError';
  }
}

export function defaultListName(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} - ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function listLists(): Promise<SavedList[]> {
  return lists.orderBy('updatedAt').reverse().toArray();
}

export async function loadListImage(id: string): Promise<Blob | null> {
  const record = await images.get(id);

  return record?.blob ?? null;
}

export function loadList(id: string): Promise<LoadedList | undefined> {
  return db.transaction('r', lists, images, async () => {
    const list = await lists.get(id);
    if (!list)
      return undefined;

    const image = list.imageId ? await loadListImage(list.imageId) : null;
    if (list.imageId && !image)
      throw new Error('The saved photo is missing.');

    return { ...list, image };
  });
}

export async function saveList(list: SavedList, image: Blob | null | undefined, create = false): Promise<void> {
  if (!list.name.trim() || list.name.length > 256)
    throw new Error('Enter a list name with 1 to 256 characters.');

  await db.transaction('rw', lists, images, async () => {
    const existing = await lists.get(list.id);
    if (!create && !existing)
      throw new ListMissingError();

    if (create && existing)
      throw new Error('A list with this ID already exists.');

    if (existing?.imageId && (list.imageId !== existing.imageId || image !== undefined))
      throw new Error('This list already has a photo.');

    if (create && list.imageId && !image)
      throw new Error('The new list photo is missing.');

    if (list.imageId && !image && list.imageId !== existing?.imageId)
      throw new Error('The saved photo changed. Reload this list before saving.');

    if (list.imageId && list.imageId !== list.id)
      throw new Error('The photo must belong to this list.');

    if (image)
      await images.put({ id: list.id, blob: image });

    if (create)
      await lists.add(list);
    else
      await lists.put(list);
  });
}

export function clearList(id: string): Promise<LoadedList> {
  return db.transaction('rw', lists, images, async () => {
    const existing = await lists.get(id);
    if (!existing)
      throw new ListMissingError();

    const { imageId, ...record } = existing;
    const cleared = { ...record, shoppingList: [], fileName: '', updatedAt: Date.now() };
    await images.delete(imageId ?? id);
    await lists.put(cleared);

    return { ...cleared, image: null };
  });
}

export async function deleteList(id: string): Promise<void> {
  await db.transaction('rw', lists, images, async () => {
    await images.delete(id);
    await lists.delete(id);
  });
}
