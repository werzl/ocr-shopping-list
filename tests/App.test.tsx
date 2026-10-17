import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-toastify';
import App from '../src/App';
import { clearList, defaultListName, deleteList, listLists, loadList, saveList, type LoadedList } from '../src/storage';
import { compressImage } from '../src/compressImage';
import * as listMotion from '../src/listMotion';
import * as itemVisibility from '../src/itemVisibility';

const { records, observers, recogniseHandwriting, testApiKey, clientMock } = vi.hoisted(() => {
  const recogniseHandwriting = vi.fn();
  const testApiKey = vi.fn();

  return {
    records: new Map<string, import('../src/storage').LoadedList>(),
    observers: new Set<() => Promise<void>>(),
    recogniseHandwriting, testApiKey,
    clientMock: vi.fn().mockImplementation(() => ({ recogniseHandwriting, testApiKey })),
  };
});

vi.mock('dexie', async original => ({
  ...await original<typeof import('dexie')>(),
  liveQuery: (query: () => Promise<unknown>) => ({
    subscribe(observer: { next: (value: unknown) => void; error: (error: unknown) => void }) {
      const run = async () => { try { observer.next(await query()); } catch (error) { observer.error(error); } };
      observers.add(run);
      void run();

      return { unsubscribe: () => observers.delete(run) };
    },
  }),
}));
vi.mock('../src/storage', async original => ({
  ...await original<typeof import('../src/storage')>(),
  listLists: vi.fn(async () => [...records.values()]),
  loadList: vi.fn(async (id: string) => records.get(id)),
  loadListImage: vi.fn(async (id: string) => records.get(id)?.image ?? null),
  saveList: vi.fn(async (list: LoadedList, image: Blob | undefined) => {
    records.set(list.id, { ...list, image: image ?? records.get(list.id)?.image ?? null });
    await Promise.all([...observers].map(run => run()));
  }),
  clearList: vi.fn(async (id: string) => {
    const existing = records.get(id)!;
    const cleared = { ...existing, shoppingList: [], image: null, fileName: '' };
    delete cleared.imageId;
    records.set(id, cleared);
    await Promise.all([...observers].map(run => run()));

    return cleared;
  }),
  deleteList: vi.fn(async (id: string) => {
    records.delete(id);
    await Promise.all([...observers].map(run => run()));
  }),
}));
vi.mock('../src/compressImage', () => ({ compressImage: vi.fn(async (file: File) => file) }));
vi.mock('../src/openai/OpenAiWrapper', () => ({ default: clientMock }));
vi.mock('react-toastify', () => ({ ToastContainer: () => null, toast: { error: vi.fn(), info: vi.fn() } }));

function saved(id = 'first', name = 'Weekly shop'): LoadedList {
  return { id, name, shoppingList: [{ name: 'milk', checked: true }], image: null, fileName: '', createdAt: 1, updatedAt: 1 };
}

async function enter() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Continue without a key' }));
  await screen.findByRole('button', { name: 'Add list' });

  return user;
}

async function create(user: ReturnType<typeof userEvent.setup>, name: string, item?: string) {
  await user.click(screen.getByRole('button', { name: 'Add list' }));
  await user.clear(screen.getByLabelText('List name'));
  await user.type(screen.getByLabelText('List name'), name);
  if (item) {
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await user.type(screen.getByLabelText('Item 1 name'), item);
  }

  await user.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled());
}

