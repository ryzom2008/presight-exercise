import type {
  DirectoryFilterRequest,
  DirectoryResponse,
  DirectorySearchRequest,
  FilterOptionsResponse,
} from '@presight/shared';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { stateParams, type DirectoryState } from './state';

export const useDirectory = (state: DirectoryState, enabled = true) => {
  const search = stateParams(state).toString();
  return useInfiniteQuery({
    enabled,
    queryKey: ['users', search],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }): Promise<DirectoryResponse> => {
      const body: DirectorySearchRequest = { ...state, offset: pageParam, limit: 20 };
      const response = await fetch('/api/users/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
      if (!response.ok) throw new Error('Unable to load the directory. Please try again.');
      return response.json();
    },
    getNextPageParam: (last) => last.pagination.nextOffset ?? undefined,
    retry: false,
    refetchOnWindowFocus: false,
  });
};

export const useFilterOptions = (state: DirectoryState, enabled = true) => {
  const filters: DirectoryFilterRequest = {
    q: state.q,
    nationalities: state.nationalities,
    hobbies: state.hobbies,
  };
  return useQuery({
    enabled,
    queryKey: ['filterOptions', filters],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<FilterOptionsResponse> => {
      const response = await fetch('/api/users/filter-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
        signal,
      });
      if (!response.ok) throw new Error('Unable to load filter options. Please try again.');
      return response.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
};
