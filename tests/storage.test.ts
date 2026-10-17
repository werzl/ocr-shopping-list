import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { get, put, getImage, putImage, deleteImage, transaction } = vi.hoisted(() => ({
  get: vi.fn(), put: vi.fn(), getImage: vi.fn(), putImage: vi.fn(), deleteImage: vi.fn(), transaction: vi.fn(),
}));

vi.mock('dexie', () => ({
  default: class {
    version() { return { stores: () => ({ upgrade: vi.fn() }) }; }
    table(name: string) {
      return name === 'sessions' ? { get, put } : { get: getImage, put: putImage, delete: deleteImage };
    }
    transaction = transaction;
  },
}));

import { isStorageFull, loadSession, saveSession } from '../src/storage';

const session = { id: 'current' as const, shoppingList: [{ name: 'milk', checked: true }], imageId: 'current' as const, fileName: 'list.png' };

describe('session storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
    get.mockResolvedValue(undefined);
    put.mockResolvedValue('current');
    transaction.mockImplementation(async (_mode, _sessions, _images, action) => action());
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('starts empty and removes obsolete localStorage data', async () => {
    localStorage.setItem('shoppingList', 'invalid JSON');
    localStorage.setItem('base64Image', 'old image');
    expect(await loadSession()).toEqual({ id: 'current', shoppingList: [], fileName: '', image: null });
    expect(put).not.toHaveBeenCalled();
    expect(putImage).not.toHaveBeenCalled();
    expect(localStorage.getItem('base64Image')).toBeNull();
  });

  it('restores the saved Blob without writing either table', async () => {
    const blob = new Blob(['image']);
    get.mockResolvedValue(session);
    getImage.mockResolvedValue({ id: 'current', blob });
    localStorage.setItem('shoppingList', 'invalid JSON');
    expect(await loadSession()).toEqual({ ...session, image: blob });
    expect(put).not.toHaveBeenCalled();
    expect(putImage).not.toHaveBeenCalled();
  });

  it('rejects missing referenced images rather than overwriting data', async () => {
    get.mockResolvedValue(session);
    await expect(loadSession()).rejects.toThrow('Saved image is missing');
    expect(put).not.toHaveBeenCalled();
  });

  it('saves checkbox changes without reading or writing the image table', async () => {
    await saveSession(session);
    expect(put).toHaveBeenCalledWith(session);
    expect(getImage).not.toHaveBeenCalled();
    expect(putImage).not.toHaveBeenCalled();
    expect(deleteImage).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('replaces an image and its session inside one write transaction', async () => {
    const image = new Blob(['replacement']);
    await saveSession(session, image);
    expect(transaction).toHaveBeenCalledWith('rw', expect.anything(), expect.anything(), expect.any(Function));
    expect(putImage).toHaveBeenCalledWith({ id: 'current', blob: image });
    expect(put).toHaveBeenCalledWith(session);
  });

  it('clears the image and session inside one write transaction', async () => {
    const empty = { id: 'current' as const, shoppingList: [], fileName: '' };
    await saveSession(empty, null);
    expect(transaction).toHaveBeenCalledWith('rw', expect.anything(), expect.anything(), expect.any(Function));
    expect(deleteImage).toHaveBeenCalledWith('current');
    expect(put).toHaveBeenCalledWith(empty);
  });

  it('propagates failed replacement writes without deleting the previous image', async () => {
    const error = new DOMException('Full', 'QuotaExceededError');
    putImage.mockRejectedValue(error);
    await expect(saveSession(session, new Blob(['replacement']))).rejects.toBe(error);
    expect(deleteImage).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('recognizes native and Dexie-wrapped quota failures', () => {
    const error = new DOMException('Full', 'QuotaExceededError');
    expect(isStorageFull(error)).toBe(true);
    expect(isStorageFull({ inner: error })).toBe(true);
    expect(isStorageFull(new Error('unavailable'))).toBe(false);
    expect(isStorageFull(undefined)).toBe(false);
  });
  it('removes only the three obsolete keys after loading IndexedDB', async () => {
    for (const key of ['base64Image', 'base64FileName', 'shoppingList']) {
      localStorage.setItem(key, 'old value');
    }
    localStorage.setItem('unrelated', 'keep');
    await loadSession();
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem('unrelated')).toBe('keep');
    await loadSession();
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });

  it('keeps old data when IndexedDB fails to load', async () => {
    localStorage.setItem('base64Image', 'keep');
    get.mockRejectedValue(new Error('unavailable'));
    await expect(loadSession()).rejects.toThrow('unavailable');
    expect(localStorage.getItem('base64Image')).toBe('keep');
  });

  it('still loads IndexedDB when localStorage cleanup is blocked', async () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await loadSession()).toEqual({ id: 'current', shoppingList: [], fileName: '', image: null });
    expect(console.warn).toHaveBeenCalledOnce();
  });

});
