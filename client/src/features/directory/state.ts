import type { SortField, SortFields, SortDirection } from '@presight/shared';
export const sortFields = [
  'first_name',
  'last_name',
  'age',
  'nationality',
] as const satisfies SortFields;
export interface DirectoryState {
  q: string;
  nationalities: string[];
  hobbies: string[];
  sort: SortField;
  direction: SortDirection;
}

export const defaults: DirectoryState = {
  q: '',
  nationalities: [],
  hobbies: [],
  sort: 'first_name',
  direction: 'asc',
};
export const fold = (value: string) => value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());

const disallowedInNameSearch = /[^\p{L}\p{M} .'’ʼ-]/gu;

export const sanitizeNameSearch = (value: string) =>
  value.replace(disallowedInNameSearch, '').slice(0, 200);
const readValues = (params: URLSearchParams, key: string, limit: number) =>
  [
    ...new Set(
      params
        .getAll(key)
        .map((value) => fold(value.trim()))
        .filter((value) => value.length > 0 && value.length <= 100),
    ),
  ].slice(0, limit);

export const readState = (search: string): DirectoryState => {
  const params = new URLSearchParams(search);
  const sort = params.get('sort') as SortField;
  return {
    q: sanitizeNameSearch(params.get('q') ?? ''),
    nationalities: readValues(params, 'nationality', 50),
    hobbies: readValues(params, 'hobby', 10),
    sort: sortFields.includes(sort) ? sort : defaults.sort,
    direction: params.get('direction') === 'desc' ? 'desc' : 'asc',
  };
};

export const stateParams = (state: DirectoryState): URLSearchParams => {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  for (const value of state.nationalities) params.append('nationality', value);
  for (const value of state.hobbies) params.append('hobby', value);
  params.set('sort', state.sort);
  params.set('direction', state.direction);
  return params;
};
