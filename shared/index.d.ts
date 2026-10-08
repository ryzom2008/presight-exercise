export const NAME_SEARCH_MAX_LENGTH: number;
export const MAX_NATIONALITY_FILTERS: number;
export const MAX_HOBBY_FILTERS: number;

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
}

export interface DirectoryFilterRequest {
  q?: string;
  nationalities?: string[];
  hobbies?: string[];
}

export interface DirectorySearchRequest extends DirectoryFilterRequest {
  sort?: SortField;
  direction?: SortDirection;
  offset?: number;
  limit?: number;
}

export interface FilterOptionsResponse {
  hobbies: FilterOption[];
  nationalities: FilterOption[];
}
