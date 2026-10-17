import { afterEach, expect, it } from 'vitest';
import { clearList, createListDatabase, deleteList, ListMissingError, loadList, saveList, type SavedList } from '../../src/storage';

const ids: string[] = [];
function record(): SavedList {
  const id = crypto.randomUUID();
  ids.push(id);

  return { id, name: 'Weekly shop', shoppingList: [{ name: 'milk', checked: true }], categories: true, fileName: 'photo.jpg', imageId: id, createdAt: 1, updatedAt: 1 };
}

afterEach(async () => {
  await Promise.all(ids.splice(0).map(deleteList));
});

it('clear action atomically empties one list and its photo while keeping its identity and other lists', async () => {
  const first = record();
  const other = record();
  await saveList(first, new Blob(['first photo']), true);
  await saveList(other, new Blob(['other photo']), true);
  const cleared = await clearList(first.id);
  expect(cleared).toMatchObject({ id: first.id, name: first.name, categories: true, shoppingList: [], fileName: '', image: null, createdAt: 1 });
  expect(cleared.imageId).toBeUndefined();
  expect(await loadList(first.id)).toEqual(cleared);
  expect((await loadList(other.id))?.shoppingList).toEqual(other.shoppingList);
  expect(await (await loadList(other.id))?.image?.text()).toBe('other photo');
  const connection = createListDatabase();
  try {
    expect(await connection.table('images').get(first.id)).toBeUndefined();
  } finally {
    connection.close();
  }
});

it('clear action permits a new photo on the same saved list', async () => {
  const list = record();
  await saveList(list, new Blob(['original']), true);
  const { image, ...cleared } = await clearList(list.id);
  expect(image).toBeNull();
  const replacement = { ...cleared, imageId: list.id, fileName: 'new.jpg', shoppingList: [{ name: 'bread', checked: false }] };
  await saveList(replacement, new Blob(['replacement']));
  const loaded = await loadList(list.id);
  expect(loaded?.name).toBe(list.name);
  expect(loaded?.shoppingList).toEqual(replacement.shoppingList);
  expect(await loaded?.image?.text()).toBe('replacement');
});

it('clear action rejects an old photo reference from another tab after the photo was cleared', async () => {
  const list = record();
  await saveList(list, new Blob(['original']), true);
  await clearList(list.id);
  await expect(saveList(list, undefined)).rejects.toThrow('saved photo changed');
  expect((await loadList(list.id))?.imageId).toBeUndefined();
});

it('clear action cannot recreate a list that another tab deleted', async () => {
  const list = record();
  await saveList(list, new Blob(['photo']), true);
  await deleteList(list.id);
  await expect(clearList(list.id)).rejects.toBeInstanceOf(ListMissingError);
  expect(await loadList(list.id)).toBeUndefined();
});
