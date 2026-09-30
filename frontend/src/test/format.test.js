import { describe, expect, it } from 'vitest';
import { formatClassName, formatConfidence, formatRelativeTime, localDayRange } from '../utils/format';

describe('format utils', () => {
  it('formats confidence as a percentage', () => {
    expect(formatConfidence(0.9134)).toBe('91.3%');
  });

  it('capitalises class names', () => {
    expect(formatClassName('cell phone')).toBe('Cell phone');
  });

  it('formats recent times relatively', () => {
    const now = new Date('2026-01-01T12:00:00Z').getTime();
    expect(formatRelativeTime('2026-01-01T11:59:30Z', now)).toBe('30s ago');
    expect(formatRelativeTime('2026-01-01T11:55:00Z', now)).toBe('5m ago');
  });

  it('converts a local date into a 24h ISO range', () => {
    const { from, to } = localDayRange('2026-03-15');
    expect(new Date(to) - new Date(from)).toBe(24 * 60 * 60 * 1000);
    expect(new Date(from).getDate()).toBe(15);
  });

  it('returns no range for an empty date', () => {
    expect(localDayRange('')).toEqual({});
  });
});
