import { afterEach, expect, it } from 'vitest';
import Dexie from 'dexie';
import { createListDatabase, deleteList, ListMissingError, loadList, saveList, type SavedList } from '../../src/storage';

const ids: string[] = [];
function record(name = 'Weekend'): SavedList {
  const id = crypto.randomUUID();
  ids.push(id);

  return { id, name, shoppingList: [{ name: 'milk', checked: true }], fileName: '', createdAt: 1, updatedAt: 1 };
}

afterEach(async () => {
  await Promise.all(ids.splice(0).map(deleteList));
});

it('keeps images and checked items separate across multiple lists in real IndexedDB', async () => {
  const first = { ...record('First'), fileName: 'first.jpg' };
  first.imageId = first.id;
  const second = record('Second');
  const bytes = new Blob(['saved photo'], { type: 'image/jpeg' });
  await saveList(first, bytes, true);
  await saveList(second, null, true);
  await saveList({ ...first, shoppingList: [{ name: 'milk', checked: false }] }, undefined);
  expect((await loadList(first.id))?.shoppingList[0].checked).toBe(false);
  expect(await (await loadList(first.id))?.image?.text()).toBe('saved photo');
  expect((await loadList(second.id))?.shoppingList[0].checked).toBe(true);
  expect((await loadList(second.id))?.image).toBeNull();
  await deleteList(first.id);
  expect(await loadList(first.id)).toBeUndefined();
  expect(await loadList(second.id)).toBeDefined();
  const connection = createListDatabase();
  try {
    expect(await connection.table('images').get(first.id)).toBeUndefined();
  } finally {
    connection.close();
  }
});

it('rejects stale writes after another connection deletes a list', async () => {
  const list = record();
  await saveList(list, null, true);
  const other = createListDatabase();
  try {
    await other.transaction('rw', other.table('lists'), other.table('images'), async () => {
      await other.table('lists').delete(list.id);
      await other.table('images').delete(list.id);
    });
    await expect(saveList({ ...list, name: 'Stale edit' }, undefined)).rejects.toBeInstanceOf(ListMissingError);
    expect(await loadList(list.id)).toBeUndefined();
  } finally {
    other.close();
  }
});

it('rolls back a new list and its photo when the list write fails', async () => {
  const list = record();
  const invalid = { ...list, imageId: list.id, shoppingList: [() => 'not cloneable'] } as unknown as SavedList;
  await expect(saveList(invalid, new Blob(['photo']), true)).rejects.toThrow();
  expect(await loadList(list.id)).toBeUndefined();
  const other = createListDatabase();
  try {
    expect(await other.table('images').get(list.id)).toBeUndefined();
  } finally {
    other.close();
  }
});

it('rejects photo replacements and invalid list names without changing saved data', async () => {
  const list = record();
  list.imageId = list.id;
  await saveList(list, new Blob(['original']), true);
  await expect(saveList(list, new Blob(['replacement']))).rejects.toThrow('already has a photo');
  await expect(saveList({ ...list, name: ' ' }, undefined)).rejects.toThrow('1 to 256');
  await expect(saveList({ ...list, name: 'a'.repeat(257) }, undefined)).rejects.toThrow('1 to 256');
  expect(await (await loadList(list.id))?.image?.text()).toBe('original');
});

it('migrates the version 1 session with its image, order, categories, and checked state', async () => {
  const name = `migration-${crypto.randomUUID()}`;
  const legacy = new Dexie(name);
  legacy.version(1).stores({ sessions: 'id', images: 'id' });
  const items = [{ name: 'apple', checked: true, category: 'Dairy' }, { name: 'milk', checked: false }];
  await legacy.table('sessions').put({ id: 'current', shoppingList: items, categories: true, fileName: 'old.jpg', imageId: 'current' });
  await legacy.table('images').put({ id: 'current', blob: new Blob(['old photo']) });
  legacy.close();
  const upgraded = createListDatabase(name);
  try {
    const list = await upgraded.table('lists').get('current');
    expect(list.name).toBe('Imported list');
    expect(list.shoppingList).toEqual(items);
    expect(list.categories).toBe(true);
    expect(list.imageId).toBe('current');
    expect(await (await upgraded.table('images').get('current')).blob.text()).toBe('old photo');
    expect(await upgraded.table('sessions').count()).toBe(0);
  } finally {
    await upgraded.delete();
  }
});

it('does not create a gallery card for an empty version 1 session', async () => {
  const name = `migration-empty-${crypto.randomUUID()}`;
  const legacy = new Dexie(name);
  legacy.version(1).stores({ sessions: 'id', images: 'id' });
  await legacy.table('sessions').put({ id: 'current', shoppingList: [], fileName: '' });
  legacy.close();
  const upgraded = createListDatabase(name);
  try {
    expect(await upgraded.table('lists').count()).toBe(0);
  } finally {
    await upgraded.delete();
  }
});

it('first photo after creation persists on a list that was saved without a photo', async () => {
  const list = record('Manual list');
  await saveList(list, null, true);
  expect((await loadList(list.id))?.image).toBeNull();
  const withPhoto = { ...list, fileName: 'later.jpg', imageId: list.id };
  await saveList(withPhoto, new Blob(['first photo'], { type: 'image/jpeg' }));
  const loaded = await loadList(list.id);
  expect(loaded?.id).toBe(list.id);
  expect(loaded?.name).toBe(list.name);
  expect(loaded?.shoppingList).toEqual(list.shoppingList);
  expect(loaded?.fileName).toBe('later.jpg');
  expect(await loaded?.image?.text()).toBe('first photo');
});
