import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { isValidNameSearch, readState, stateParams } from '../src/features/directory/state';
import { theme } from '../src/app/theme';
import type {
  DirectoryResponse,
  DirectorySearchRequest,
  FilterOptionsResponse,
} from '@presight/shared';

const requestBody = (init?: RequestInit): DirectorySearchRequest => JSON.parse(String(init?.body));

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
});
const json = (body: DirectoryResponse | FilterOptionsResponse) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
const filterOptions: FilterOptionsResponse = {
  hobbies: [{ value: 'Reading', count: 1 }],
  nationalities: [{ value: 'French', count: 1 }],
};

// Existing list tests control search requests independently of sidebar requests.
const mockSearch = () => {
  const search = vi.fn<typeof fetch>();
  vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
    if (url === '/api/users/filter-options') {
      const selected = requestBody(init).hobbies?.length;
      return Promise.resolve(json(selected ? { hobbies: [], nationalities: [] } : filterOptions));
    }
    return search(url, init);
  });
  return search;
};

const mount = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MantineProvider theme={theme}>
        <App />
      </MantineProvider>
    </QueryClientProvider>,
  );
  return view;
};

it('Any clears only its filter group and collapses the options', async () => {
  mockSearch().mockImplementation(async () => json(response()));
  mount();
  await screen.findByRole('article');
  const anyNationality = screen.getByRole('checkbox', {
    name: 'Any nationality',
  }) as HTMLInputElement;
  expect(anyNationality.checked).toBe(false);
  expect((screen.getByRole('checkbox', { name: 'Any hobbies' }) as HTMLInputElement).checked).toBe(
    false,
  );
  await screen.findByRole('checkbox', { name: 'French' });
  await screen.findByRole('checkbox', { name: 'Reading' });
  await userEvent.click(screen.getByRole('checkbox', { name: 'French' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Reading' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Any hobbies' }));
  expect(screen.queryByRole('checkbox', { name: 'Reading' })).toBeNull();
  expect(new URLSearchParams(window.location.search).getAll('hobby')).toEqual([]);
  expect(new URLSearchParams(window.location.search).getAll('nationality')).toEqual(['french']);
  await userEvent.click(anyNationality);
  expect(screen.queryByRole('checkbox', { name: 'French' })).toBeNull();
  expect(new URLSearchParams(window.location.search).getAll('nationality')).toEqual([]);
  await userEvent.click(anyNationality);
  await screen.findByRole('checkbox', { name: 'French' });
});

describe('name validation', () => {
  it.each(["Kate''", 'Kate--', "Kate'-", 'Kate’ʼ', "'''", '---', 'ʼ', 'ʼʼ', '.', ' - '])(
    'rejects repeated punctuation or names without letters: %s',
    (name) => expect(isValidNameSearch(name)).toBe(false),
  );

  it.each(['', "O'Neil", 'Jean-Luc', 'D’Arcy', 'OʼNeil', 'José.', 'Anne-Marie Smith-Jones'])(
    'allows valid names and an empty search: %s',
    (name) => expect(isValidNameSearch(name)).toBe(true),
  );
});

describe('URL state', () => {
  it('round-trips valid names and preserves invalid names for validation', () => {
    const state = readState(
      "?q=Jean-Luc%20O'Neil&hobby=Reading&hobby=SWIMMING&nationality=French&sort=age&direction=desc",
    );
    expect(state.q).toBe("Jean-Luc O'Neil");
    expect(readState(stateParams(state).toString())).toEqual(state);
    expect(
      readState(
        '?q=Ana123%20%26%20Alex!&sort=invalid&direction=oops&hobby=&hobby=Reading&hobby=reading',
      ),
    ).toEqual({
      q: 'Ana123 & Alex!',
      hobbies: ['reading'],
      nationalities: [],
      sort: 'first_name',
      direction: 'asc',
    });
  });
});

it('returns to the home page from the directory title', async () => {
  window.history.replaceState(
    null,
    '',
    '/?q=Alex&hobby=reading&nationality=French&sort=age&direction=desc#results',
  );
  mockSearch().mockResolvedValue(json(response()));
  mount();
  await screen.findByRole('article', { name: 'Alex Smith' });

  fireEvent.click(screen.getByRole('link', { name: 'People directory' }));

  expect(window.location.pathname).toBe('/');
  expect(window.location.search).toBe('');
  expect(window.location.hash).toBe('');
  expect((screen.getByLabelText('Search people') as HTMLInputElement).value).toBe('');
  expect(screen.queryByRole('button', { name: 'Remove hobby reading' })).toBeNull();
});

