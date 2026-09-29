import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { readState, stateParams } from '../src/directory/state';
import { theme } from '../src/theme';
import type { DirectoryResponse } from '@presight/shared';

const response = (name = 'Alex'): DirectoryResponse => ({
  users: [
    {
      id: 1,
      avatar: '',
      first_name: name,
      last_name: 'Smith',
      nationality: 'French',
      age: 30,
      hobbies: ['Reading', 'Swimming', 'Chess', 'Running'],
    },
  ],
  pagination: { total: 1, limit: 20, offset: 0, hasMore: false, nextOffset: null },
  filterOptions: {
    hobbies: [{ value: 'Reading', count: 1 }],
    nationalities: [{ value: 'French', count: 1 }],
  },
});
const json = (body: DirectoryResponse) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
const mount = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MantineProvider theme={theme}>
        <App />
      </MantineProvider>
    </QueryClientProvider>,
  );
};

describe('URL state', () => {
  it('round-trips repeated filters and special characters; normalizes malformed URLs', () => {
    const state = readState(
      '?q=Ana%20%26%20Alex&hobby=Reading&hobby=SWIMMING&nationality=French&sort=age&direction=desc',
    );
    expect(readState(stateParams(state).toString())).toEqual(state);
    expect(readState('?sort=invalid&direction=oops&hobby=&hobby=Reading&hobby=reading')).toEqual({
      q: '',
      hobbies: ['reading'],
      nationalities: [],
      sort: 'first_name',
      direction: 'asc',
    });
  });
});

it('restores shared state and renders cards with only two hobby labels and remaining count', async () => {
  window.history.replaceState(
    null,
    '',
    '/?q=Alex&hobby=Reading&nationality=French&sort=age&direction=desc',
  );
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(response()));
  mount();
  const card = await screen.findByRole('article', { name: 'Alex Smith' });
  expect(within(card).getByText('Reading')).toBeTruthy();
  expect(within(card).getByText('Swimming')).toBeTruthy();
  expect(within(card).queryByText('Chess')).toBeNull();
  expect(within(card).getByLabelText('2 more hobbies')).toBeTruthy();
  expect((screen.getByLabelText('Search people') as HTMLInputElement).value).toBe('Alex');
  const params = new URL(String(fetchMock.mock.calls[0]![0]), 'http://localhost').searchParams;
  expect(params.get('hobby')).toBe('reading');
  expect(params.get('sort')).toBe('age');
  expect(params.get('direction')).toBe('desc');
});

it('refreshes results and options on filter/search changes; keeps absent selections removable', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const selected = new URL(String(url), 'http://localhost').searchParams.has('hobby');
    return json(
      selected
        ? {
            ...response(),
            users: [],
            pagination: { ...response().pagination, total: 0 },
            filterOptions: { hobbies: [], nationalities: [] },
          }
        : response(),
    );
  });
  mount();
  await screen.findByRole('article');
  await userEvent.click(screen.getByRole('checkbox', { name: 'Reading' }));
  await screen.findByText('No people found');
  expect(new URLSearchParams(window.location.search).get('hobby')).toBe('reading');
  await userEvent.click(screen.getByRole('button', { name: 'Remove hobby reading' }));
  await screen.findByRole('article');
  await userEvent.type(screen.getByLabelText('Search people'), 'Ana & Alex');
  await waitFor(() =>
    expect(
      new URL(String(fetchMock.mock.calls.at(-1)![0]), 'http://localhost').searchParams.get('q'),
    ).toBe('Ana & Alex'),
  );
  expect(new URLSearchParams(window.location.search).get('q')).toBe('Ana & Alex');
});

it('loads a second page, resets pagination on sort, and handles browser navigation', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const offset = Number(new URL(String(url), 'http://localhost').searchParams.get('offset'));
    const body = response(offset ? 'Ana' : 'Alex');
    body.users[0]!.id = offset ? 2 : 1;
    body.pagination = {
      total: 2,
      offset,
      limit: 20,
      hasMore: !offset,
      nextOffset: offset ? null : 1,
    };
    return json(body);
  });
  mount();
  await screen.findByRole('article', { name: 'Alex Smith' });
  await screen.findByRole('article', { name: 'Ana Smith' });
  await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'age');
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([url]) => {
        const params = new URL(String(url), 'http://localhost').searchParams;
        return params.get('sort') === 'age' && params.get('offset') === '0';
      }),
    ).toBe(true),
  );
  act(() => {
    window.history.replaceState(null, '', '/?q=Zoe&sort=last_name&direction=desc');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await waitFor(() =>
    expect((screen.getByLabelText('Search people') as HTMLInputElement).value).toBe('Zoe'),
  );
  expect((screen.getByLabelText('Sort by') as HTMLSelectElement).value).toBe('last_name');
});

