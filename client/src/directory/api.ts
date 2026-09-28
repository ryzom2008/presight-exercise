import type { DirectoryResponse } from '@presight/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { stateParams, type DirectoryState } from './state';

export const useDirectory = (state: DirectoryState) => {
  const search = stateParams(state).toString();
  return useInfiniteQuery({
    queryKey: ['users', search],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }): Promise<DirectoryResponse> => {
      const params = new URLSearchParams(search);
      params.set('offset', String(pageParam));
      params.set('limit', '20');
      const response = await fetch(`/api/users?${params}`, { signal });
      if (!response.ok) throw new Error('Unable to load the directory. Please try again.');
      return response.json();
    },
    getNextPageParam: (last) => last.pagination.nextOffset ?? undefined,
    retry: false,
    refetchOnWindowFocus: false,
  });
};
