import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ObjectSelector from '../components/ObjectSelector';

const classes = ['person', 'bicycle', 'car', 'dog', 'toothbrush'];

describe('ObjectSelector', () => {
  it('adds a class when its checkbox is ticked', async () => {
    const onChange = vi.fn();
    render(<ObjectSelector classes={classes} selected={['person']} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('dog'));
    expect(onChange).toHaveBeenCalledWith(['person', 'dog']);
  });

  it('removes a class via its chip', async () => {
    const onChange = vi.fn();
    render(<ObjectSelector classes={classes} selected={['person', 'car']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove person' }));
    expect(onChange).toHaveBeenCalledWith(['car']);
  });

  it('filters the list by search text', async () => {
    render(<ObjectSelector classes={classes} selected={[]} onChange={() => {}} />);
    await userEvent.type(screen.getByRole('searchbox'), 'tooth');
    expect(screen.getByLabelText('toothbrush')).toBeInTheDocument();
    expect(screen.queryByLabelText('car')).not.toBeInTheDocument();
  });
});