it('shows request failures and allows retry', async () => {
  vi.spyOn(globalThis, 'fetch')
    .mockRejectedValueOnce(new Error('Offline'))
    .mockImplementation(async () => json(response()));
  mount();
  await screen.findByRole('alert');
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByRole('article');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('shows loading and ignores a stale response after the search changes', async () => {
  let finish: (value: Response) => void = () => {};
  vi.spyOn(globalThis, 'fetch')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockImplementation(async () => json(response('Zoe')));
  mount();
  expect(screen.getByLabelText('Loading people')).toBeTruthy();
  await userEvent.type(screen.getByLabelText('Search people'), 'Zoe');
  await screen.findByRole('article', { name: 'Zoe Smith' });
  await act(async () => {
    finish(json(response('Old')));
  });
  expect(screen.queryByRole('article', { name: 'Old Smith' })).toBeNull();
});

it('opens and closes the mobile filter drawer', async () => {
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(response()));
  mount();
  await screen.findByRole('article');
  expect(screen.queryByRole('complementary')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
  const drawer = await screen.findByRole('dialog', { name: 'Directory filters' });
  await userEvent.click(within(drawer).getByRole('checkbox', { name: 'Reading' }));
  expect(new URLSearchParams(window.location.search).get('hobby')).toBe('reading');
  await userEvent.click(within(drawer).getByRole('button', { name: 'Show results' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

const pageResponse = (offset: number, total = 45, prefix = 'Person'): DirectoryResponse => ({
  users: Array.from({ length: Math.min(20, Math.max(0, total - offset)) }, (_, index) => ({
    id: offset + index + 1,
    avatar: '',
    first_name: `${prefix} ${offset + index + 1}`,
    last_name: 'Smith',
    age: 30,
    nationality: 'French',
    hobbies: ['Reading'],
  })),
  pagination: {
    total,
    offset,
    limit: 20,
    hasMore: offset + 20 < total,
    nextOffset: offset + 20 < total ? offset + 20 : null,
  },
  filterOptions: {
    hobbies: [{ value: 'Reading', count: total }],
    nationalities: [{ value: 'French', count: total }],
  },
});

const scrollResults = (top: number) => {
  const element = screen.getByRole('region', { name: 'Directory results' });
  fireEvent.scroll(element, { target: { scrollTop: top } });
  return element;
};

it('virtualizes the DOM, automatically loads pages once, and stops at the final page', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const offset = Number(new URL(String(url), 'http://localhost').searchParams.get('offset'));
    return json(pageResponse(offset));
  });
  mount();
  await screen.findByRole('article', { name: 'Person 1 Smith' });
  expect(screen.getAllByRole('article').length).toBeLessThan(20);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  scrollResults(2200);
  await screen.findByText('Showing 40 of 45 people');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.getAllByRole('article').length).toBeLessThan(20);
  scrollResults(5400);
  await screen.findByText('Showing 45 of 45 people · End of results');
  scrollResults(6000);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(screen.queryByRole('button', { name: 'Load more people' })).toBeNull();
  const offsets = fetchMock.mock.calls.map(([url]) =>
    new URL(String(url), 'http://localhost').searchParams.get('offset'),
  );
  expect(offsets).toEqual(['0', '20', '40']);
  const positions = screen.getAllByRole('listitem').map((row) => row.getAttribute('aria-posinset'));
  expect(new Set(positions).size).toBe(positions.length);
});

it('preserves loaded cards after a next-page error and retries only when requested', async () => {
  let failed = false;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const offset = Number(new URL(String(url), 'http://localhost').searchParams.get('offset'));
    if (offset === 20 && !failed) {
      failed = true;
      throw new Error('Offline');
    }
    return json(pageResponse(offset, 40));
  });
  mount();
  await screen.findByRole('article', { name: 'Person 1 Smith' });
  scrollResults(2200);
  await screen.findByRole('alert');
  expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
  scrollResults(2100);
  scrollResults(2200);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('Showing 40 of 40 people · End of results');
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('resets scroll and cancels a pending next page when filters change', async () => {
  let finish: (value: Response) => void = () => {};
  let pendingSignal: AbortSignal | null | undefined;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const params = new URL(String(url), 'http://localhost').searchParams;
    if (params.has('hobby')) return json(pageResponse(0, 1, 'Filtered'));
    if (params.get('offset') === '20') {
      pendingSignal = init?.signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    }
    return json(pageResponse(0));
  });
  mount();
  await screen.findByRole('article', { name: 'Person 1 Smith' });
  scrollResults(2200);
  await screen.findByText('Loading more people…');
  scrollResults(2300);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await userEvent.click(screen.getByRole('checkbox', { name: 'Reading' }));
  await screen.findByRole('article', { name: 'Filtered 1 Smith' });
  expect(pendingSignal?.aborted).toBe(true);
  expect(screen.getByRole('region', { name: 'Directory results' }).scrollTop).toBe(0);
  await act(async () => {
    finish(json(pageResponse(20)));
  });
  expect(screen.getAllByRole('article')).toHaveLength(1);
});