describe('multiple lists', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  beforeEach(() => {
    records.clear();
    observers.clear();
    vi.clearAllMocks();
    clientMock.mockImplementation(() => ({ recogniseHandwriting, testApiKey }));
    testApiKey.mockResolvedValue([]);
    recogniseHandwriting.mockResolvedValue('milk,bread,milk');
    vi.stubGlobal('scrollBy', vi.fn());
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:preview');
      static revokeObjectURL = vi.fn();
    });
  });

  it('creates separate manual lists and restores their names and checkboxes', async () => {
    const user = await enter();
    expect(screen.getByText('Your next shop starts here')).toBeVisible();
    await create(user, 'Saturday', 'apples');
    await user.click(screen.getByRole('checkbox', { name: 'apples' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('No photo')).toBeVisible();
    await create(user, 'Sunday', 'bread');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('2 saved lists')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Open Saturday' }));
    expect(await screen.findByRole('checkbox', { name: 'apples' })).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'bread' })).not.toBeInTheDocument();
    expect(screen.queryByAltText('Full source photo')).not.toBeInTheDocument();
  });

  it('removes the gallery thumbnail when another tab clears the photo', async () => {
    records.set('first', { ...saved(), imageId: 'first', image: new Blob(['photo']), fileName: 'old.jpg' });
    await enter();
    const card = screen.getByRole('button', { name: 'Open Weekly shop' });
    await waitFor(() => expect(card.querySelector('img')).toHaveAttribute('src', 'blob:preview'));
    await act(async () => { await clearList('first'); });
    expect(within(card).getByLabelText('No photo')).toBeVisible();
    expect(card.querySelector('img')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('uses a timestamp name, limits names to 256 characters, and cancels unsaved lists', async () => {
    expect(defaultListName(new Date(2026, 9, 17, 9, 3, 2))).toBe('17/10/2026 - 09:03:02');
    const user = await enter();
    await user.click(screen.getByRole('button', { name: 'Add list' }));
    expect((screen.getByLabelText('List name') as HTMLInputElement).value).toMatch(/^\d{2}\/\d{2}\/\d{4} - \d{2}:\d{2}:\d{2}$/);
    expect(screen.getByLabelText('List name')).toHaveAttribute('maxlength', '256');
    expect(screen.getByText('No items yet, tap + to add one')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('0 saved lists')).toBeVisible();
    expect(saveList).not.toHaveBeenCalled();
  });

  it.each(['new', 'saved'])('Enter creates and focuses the next empty item in a %s list editor', async kind => {
    if (kind === 'saved')
      records.set('first', saved());

    const user = await enter();
    await user.click(screen.getByRole('button', { name: kind === 'new' ? 'Add list' : 'Open Weekly shop' }));
    if (kind === 'saved')
      await user.click(await screen.findByRole('button', { name: 'Edit' }));

    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const first = kind === 'new' ? 1 : 2;
    await user.type(screen.getByLabelText(`Item ${first} name`), ' apples {Enter}');
    expect(screen.getByLabelText(`Item ${first + 1} name`)).toHaveFocus();
    expect(screen.getByLabelText(`Item ${first + 1} name`)).toHaveValue('');
    await user.keyboard('{Enter}');
    expect(screen.queryByLabelText(`Item ${first + 2} name`)).not.toBeInTheDocument();
    await user.keyboard('bread{Enter}');
    expect(screen.getByLabelText(`Item ${first + 2} name`)).toHaveFocus();
    expect(screen.getByLabelText(`Item ${first + 2} name`)).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('checkbox', { name: 'bread' });
    const items = [...records.values()][0].shoppingList;
    expect(items.map(item => item.name)).toEqual(kind === 'new' ? ['apples', 'bread'] : ['milk', 'apples', 'bread']);
    if (kind === 'saved')
      expect(items[0].checked).toBe(true);
  });

  it('Enter keeps manual item entry focused while saves wait and persists every completed item', async () => {
    records.set('first', saved());
    const user = await enter();
    await user.click(screen.getByRole('button', { name: 'Open Weekly shop' }));
    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    const persist = vi.mocked(saveList).getMockImplementation()!;
    vi.mocked(saveList).mockImplementationOnce(async (...args) => {
      await pending;
      await persist(...args);
    });
    const input = screen.getByRole('textbox', { name: 'New item name' });
    await user.type(input, ' apples {Enter}');
    expect(input).toHaveFocus();
    expect(input).toHaveValue('');
    expect(input.closest('[inert]')).toBeNull();
    expect(screen.getByRole('region', { name: 'Shopping list' })).toHaveAttribute('aria-busy', 'true');
    await user.keyboard('bread{Enter}');
    expect(input).toHaveFocus();
    expect(input).toHaveValue('');
    await user.keyboard('{Enter}');
    await act(async () => finish());
    await waitFor(() => expect(records.get('first')?.shoppingList).toEqual([
      { name: 'milk', checked: true }, { name: 'apples', checked: false }, { name: 'bread', checked: false },
    ]));
    expect(input).toHaveFocus();
    await user.keyboard('eggs');
    await user.click(screen.getByRole('button', { name: 'Confirm new item' }));
    await waitFor(() => expect(records.get('first')?.shoppingList.at(-1)?.name).toBe('eggs'));
    expect(screen.queryByRole('textbox', { name: 'New item name' })).not.toBeInTheDocument();
  });

  it.each(['new', 'saved'])('Enter waits for text composition in a %s list', async kind => {
    if (kind === 'saved')
      records.set('first', saved());

    const user = await enter();
    await user.click(screen.getByRole('button', { name: kind === 'new' ? 'Add list' : 'Open Weekly shop' }));
    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    const input = screen.getByLabelText(kind === 'new' ? 'Item 1 name' : 'New item name');
    await user.type(input, 'apples');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', repeat: true });
    expect(input).toHaveFocus();
    expect(input).toHaveValue('apples');
    expect(screen.queryByLabelText('Item 2 name')).not.toBeInTheDocument();
    expect(saveList).not.toHaveBeenCalled();
  });

  it.each(['new', 'saved'])('reveals the next empty row after Enter renders it in a %s list', async kind => {
    if (kind === 'saved')
      records.set('first', saved());

    const stop = vi.fn();
    const reveal = vi.spyOn(itemVisibility, 'keepItemVisible').mockReturnValue(stop);
    const user = await enter();
    await user.click(screen.getByRole('button', { name: kind === 'new' ? 'Add list' : 'Open Weekly shop' }));
    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    const input = screen.getByLabelText(kind === 'new' ? 'Item 1 name' : 'New item name');
    await user.type(input, 'apples{Enter}');
    const next = screen.getByLabelText(kind === 'new' ? 'Item 2 name' : 'New item name');
    expect(next).toHaveFocus();
    expect(next).toHaveValue('');
    expect(reveal).toHaveBeenLastCalledWith(next, expect.any(Function));
    expect(stop).toHaveBeenCalledOnce();
    expect(reveal).toHaveBeenCalledTimes(2);
    await user.keyboard('{Enter}');
    expect(reveal).toHaveBeenCalledTimes(2);
  });

  it.each(['new', 'edit', 'saved'])('removes an empty new row on blur in %s mode without removing completed items', async kind => {
    if (kind !== 'new')
      records.set('first', saved());

    vi.spyOn(itemVisibility, 'keepItemVisible').mockReturnValue(vi.fn());
    const user = await enter();
    await user.click(screen.getByRole('button', { name: kind === 'new' ? 'Add list' : 'Open Weekly shop' }));
    if (kind === 'edit')
      await user.click(await screen.findByRole('button', { name: 'Edit' }));

    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    const name = kind === 'saved' ? 'New item name' : `Item ${kind === 'new' ? 1 : 2} name`;
    await user.type(screen.getByLabelText(name), 'apples{Enter}');
    const emptyName = kind === 'saved' ? 'New item name' : `Item ${kind === 'new' ? 2 : 3} name`;
    const empty = screen.getByLabelText(emptyName);
    await user.type(empty, '   ');
    await user.tab();
    expect(screen.queryByLabelText(emptyName)).not.toBeInTheDocument();
    if (kind !== 'saved')
      await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('checkbox', { name: 'apples' })).toBeVisible();
    await waitFor(() => expect([...records.values()][0].shoppingList.map(item => item.name)).toEqual(
      kind === 'new' ? ['apples'] : ['milk', 'apples'],
    ));
    if (kind !== 'new')
      expect(screen.getByRole('checkbox', { name: 'milk' })).toBeChecked();
  });

  it.each(['new', 'edit', 'saved'])('keeps text in a new row on blur in %s mode', async kind => {
    if (kind !== 'new')
      records.set('first', saved());

    vi.spyOn(itemVisibility, 'keepItemVisible').mockReturnValue(vi.fn());
    const user = await enter();
    await user.click(screen.getByRole('button', { name: kind === 'new' ? 'Add list' : 'Open Weekly shop' }));
    if (kind === 'edit')
      await user.click(await screen.findByRole('button', { name: 'Edit' }));

    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    const input = screen.getByLabelText(kind === 'saved' ? 'New item name' : `Item ${kind === 'new' ? 1 : 2} name`);
    await user.type(input, 'apples');
    await user.tab();
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('apples');
  });

  it.each(['new', 'saved'])('removes an empty new row after keyboard dismissal in a %s list', async kind => {
    if (kind === 'saved')
      records.set('first', saved());

    const visibility = vi.spyOn(itemVisibility, 'keepItemVisible').mockReturnValue(vi.fn());
    const user = await enter();
    await user.click(screen.getByRole('button', { name: kind === 'new' ? 'Add list' : 'Open Weekly shop' }));
    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    const name = kind === 'new' ? 'Item 1 name' : 'New item name';
    expect(screen.getByLabelText(name)).toHaveFocus();
    const dismiss = visibility.mock.calls.at(-1)![1]!;
    await act(async () => dismiss());
    expect(screen.queryByLabelText(name)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add item' })).toBeEnabled();
    expect(saveList).not.toHaveBeenCalled();
  });

  it('edits a name and items together and restores the previous draft on Cancel', async () => {
    records.set('first', saved());
    const user = await enter();
    await user.click(screen.getByRole('button', { name: 'Open Weekly shop' }));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('List name'));
    await user.type(screen.getByLabelText('List name'), 'Changed');
    await user.clear(screen.getByLabelText('Item 1 name'));
    await user.type(screen.getByLabelText('Item 1 name'), 'bread');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'Weekly shop' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'milk' })).toBeChecked();
    expect(saveList).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('List name'));
    await user.type(screen.getByLabelText('List name'), 'Changed');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(records.get('first')?.name).toBe('Changed'));
  });

  it('requires confirmation to delete from both the gallery and a saved list', async () => {
    records.set('first', saved());
    records.set('second', saved('second', 'Other shop'));
    const user = await enter();
    await user.click(screen.getByRole('button', { name: 'Delete Weekly shop' }));
    let dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(deleteList).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete Weekly shop' }));
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete list' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open Weekly shop' })).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Open Other shop' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete list' }));
    expect(await screen.findByText('0 saved lists')).toBeVisible();
  });

  it('keeps a deleted card until the modal closes and the pop animation finishes', async () => {
    records.set('first', saved());
    const user = await enter();
    let finish!: () => void;
    const finished = new Promise<void>(resolve => { finish = resolve; });
    const pop = vi.spyOn(listMotion, 'popOutList').mockReturnValue({ finished, cancel: vi.fn() } as unknown as Animation);
    await user.click(screen.getByRole('button', { name: 'Delete Weekly shop' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete list' }));
    await waitFor(() => expect(pop).toHaveBeenCalledOnce());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(records.has('first')).toBe(false);
    expect(screen.getByRole('button', { name: 'Open Weekly shop' })).toBeDisabled();
    expect(pop.mock.calls[0][0]).toBe(screen.getByRole('article'));
    await act(async () => finish());
    expect(await screen.findByText('0 saved lists')).toBeVisible();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add list' })).toBeEnabled();
  });

  it('pops an open list out before returning to the gallery after deletion', async () => {
    records.set('first', saved());
    const user = await enter();
    await user.click(screen.getByRole('button', { name: 'Open Weekly shop' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    let finish!: () => void;
    const finished = new Promise<void>(resolve => { finish = resolve; });
    const pop = vi.spyOn(listMotion, 'popOutList').mockReturnValue({ finished, cancel: vi.fn() } as unknown as Animation);
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete list' }));
    await waitFor(() => expect(pop).toHaveBeenCalledOnce());
    expect(screen.getByRole('heading', { name: 'Weekly shop' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(pop.mock.calls[0][0]).toHaveClass('workspace');
    expect(toast.info).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(await screen.findByText('0 saved lists')).toBeVisible();
  });

  it('does not animate a failed deletion and allows a retry', async () => {
    records.set('first', saved());
    const user = await enter();
    const pop = vi.spyOn(listMotion, 'popOutList');
    vi.mocked(deleteList).mockRejectedValueOnce(new Error('Access denied'));
    await user.click(screen.getByRole('button', { name: 'Delete Weekly shop' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete list' }));
    expect(toast.error).toHaveBeenCalledWith('Could not delete this list: Access denied');
    expect(pop).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(records.has('first')).toBe(true);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete list' }));
    expect(await screen.findByText('0 saved lists')).toBeVisible();
    expect(pop).toHaveBeenCalledOnce();
  });

  it('pops a new list into view and cancels the animation when the draft closes', async () => {
    const user = await enter();
    const cancel = vi.fn();
    const pop = vi.spyOn(listMotion, 'popInList').mockReturnValue({ cancel } as unknown as Animation);
    await user.click(screen.getByRole('button', { name: 'Add list' }));
    expect(pop).toHaveBeenCalledOnce();
    expect(pop.mock.calls[0][0]).toHaveClass('workspace');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cancel).toHaveBeenCalledOnce();
    expect(screen.getByText('0 saved lists')).toBeVisible();
  });

  it('returns to the gallery when another tab deletes the open list', async () => {
    records.set('first', saved());
    const user = await enter();
    await user.click(screen.getByRole('button', { name: 'Open Weekly shop' }));
    await screen.findByRole('checkbox', { name: 'milk' });
    await act(async () => {
      records.clear();
      await Promise.all([...observers].map(run => run()));
    });
    expect(await screen.findByText('0 saved lists')).toBeVisible();
    expect(toast.info).toHaveBeenCalledWith('This list no longer exists.');
  });

  it('reports a deleted card instead of opening a stale list', async () => {
    records.set('first', saved());
    const user = await enter();
    vi.mocked(loadList).mockResolvedValueOnce(undefined);
    await user.click(screen.getByRole('button', { name: 'Open Weekly shop' }));
    expect(toast.info).toHaveBeenCalledWith('This list no longer exists.');
    expect(screen.getByRole('button', { name: 'Add list' })).toBeVisible();
  });

  it('keeps the edit draft when a save fails and reports the reason', async () => {
    records.set('first', saved());
    const user = await enter();
    await user.click(screen.getByRole('button', { name: 'Open Weekly shop' }));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('List name'), ' edited');
    vi.mocked(saveList).mockRejectedValueOnce(new Error('Disk unavailable'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Disk unavailable');
    expect(screen.getByLabelText('List name')).toHaveValue('Weekly shop edited');
    expect(records.get('first')?.name).toBe('Weekly shop');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('heading', { name: 'Weekly shop edited' })).toBeVisible();
  });

  it('reports gallery load errors and retries without deleting records', async () => {
    vi.mocked(listLists).mockRejectedValueOnce(new Error('Storage blocked'));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Continue without a key' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage blocked');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: 'Add list' })).toBeEnabled();
  });

  it('preserves categories and keyboard moves when editing a saved list', async () => {
    const list = { ...saved(), shoppingList: [{ name: 'apple', checked: true }, { name: 'milk', checked: false }] };
    records.set(list.id, list);
    const user = await enter();
    await user.click(screen.getByRole('button', { name: 'Open Weekly shop' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Categorise' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled());
    expect(screen.getByRole('heading', { name: 'Fruit & Veg' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    screen.getByRole('button', { name: 'Move apple' }).focus();
    await user.keyboard('{ArrowDown}');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(records.get(list.id)?.shoppingList).toEqual([
      { name: 'milk', checked: false }, { name: 'apple', checked: true, category: 'Dairy' },
    ]));
  });

  it('combines saved Veg assignments and fresh produce under one Fruit & Veg heading', async () => {
    const shoppingList = [
      { name: 'carrots', checked: true, category: 'Veg' as const },
      { name: 'apples', checked: false }, { name: 'tomatoes', checked: false },
      { name: 'milk', checked: true },
    ];

    records.set('first', { ...saved(), shoppingList, categories: true });
    const user = await enter();
    await user.click(screen.getByRole('button', { name: 'Open Weekly shop' }));
    expect(await screen.findAllByRole('heading', { name: 'Fruit & Veg' })).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: 'Veg' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'carrots' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'apples' })).not.toBeChecked();
    expect(screen.getByRole('heading', { name: 'Dairy' })).toBeVisible();
    await user.click(screen.getByRole('checkbox', { name: 'Categorise' }));
    await waitFor(() => expect(records.get('first')?.categories).toBe(false));
    expect(records.get('first')?.shoppingList).toEqual(shoppingList);
  });

  it('groups water, soda, and juice under Soft drinks without changing the saved items', async () => {
    const shoppingList = [
      { name: 'water', checked: true }, { name: 'Fanta Orange', checked: false },
      { name: 'Pepsi Max', checked: false }, { name: 'orange juice', checked: false },
      { name: 'apple', checked: false }, { name: 'Merlot', checked: true },
      { name: 'bread', checked: false },
    ];

    records.set('first', { ...saved(), shoppingList, categories: true });
    const user = await enter();
    await user.click(screen.getByRole('button', { name: 'Open Weekly shop' }));
    expect(await screen.findAllByRole('heading', { name: 'Soft drinks' })).toHaveLength(1);
    const list = screen.getByRole('region', { name: 'Shopping list' });
    expect(within(list).getAllByRole('checkbox').map(input => input.getAttribute('aria-label'))).toEqual([
      'apple', 'bread', 'water', 'Fanta Orange', 'Pepsi Max', 'orange juice', 'Merlot',
    ]);
    expect(screen.getByRole('checkbox', { name: 'water' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Merlot' })).toBeChecked();
    expect(records.get('first')?.shoppingList).toEqual(shoppingList);
    expect(saveList).not.toHaveBeenCalled();
  });

  it('keeps the deletion modal open when deletion fails' , async () => {
    records.set('first', saved());
    const user = await enter();
    await user.click(screen.getByRole('button', { name: 'Delete Weekly shop' }));
    vi.mocked(deleteList).mockRejectedValueOnce(new Error('Access denied'));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete list' }));
    expect(toast.error).toHaveBeenCalledWith('Could not delete this list: Access denied');
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(records.has('first')).toBe(true);
  });

  it('validates the entered key before opening the gallery and reports validation errors', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText('API-Key'), 'entered-key');
    testApiKey.mockRejectedValueOnce(new Error('401'));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByLabelText('Enter an API Key')).toBeVisible();
    expect(toast.error).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(clientMock).toHaveBeenLastCalledWith('entered-key');
    expect(await screen.findByRole('button', { name: 'Add list' })).toBeVisible();
    expect(screen.queryByPlaceholderText('API-Key')).not.toBeInTheDocument();
  });

  it('appends photo results after manual items, keeps duplicates, and allows only one photo', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText('API-Key'), 'entered-key');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: 'Add list' }));
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await user.type(screen.getByLabelText('Item 1 name'), 'bread');
    await user.upload(document.querySelector('#upload') as HTMLInputElement, new File(['photo'], 'list.png', { type: 'image/png' }));
    await waitFor(() => expect(recogniseHandwriting).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByLabelText('Item 4 name')).toHaveValue('milk'));
    expect(screen.getByLabelText('Item 1 name')).toHaveValue('bread');
    expect(compressImage).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Photo' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Process' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByLabelText('List name')).not.toBeInTheDocument());
    expect(screen.getAllByRole('checkbox', { name: 'milk' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Photo' })).toBeDisabled();
    expect(screen.getByAltText('Full source photo')).toBeInTheDocument();
  });
  it('clear action empties only the open list, keeps its name and categories, and retains Delete', async () => {
    records.set('first', { ...saved(), categories: true, imageId: 'first', image: new Blob(['photo']), fileName: 'old.jpg' });
    records.set('second', saved('second', 'Another shop'));
    const user = await enter();
    await user.click(screen.getByRole('button', { name: 'Open Weekly shop' }));
    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    await user.type(screen.getByLabelText('New item name'), 'unsaved item');
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(await screen.findByText('No items yet, tap + to add one')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Weekly shop' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'Categorise' })).toBeChecked();
    expect(screen.queryByLabelText('New item name')).not.toBeInTheDocument();
    expect(screen.queryByAltText('Full source photo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Photo' })).toBeDisabled();
    expect(records.get('first')?.shoppingList).toEqual([]);
    expect(records.get('second')?.shoppingList).toEqual(saved().shoppingList);
    expect(deleteList).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Open Weekly shop' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Open Weekly shop' }));
    expect(await screen.findByText('No items yet, tap + to add one')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('dialog')).toBeVisible();
    expect(deleteList).not.toHaveBeenCalled();
  });

  it('clear action preserves the list and photo when storage fails', async () => {
    records.set('first', { ...saved(), imageId: 'first', image: new Blob(['photo']), fileName: 'old.jpg' });
    const user = await enter();
    await user.click(screen.getByRole('button', { name: 'Open Weekly shop' }));
    await screen.findByRole('button', { name: 'Clear' });
    vi.mocked(clearList).mockRejectedValueOnce(new Error('Storage unavailable'));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(toast.error).toHaveBeenCalledWith('Could not clear this list: Storage unavailable', expect.any(Object));
    expect(screen.getByRole('checkbox', { name: 'milk' })).toBeChecked();
    expect(screen.getByAltText('Full source photo')).toBeInTheDocument();
    expect(records.get('first')?.shoppingList).toEqual(saved().shoppingList);
    expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled();
  });

  it('clear action allows another photo on the same saved list without restoring the old photo reference', async () => {
    records.set('first', { ...saved(), imageId: 'first', image: new Blob(['old photo']), fileName: 'old.jpg' });
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText('API-Key'), 'entered-key');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: 'Open Weekly shop' }));
    await user.click(await screen.findByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Photo' })).toBeEnabled());
    expect(records.get('first')?.imageId).toBeUndefined();
    await user.upload(document.querySelector('#upload') as HTMLInputElement, new File(['new photo'], 'new.png', { type: 'image/png' }));
    await waitFor(() => expect(screen.getByLabelText('Item 3 name')).toHaveValue('milk'));
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled());
    expect(records.size).toBe(1);
    expect(records.get('first')?.fileName).toBe('new.png');
    expect(records.get('first')?.imageId).toBe('first');
    expect(records.get('first')?.shoppingList.map(item => item.name)).toEqual(['milk', 'bread', 'milk']);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Open Weekly shop' }));
    expect(await screen.findByAltText('new.png')).toBeInTheDocument();
  });

  it('first photo after creation saves to the existing list and preserves manual items and checked states', async () => {
    records.set('first', saved());
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText('API-Key'), 'entered-key');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: 'Open Weekly shop' }));
    expect(await screen.findByRole('button', { name: 'Photo' })).toBeEnabled();
    expect(screen.queryByAltText('Full source photo')).not.toBeInTheDocument();
    await user.upload(document.querySelector('#upload') as HTMLInputElement, new File(['first photo'], 'later.png', { type: 'image/png' }));
    await waitFor(() => expect(screen.getByLabelText('Item 4 name')).toHaveValue('milk'));
    expect(screen.getByLabelText('Item 1 name')).toHaveValue('milk');
    expect(screen.getByRole('button', { name: 'Photo' })).toBeDisabled();
    expect(records.get('first')?.image).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled());
    expect(records.size).toBe(1);
    expect(records.get('first')?.name).toBe('Weekly shop');
    expect(records.get('first')?.fileName).toBe('later.png');
    expect(records.get('first')?.imageId).toBe('first');
    expect(records.get('first')?.shoppingList).toEqual([
      { name: 'milk', checked: true }, { name: 'milk', checked: false },
      { name: 'bread', checked: false }, { name: 'milk', checked: false },
    ]);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Open Weekly shop' }));
    expect(await screen.findByAltText('later.png')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox', { name: 'milk' })[0]).toBeChecked();
  });

  it('first photo after creation can be cancelled without changing the saved list', async () => {
    records.set('first', saved());
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText('API-Key'), 'entered-key');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: 'Open Weekly shop' }));
    await user.upload(document.querySelector('#upload') as HTMLInputElement, new File(['photo'], 'later.png', { type: 'image/png' }));
    await waitFor(() => expect(screen.getByLabelText('Item 4 name')).toHaveValue('milk'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('checkbox', { name: 'milk' })).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'bread' })).not.toBeInTheDocument();
    expect(screen.queryByAltText('Full source photo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Photo' })).toBeEnabled();
    expect(records.get('first')).toEqual(saved());
    expect(saveList).not.toHaveBeenCalled();
  });

  it.each(['new', 'saved'])('photo key requirement disables uploads on a %s list without a key', async kind => {
    if (kind === 'saved')
      records.set('first', saved());

    const user = await enter();
    await user.click(screen.getByRole('button', { name: kind === 'new' ? 'Add list' : 'Open Weekly shop' }));
    expect(await screen.findByRole('button', { name: 'Photo' })).toBeDisabled();
    const upload = document.querySelector<HTMLInputElement>('#upload')!;
    expect(upload).toBeDisabled();
    await user.upload(upload, new File(['photo'], 'list.png', { type: 'image/png' }));
    expect(compressImage).not.toHaveBeenCalled();
    expect(recogniseHandwriting).not.toHaveBeenCalled();
    expect(screen.queryByAltText('Full source photo')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await user.type(screen.getByLabelText(kind === 'new' ? 'Item 1 name' : 'New item name'), 'manual item');
    await user.click(screen.getByRole('button', { name: kind === 'new' ? 'Save' : 'Confirm new item' }));
    expect(await screen.findByRole('checkbox', { name: 'manual item' })).toBeVisible();
  });

});
