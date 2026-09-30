import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DetectionTable from '../components/DetectionTable';

const base = {
  confidence: 0.9,
  timestamp: '2026-09-30T17:38:54Z',
  boundingBox: { x1: 0, y1: 0, x2: 1, y2: 1 },
  status: 'new',
};
const detections = [
  { ...base, id: 'a1', objectClass: 'person', imageUrl: 'https://signed.example/a1.jpg', imageStatus: 'uploaded' },
  { ...base, id: 'b2', objectClass: 'cell phone', imageUrl: null, imageStatus: 'failed' },
];

function renderTable(props = {}) {
  const handlers = { onStatusChange: vi.fn(), onDelete: vi.fn() };
  render(<DetectionTable detections={detections} {...handlers} {...props} />);
  return handlers;
}

describe('DetectionTable', () => {
  it('opens the full snapshot from the View pill', () => {
    renderTable();
    const view = screen.getAllByText('View');
    expect(view[0].closest('a')).toHaveAttribute('href', 'https://signed.example/a1.jpg');
    // No uploaded image -> View is not a link
    expect(view[1].closest('a')).toBeNull();
  });

  it('changes the status of a row', async () => {
    const { onStatusChange } = renderTable();
    const [firstStatus] = screen.getAllByRole('combobox');
    await userEvent.selectOptions(firstStatus, 'reviewed');
    expect(onStatusChange).toHaveBeenCalledWith('a1', 'reviewed');
  });

  it('deletes a row', async () => {
    const { onDelete } = renderTable();
    await userEvent.click(screen.getByRole('button', { name: /Delete cell phone/ }));
    expect(onDelete).toHaveBeenCalledWith('b2');
  });

  it('disables the actions of a row that is being updated', () => {
    renderTable({ busyId: 'a1' });
    expect(screen.getAllByRole('combobox')[0]).toBeDisabled();
    expect(screen.getByRole('button', { name: /Delete person/ })).toBeDisabled();
  });
});