it('shows invalid URL names and blocks requests when navigating from a valid search', async () => {
  window.history.replaceState(null, '', '/?q=Alex&sort=age');
  const fetchMock = mockSearch().mockResolvedValue(json(response()));
  mount();
  await screen.findByRole('article', { name: 'Alex Smith' });
  const requestCount = vi.mocked(fetch).mock.calls.length;

  await act(async () => {
    window.history.pushState(null, '', '/?q=Alex123&sort=nationality');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
  expect(vi.mocked(fetch).mock.calls).toHaveLength(requestCount);
  expect((screen.getByLabelText('Search people') as HTMLInputElement).value).toBe('Alex123');
  expect(screen.getByText(/Name is invalid/)).toBeTruthy();
  expect((screen.getByLabelText('Sort by') as HTMLSelectElement).value).toBe('nationality');
  expect(screen.queryByLabelText('Loading people')).toBeNull();

  fetchMock.mockResolvedValue(json(response('Jean')));
  fireEvent.change(screen.getByLabelText('Search people'), { target: { value: 'Jean' } });
  await screen.findByRole('article', { name: 'Jean Smith' });
  expect(new URLSearchParams(window.location.search).get('sort')).toBe('nationality');
});

it('shows a validation error and skips requests for an invalid initial URL name', async () => {
  window.history.replaceState(null, '', '/?q=Alex123');
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation((url) =>
      Promise.resolve(json(url === '/api/users/filter-options' ? filterOptions : response())),
    );
  mount();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByText(/Name is invalid/)).toBeTruthy();
  expect(screen.queryByLabelText('Loading people')).toBeNull();

  fireEvent.change(screen.getByLabelText('Search people'), { target: { value: 'Alex' } });
  await screen.findByRole('article', { name: 'Alex Smith' });
  expect(fetchMock).toHaveBeenCalled();
});

it('restores shared state and renders cards with only two hobby labels and remaining count', async () => {
  window.history.replaceState(
    null,
    '',
    '/?q=Alex&hobby=Reading&nationality=French&sort=age&direction=desc',
  );
  const fetchMock = mockSearch().mockResolvedValue(json(response()));
  mount();
  const card = await screen.findByRole('article', { name: 'Alex Smith' });
  expect(within(card).getByText('Reading')).toBeTruthy();
  expect(within(card).getByText('Swimming')).toBeTruthy();
  expect(within(card).queryByText('Chess')).toBeNull();
  expect(within(card).getByLabelText('2 more hobbies')).toBeTruthy();
  expect((screen.getByLabelText('Search people') as HTMLInputElement).value).toBe('Alex');
  expect(fetchMock.mock.calls[0]![0]).toBe('/api/users/search');
  expect(fetchMock.mock.calls[0]![1]?.method).toBe('POST');
  expect(fetchMock.mock.calls[0]![1]?.headers).toEqual({ 'Content-Type': 'application/json' });
  const params = requestBody(fetchMock.mock.calls[0]![1]);
  expect(params.hobbies).toEqual(['reading']);
  expect(params.sort).toBe('age');
  expect(params.direction).toBe('desc');
});

it('refreshes results and options on filter/search changes; keeps absent selections removable', async () => {
  const fetchMock = mockSearch().mockImplementation(async (_url, init) => {
    const selected = Boolean(requestBody(init).hobbies?.length);
    return json(
      selected
        ? {
            ...response(),
            users: [],
            pagination: { ...response().pagination, total: 0 },
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
  await userEvent.type(screen.getByLabelText('Search people'), "Jean-Luc O'Neil");
  await waitFor(() =>
    expect(requestBody(fetchMock.mock.calls.at(-1)![1]).q).toBe("Jean-Luc O'Neil"),
  );
  expect(new URLSearchParams(window.location.search).get('q')).toBe("Jean-Luc O'Neil");
});

it('keeps kate123 visible when typed without pausing after the valid prefix', async () => {
  mockSearch().mockImplementation(async () => json(response()));
  mount();
  await screen.findByRole('article');
  const search = screen.getByLabelText('Search people') as HTMLInputElement;
  await userEvent.type(search, 'kate123');
  expect(search.value).toBe('kate123');
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
  expect(search.value).toBe('kate123');
  expect(search.getAttribute('aria-invalid')).toBe('true');
});

it('keeps invalid names editable without updating the URL or requesting them', async () => {
  const fetchMock = mockSearch().mockImplementation(async () => json(response()));
  mount();
  await screen.findByRole('article');
  const search = screen.getByLabelText('Search people');
  await userEvent.type(search, 'Ana');
  await waitFor(() => expect(requestBody(fetchMock.mock.calls.at(-1)![1]).q).toBe('Ana'));
  const previousUrl = window.location.href;
  const previousRequests = fetchMock.mock.calls.length;

  await userEvent.type(search, '2@');
  expect((search as HTMLInputElement).value).toBe('Ana2@');
  expect(search.getAttribute('aria-invalid')).toBe('true');
  expect(
    screen.getByText(
      'Name is invalid. Include a letter and use single spaces, hyphens, apostrophes, and periods. Do not place apostrophes or hyphens next to each other.',
    ),
  ).toBeTruthy();
  expect(window.location.href).toBe(previousUrl);
  fireEvent.change(search, { target: { value: "Mary-Jane O'Neil 123!" } });
  expect((search as HTMLInputElement).value).toBe("Mary-Jane O'Neil 123!");
  expect(window.location.href).toBe(previousUrl);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
  expect(fetchMock.mock.calls).toHaveLength(previousRequests);

  for (const name of [' ', '   ', 'Ana  Smith', 'Ana   ', "Kate''", 'Kate--', "'''", '---']) {
    fireEvent.change(search, { target: { value: name } });
    expect((search as HTMLInputElement).value).toBe(name);
    expect(search.getAttribute('aria-invalid')).toBe('true');
    expect(window.location.href).toBe(previousUrl);
  }
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
  expect(fetchMock.mock.calls).toHaveLength(previousRequests);

  fireEvent.change(search, { target: { value: "Mary-Jane O'Neil" } });
  expect(new URLSearchParams(window.location.search).get('q')).toBe("Mary-Jane O'Neil");
  expect(search.getAttribute('aria-invalid')).not.toBe('true');
  await userEvent.clear(search);
  await userEvent.type(search, 'José.');
  expect(new URLSearchParams(window.location.search).get('q')).toBe('José.');
  await userEvent.type(search, '1');
  await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect((search as HTMLInputElement).value).toBe('');
  expect(new URLSearchParams(window.location.search).get('q')).toBeNull();
  expect(screen.queryByText(/Name is invalid/)).toBeNull();
});

it('loads a second page, resets pagination on sort, and handles browser navigation', async () => {
  const fetchMock = mockSearch().mockImplementation(async (_url, init) => {
    const offset = requestBody(init).offset ?? 0;
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
      fetchMock.mock.calls.some(([_url, init]) => {
        const params = requestBody(init);
        return params.sort === 'age' && params.offset === 0;
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
  mockSearch()
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
  mockSearch()
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
  mockSearch().mockImplementation(async () => json(response()));
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
});

const scrollResults = (top: number) => {
  const element = screen.getByRole('region', { name: 'Directory results' });
  fireEvent.scroll(element, { target: { scrollTop: top } });
  return element;
};

it('virtualizes the DOM, automatically loads pages once, and stops at the final page', async () => {
  const fetchMock = mockSearch().mockImplementation(async (_url, init) => {
    const offset = requestBody(init).offset ?? 0;
    return json(pageResponse(offset));
  });
  mount();
  await screen.findByRole('article', { name: 'Person 1 Smith' });
  expect(screen.getAllByRole('article').length).toBeLessThan(20);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  scrollResults(3800);
  await screen.findByText('Showing 40 of 45 people');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.getAllByRole('article').length).toBeLessThan(20);
  scrollResults(8600);
  await screen.findByText('Showing 45 of 45 people · End of results');
  scrollResults(10000);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(screen.queryByRole('button', { name: 'Load more people' })).toBeNull();
  const offsets = fetchMock.mock.calls.map(([_url, init]) => requestBody(init).offset);
  expect(offsets).toEqual([0, 20, 40]);
  const positions = screen.getAllByRole('listitem').map((row) => row.getAttribute('aria-posinset'));
  expect(new Set(positions).size).toBe(positions.length);
});

it('preserves loaded cards after a next-page error and retries only when requested', async () => {
  let failed = false;
  const fetchMock = mockSearch().mockImplementation(async (_url, init) => {
    const offset = requestBody(init).offset ?? 0;
    if (offset === 20 && !failed) {
      failed = true;
      throw new Error('Offline');
    }
    return json(pageResponse(offset, 40));
  });
  mount();
  await screen.findByRole('article', { name: 'Person 1 Smith' });
  scrollResults(3800);
  await screen.findByRole('alert');
  expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
  scrollResults(3700);
  scrollResults(3800);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('Showing 40 of 40 people · End of results');
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('resets scroll and cancels a pending next page when filters change', async () => {
  let finish: (value: Response) => void = () => {};
  let pendingSignal: AbortSignal | null | undefined;
  const fetchMock = mockSearch().mockImplementation(async (_url, init) => {
    const params = requestBody(init);
    if (params.hobbies?.length) return json(pageResponse(0, 1, 'Filtered'));
    if (params.offset === 20) {
      pendingSignal = init?.signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    }
    return json(pageResponse(0));
  });
  mount();
  await screen.findByRole('article', { name: 'Person 1 Smith' });
  scrollResults(3800);
  await screen.findByText('Loading more people…');
  scrollResults(3900);
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

it('keeps nationality options selectable while updated counts load', async () => {
  const options: FilterOptionsResponse = {
    hobbies: [],
    nationalities: [
      { value: 'French', count: 2 },
      { value: 'British', count: 1 },
    ],
  };
  const pending: Array<(response: Response) => void> = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
    if (url === '/api/users/filter-options') {
      if (requestBody(init).nationalities?.length) {
        return new Promise((resolve) => pending.push(resolve));
      }
      return Promise.resolve(json(options));
    }
    return Promise.resolve(json(response()));
  });
  mount();
  await screen.findByRole('checkbox', { name: 'French' });
  await userEvent.click(screen.getByRole('checkbox', { name: 'French' }));
  expect(screen.queryByLabelText('Loading top 20 nationalities')).toBeNull();
  expect((screen.getByRole('checkbox', { name: 'French' }) as HTMLInputElement).checked).toBe(true);
  await userEvent.click(screen.getByRole('checkbox', { name: 'British' }));
  expect(new URLSearchParams(window.location.search).getAll('nationality')).toEqual([
    'french',
    'british',
  ]);
  await act(async () => {
    for (const resolve of pending) resolve(json(options));
  });
  expect(screen.getAllByRole('checkbox')).toHaveLength(4);
});

it('loads options independently and does not refetch them for sorting or pagination', async () => {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (url, init) =>
      json(
        url === '/api/users/filter-options'
          ? filterOptions
          : pageResponse(requestBody(init).offset ?? 0),
      ),
    );
  const optionCalls = () =>
    fetchMock.mock.calls.filter(([url]) => url === '/api/users/filter-options');
  mount();
  await screen.findByRole('checkbox', { name: 'Reading' });
  await screen.findByRole('article', { name: 'Person 1 Smith' });
  expect(optionCalls()).toHaveLength(1);
  expect(requestBody(optionCalls()[0]![1])).toEqual({ q: '', hobbies: [], nationalities: [] });
  scrollResults(3800);
  await screen.findByText('Showing 40 of 45 people');
  await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'age');
  await screen.findByText('Showing 20 of 45 people');
  expect(optionCalls()).toHaveLength(1);
  await userEvent.click(screen.getByRole('checkbox', { name: 'Reading' }));
  await waitFor(() => expect(optionCalls()).toHaveLength(2));
  expect(requestBody(optionCalls()[1]![1]).hobbies).toEqual(['reading']);
  await userEvent.type(screen.getByLabelText('Search people'), 'Ana');
  await waitFor(() => expect(requestBody(optionCalls().at(-1)![1]).q).toBe('Ana'));
});

it('retries filter options independently while keeping loaded cards visible', async () => {
  let failed = false;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (url === '/api/users/filter-options') {
      if (!failed) {
        failed = true;
        throw new Error('Offline');
      }
      return json(filterOptions);
    }
    return json(response());
  });
  mount();
  await screen.findByRole('article');
  await screen.findByText('Unable to load filter options');
  await userEvent.click(screen.getByRole('button', { name: 'Retry filters' }));
  await screen.findByRole('checkbox', { name: 'Reading' });
  expect(fetchMock.mock.calls.filter(([url]) => url === '/api/users/search')).toHaveLength(1);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('cancels stale filter options when the text changes', async () => {
  let finish: (response: Response) => void = () => {};
  let pendingSignal: AbortSignal | null | undefined;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (url === '/api/users/search') return json(response());
    if (!requestBody(init).q) {
      pendingSignal = init?.signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    }
    return json({ hobbies: [{ value: 'Chess', count: 1 }], nationalities: [] });
  });
  mount();
  expect(screen.getByLabelText('Loading top 20 hobbies')).toBeTruthy();
  await userEvent.type(screen.getByLabelText('Search people'), 'Ana');
  await screen.findByRole('checkbox', { name: 'Chess' });
  expect(pendingSignal?.aborted).toBe(true);
  await act(async () => {
    finish(json(filterOptions));
  });
  expect(screen.queryByRole('checkbox', { name: 'Reading' })).toBeNull();
});

it('updates the URL immediately and debounces search requests while typing', async () => {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (url) =>
      json(url === '/api/users/filter-options' ? filterOptions : response()),
    );
  mount();
  await screen.findByRole('article');
  await screen.findByRole('checkbox', { name: 'Reading' });

  await userEvent.type(screen.getByLabelText('Search people'), 'Ana');
  expect(new URLSearchParams(window.location.search).get('q')).toBe('Ana');
  expect(fetchMock.mock.calls.filter(([, init]) => Boolean(requestBody(init).q))).toHaveLength(0);

  await waitFor(() =>
    expect(fetchMock.mock.calls.filter(([, init]) => requestBody(init).q === 'Ana')).toHaveLength(
      2,
    ),
  );
  expect(
    fetchMock.mock.calls.filter(([, init]) => {
      const q = requestBody(init).q;
      return q && q !== 'Ana';
    }),
  ).toHaveLength(0);
});
