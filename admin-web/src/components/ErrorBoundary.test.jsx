import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary.jsx';

let shouldThrow = true;
const Broken = () => {
  if (shouldThrow) throw new Error('boom');
  return <p>fine</p>;
};
const ChunkBroken = () => {
  throw new TypeError('Failed to fetch dynamically imported module: /assets/x.js');
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
    // React logs the caught error; keep the test output clean
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows a message instead of a blank page', () => {
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByText('화면을 보여 주지 못했어요.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /다시 시도/ })).toBeTruthy();
  });

  it('renders the children again after "다시 시도"', async () => {
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    shouldThrow = false;
    await userEvent.click(screen.getByRole('button', { name: /다시 시도/ }));
    expect(screen.getByText('fine')).toBeTruthy();
  });

  it('clears the error when the reset key changes (moving to another page)', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.queryByText('fine')).toBeNull();
    shouldThrow = false;
    rerender(
      <ErrorBoundary resetKey="/b">
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeTruthy();
  });

  it('tells the admin to reload when a page file cannot be loaded', () => {
    render(
      <ErrorBoundary>
        <ChunkBroken />
      </ErrorBoundary>,
    );
    expect(screen.getByText('새 버전이 나왔어요.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /다시 시도/ })).toBeNull();
    expect(screen.getByRole('button', { name: /새로고침/ })).toBeTruthy();
  });
});
