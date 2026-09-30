import { describe, expect, it } from 'vitest';
import { describeCameraError } from '../hooks/useCamera';

describe('describeCameraError', () => {
  it('explains a denied permission', () => {
    expect(describeCameraError({ name: 'NotAllowedError' })).toMatch(/permission was denied/);
  });

  it('explains a missing camera', () => {
    expect(describeCameraError({ name: 'NotFoundError' })).toMatch(/No camera was found/);
  });

  it('explains a camera used by another app', () => {
    expect(describeCameraError({ name: 'NotReadableError' })).toMatch(/already in use/);
  });
});
