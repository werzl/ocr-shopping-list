import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { compressImage } from '../src/compressImage';

const fixtureBytes = readFileSync(new NodeURL('./testFiles/large-handwritten-price-list.png', import.meta.url));
const LARGE_FILE = new File([new Uint8Array(fixtureBytes)], 'large-handwritten-price-list.png', { type: 'image/png' });
const fixtureWidth = fixtureBytes.readUInt32BE(16);
const fixtureHeight = fixtureBytes.readUInt32BE(20);

describe('image compression', () => {
  const bitmap = { width: 4000, height: 3000, close: vi.fn() };
  const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
  let encode: MockInstance<HTMLCanvasElement['toBlob']>;

  beforeEach(() => {
    bitmap.width = 4000;
    bitmap.height = 3000;
    vi.clearAllMocks();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    encode = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => {
      callback(new Blob(['compressed'], { type: 'image/jpeg' }));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('compresses the supplied large image without reducing its dimensions', async () => {
    bitmap.width = fixtureWidth;
    bitmap.height = fixtureHeight;
    expect(LARGE_FILE.size).toBeGreaterThan(1024 * 1024);
    expect([fixtureWidth, fixtureHeight]).toEqual([1086, 1448]);
    const result = await compressImage(LARGE_FILE);
    expect(createImageBitmap).toHaveBeenCalledWith(LARGE_FILE);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, fixtureWidth, fixtureHeight);
    expect(encode).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
    expect(result.type).toBe('image/jpeg');
    expect(result.size).toBeLessThanOrEqual(1024 * 1024);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it('bounds landscape dimensions and encodes a white background', async () => {
    const result = await compressImage(LARGE_FILE);
    expect(result.type).toBe('image/jpeg');
    expect(result.size).toBeLessThanOrEqual(1024 * 1024);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 2560, 1920);
    expect(context.fillStyle).toBe('#fff');
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 2560, 1920);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it('preserves portrait aspect ratio', async () => {
    bitmap.width = 3000;
    bitmap.height = 4000;
    await compressImage(LARGE_FILE);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1920, 2560);
  });

  it('keeps small originals without lossy re-encoding', async () => {
    bitmap.width = 800;
    bitmap.height = 600;
    const file = new File(['small'], 'list.png', { type: 'image/png' });
    expect(await compressImage(file)).toBe(file);
    expect(encode).not.toHaveBeenCalled();
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it('tries lower quality before reducing resolution further', async () => {
    encode.mockImplementationOnce((callback: BlobCallback) => callback(new Blob([new Uint8Array(1024 * 1024 + 1)], { type: 'image/jpeg' })));
    await compressImage(LARGE_FILE);
    expect(encode).toHaveBeenNthCalledWith(1, expect.any(Function), 'image/jpeg', 0.85);
    expect(encode).toHaveBeenNthCalledWith(2, expect.any(Function), 'image/jpeg', 0.75);
    expect(context.drawImage).toHaveBeenCalledOnce();
  });

  it('reduces resolution when quality adjustments cannot meet the byte limit', async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      encode.mockImplementationOnce((callback: BlobCallback) => callback(new Blob([new Uint8Array(1024 * 1024 + 1)], { type: 'image/jpeg' })));
    }
    await compressImage(LARGE_FILE);
    expect(context.drawImage).toHaveBeenLastCalledWith(bitmap, 0, 0, 2048, 1536);
  });

  it('rejects oversized results with a bounded number of attempts', async () => {
    const oversized = new Blob([new Uint8Array(1024 * 1024 + 1)], { type: 'image/jpeg' });
    encode.mockImplementation((callback: BlobCallback) => callback(oversized));
    await expect(compressImage(LARGE_FILE)).rejects.toThrow('still too large');
    expect(context.drawImage).toHaveBeenLastCalledWith(bitmap, 0, 0, 1024, 768);
    expect(encode.mock.calls.length).toBeLessThan(30);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it('does not upscale a small but byte-heavy original', async () => {
    bitmap.width = 640;
    bitmap.height = 480;
    await compressImage(LARGE_FILE);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 640, 480);
  });

  it('releases decoded pixels if encoding fails', async () => {
    encode.mockImplementation((callback: BlobCallback) => callback(null));
    await expect(compressImage(LARGE_FILE)).rejects.toThrow('Could not compress');
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it('rejects an unsupported JPEG encoder instead of storing its larger fallback', async () => {
    encode.mockImplementation((callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' })));
    await expect(compressImage(LARGE_FILE)).rejects.toThrow('Could not compress');
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});
