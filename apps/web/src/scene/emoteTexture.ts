import { CanvasTexture, SRGBColorSpace } from 'three';
import { DIE_EMOTE_SYMBOLS, type DieEmote } from '@rollycast/shared';

const cache = new Map<DieEmote, CanvasTexture>();

/**
 * A cached transparent texture of an emote glyph, drawn on a canvas the same way face numbers are so
 * no image assets ship. Cached per emote — there are only a handful, and a busy table reuses them
 * constantly.
 */
export function getEmoteTexture(emote: DieEmote): CanvasTexture {
  const existing = cache.get(emote);
  if (existing) return existing;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable');
  }

  ctx.clearRect(0, 0, size, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Leave headroom below the nominal size: emoji glyphs overshoot their em box, and a clipped face
  // reads as a rendering bug rather than a joke.
  ctx.font = '92px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.fillText(DIE_EMOTE_SYMBOLS[emote], size / 2, size / 2 + 4);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  cache.set(emote, texture);
  return texture;
}
