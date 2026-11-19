import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterBar } from './FilterBar.jsx';

const fields = [
  { name: 'query', type: 'text', label: '검색어' },
  { name: 'status', type: 'select', label: '상태', options: [{ value: 'a', label: 'A' }] },
];

describe('FilterBar', () => {
  it('shows a label above every field', () => {
    render(<FilterBar fields={fields} value={{}} onChange={() => {}} />);
    expect(screen.getByText('검색어')).toBeTruthy();
    expect(screen.getByText('상태')).toBeTruthy();
  });

  it('applies a text search with the button next to the input', async () => {
    const onChange = vi.fn();
    render(<FilterBar fields={fields} value={{}} onChange={onChange} />);
    await userEvent.type(screen.getByRole('searchbox'), '  kim  ');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /검색|Search/ }));
    expect(onChange).toHaveBeenCalledWith({ query: 'kim', status: '' });
  });

  it('applies a text search with Enter', async () => {
    const onChange = vi.fn();
    render(<FilterBar fields={fields} value={{}} onChange={onChange} />);
    await userEvent.type(screen.getByRole('searchbox'), 'lee{Enter}');
    expect(onChange).toHaveBeenCalledWith({ query: 'lee', status: '' });
  });

  it('resets every field', async () => {
    const onChange = vi.fn();
    render(<FilterBar fields={fields} value={{ query: 'x', status: 'a' }} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /초기화|Reset/ }));
    expect(onChange).toHaveBeenCalledWith({ query: '', status: '' });
  });
});
