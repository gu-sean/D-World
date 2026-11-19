import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useListParams } from './useListParams.js';

function setup(url, defaults) {
  const wrapper = ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
  return renderHook(
    () => {
      const [params, setParams] = useListParams(defaults);
      return { params, setParams, location: useLocation(), navigationType: useNavigationType() };
    },
    { wrapper },
  );
}

describe('useListParams', () => {
  it('has default page and size', () => {
    const { result } = setup('/users');
    expect(result.current.params).toEqual({ page: 1, size: 20 });
  });

  it('reads numbers for page and size and strings for the rest', () => {
    const { result } = setup('/users?page=3&size=50&status=active');
    expect(result.current.params).toEqual({ page: 3, size: 50, status: 'active' });
  });

  it('caps the size and ignores garbage numbers', () => {
    const { result } = setup('/users?size=999&page=abc');
    expect(result.current.params.size).toBe(100);
    expect(result.current.params.page).toBe(1);
  });

  it('uses the defaults the URL does not override', () => {
    const { result } = setup('/users', { sort: 'createdAt,desc' });
    expect(result.current.params.sort).toBe('createdAt,desc');
    const other = setup('/users?sort=createdAt,asc', { sort: 'createdAt,desc' });
    expect(other.result.current.params.sort).toBe('createdAt,asc');
  });

  it('merges a patch, removes empty values and returns to page 1', () => {
    const { result } = setup('/users?page=4&status=active');
    act(() => result.current.setParams({ query: 'kim', status: '' }));
    expect(result.current.params).toEqual({ page: 1, size: 20, query: 'kim' });
  });

  it('keeps the page it is given', () => {
    const { result } = setup('/users');
    act(() => result.current.setParams({ page: 2 }));
    expect(result.current.params.page).toBe(2);
  });

  it('replaces the history entry instead of adding one', () => {
    const { result } = setup('/users');
    act(() => result.current.setParams({ status: 'active' }));
    expect(result.current.navigationType).toBe('REPLACE');
    expect(result.current.location.search).toBe('?status=active');
  });
});
