// Type-only API contract. Consumers must use `import type`.
export type SortFields = readonly ['first_name', 'last_name', 'age', 'nationality'];
export type SortField = SortFields[number];
export type SortDirection = 'asc' | 'desc';

export interface DirectoryUser {
  id: number;
  avatar: string;
  first_name: string;
  last_name: string;
  nationality: string;
  age: number;
  hobbies: string[];
}

export interface FilterOption {
  value: string;
  count: number;
}

export interface DirectoryPagination {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
}

export interface DirectoryResponse {
  users: DirectoryUser[];
  pagination: DirectoryPagination;
  filterOptions: {
    hobbies: FilterOption[];
    nationalities: FilterOption[];
  };
}
