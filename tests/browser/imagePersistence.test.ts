import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import fixtureUrl from '../testFiles/large-handwritten-price-list.png?url';
import { compressImage } from '../../src/compressImage';
import { loadSession, saveSession, type SavedSession } from '../../src/storage';

const imageFixtures = Object.entries(import.meta.glob<string>('../testFiles/*.png', {
  eager: true, query: '?url', import: 'default',
})).map(([path, url]) => [path.split('/').pop() ?? path, url]);

const emptySession: SavedSession = { id: 'current', shoppingList: [], fileName: '' };
const processedSession: SavedSession = {
  id: 'current', imageId: 'current', fileName: 'price-list.png',
  shoppingList: [{ name: 'Treats', checked: true }],
};

async function fixtureFile(): Promise<File> {
  const response = await fetch(fixtureUrl);
  expect(response.ok).toBe(true);

  return new File([await response.blob()], 'price-list.png', { type: 'image/png' });
}

describe('real browser image compression and persistence', () => {
  beforeEach(async () => {
    await saveSession(emptySession, null);
  });

  afterEach(async () => {
    await saveSession(emptySession, null);
  });

  it.each(imageFixtures)('compresses and restores %s with real browser APIs', async (fileName, url) => {
    const response = await fetch(url);
    expect(response.ok).toBe(true);
    const original = new File([await response.blob()], fileName, { type: 'image/png' });
    expect(original.size).toBeGreaterThan(1024 * 1024);
    const source = await createImageBitmap(original);
    const compressed = await compressImage(original);
    const result = await createImageBitmap(compressed);
    try {
      expect(compressed.type).toBe('image/jpeg');
      expect(compressed.size).toBeLessThan(original.size);
      expect(compressed.size).toBeLessThanOrEqual(1024 * 1024);
      expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(2560);
      expect(result.width / result.height).toBeCloseTo(source.width / source.height, 2);
    } finally {
      source.close();
      result.close();
    }

    const session = { ...processedSession, fileName };
    await saveSession(session, compressed);
    const restored = await loadSession();
    expect(restored.fileName).toBe(fileName);
    expect(restored.shoppingList).toEqual(session.shoppingList);
    expect(restored.image?.type).toBe('image/jpeg');
    expect(await restored.image?.arrayBuffer()).toEqual(await compressed.arrayBuffer());
  });

  it('compresses the actual PNG into a decodable JPEG below the size limit', async () => {
    const original = await fixtureFile();
    const compressed = await compressImage(original);
    expect(original.size).toBeGreaterThan(1024 * 1024);
    expect(compressed.type).toBe('image/jpeg');
    expect(compressed.size).toBeLessThan(original.size);
    expect(compressed.size).toBeLessThanOrEqual(1024 * 1024);
    const bitmap = await createImageBitmap(compressed);
    try {
      expect([bitmap.width, bitmap.height]).toEqual([1086, 1448]);
    } finally {
      bitmap.close();
    }
  });

  it('resizes a phone-sized image while preserving its aspect ratio', async () => {
    const bitmap = await createImageBitmap(await fixtureFile());
    const canvas = document.createElement('canvas');
    canvas.width = 3000;
    canvas.height = 4000;
    try {
      const context = canvas.getContext('2d');
      if (!context)
        throw new Error('Canvas is unavailable');

      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const source = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare test image')), 'image/png');
      });

      const compressed = await compressImage(new File([source], 'phone.png', { type: 'image/png' }));
      const result = await createImageBitmap(compressed);
      try {
        expect(result.height).toBeLessThanOrEqual(2560);
        expect(result.width / result.height).toBeCloseTo(0.75, 2);
        expect(compressed.size).toBeLessThanOrEqual(1024 * 1024);
      } finally {
        result.close();
      }
    } finally {
      bitmap.close();
      canvas.width = 0;
      canvas.height = 0;
    }
  });

  it('persists compressed bytes that another database connection can read', async () => {
    const compressed = await compressImage(await fixtureFile());
    await saveSession(processedSession, compressed);
    const connection = new Dexie('HandyList');
    connection.version(1).stores({ sessions: 'id', images: 'id' });
    try {
      await connection.open();
      const record = await connection.table<{ id: string; blob: Blob }>('images').get('current');
      expect(record?.blob.type).toBe('image/jpeg');
      expect(await record?.blob.arrayBuffer()).toEqual(await compressed.arrayBuffer());
      expect(await connection.table('sessions').get('current')).toEqual(processedSession);
    } finally {
      connection.close();
    }

    const restored = await loadSession();
    expect(restored.shoppingList).toEqual(processedSession.shoppingList);
    expect(await restored.image?.arrayBuffer()).toEqual(await compressed.arrayBuffer());
  });

  it('rolls back an image replacement when the session write fails', async () => {
    const original = new Blob(['previous image'], { type: 'image/jpeg' });
    await saveSession(processedSession, original);
    const invalidSession = { ...processedSession, id: undefined } as unknown as SavedSession;
    await expect(saveSession(invalidSession, new Blob(['replacement']))).rejects.toThrow();
    const restored = await loadSession();
    expect(restored.shoppingList).toEqual(processedSession.shoppingList);
    expect(await restored.image?.text()).toBe('previous image');
  });
});
