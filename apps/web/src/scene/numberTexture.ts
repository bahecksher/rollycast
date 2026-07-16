import { CanvasTexture, SRGBColorSpace } from 'three';

const cache = new Map<string, CanvasTexture>();

/**
 * A cached transparent texture showing a die-face number in the given color. Drawn on a
 * canvas so faces stay crisp without shipping image assets. 6 and 9 get an underline to
 * disambiguate them (spec §30.3 — high-contrast, readable faces).
 */
export function getNumberTexture(value: number | string, color: string): CanvasTexture {
  const key = `${value}|${color}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable');
  }

  const label = String(value);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${label.length > 1 ? 52 : 68}px system-ui, "Segoe UI", sans-serif`;
  ctx.fillText(label, size / 2, size / 2 + 1);

  // Keep the underline snug beneath the digit so the whole "6"/"9" glyph stays inside the face
  // (the small triangular faces on a d8/d20 have little room past the digit itself).
  if (label === '6' || label === '9') {
    ctx.fillRect(size / 2 - 17, size * 0.71, 34, 5);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  cache.set(key, texture);
  return texture;
}
