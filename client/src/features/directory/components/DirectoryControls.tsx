import { useEffect, useState } from 'react';
import { Button, NativeSelect, Paper, TextInput } from '@mantine/core';
import { isValidNameSearch, type DirectoryState } from '../state';
import { NAME_SEARCH_MAX_LENGTH } from '@presight/shared';
import type { SortField, SortDirection } from '@presight/shared';

const nameSearchError =
  'Name is invalid. Include a letter and use single spaces, hyphens, apostrophes, and periods. Do not place apostrophes or hyphens next to each other.';

export const DirectoryControls = ({
  state,
  update,
}: {
  state: DirectoryState;
  update: (patch: Partial<DirectoryState>, replace?: boolean) => void;
}) => {
  const [name, setName] = useState(state.q);
  const invalidName = !isValidNameSearch(name);

  useEffect(() => {
    setName(state.q);
  }, [state.q]);

  return (
    <Paper withBorder p={12} className="directory-controls">
      <TextInput
        leftSection={
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
        }
        label="Search people"
        placeholder="Search by first or last name"
        value={name}
        maxLength={NAME_SEARCH_MAX_LENGTH}
        error={invalidName ? nameSearchError : undefined}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          setName(raw);
          if (isValidNameSearch(raw)) update({ q: raw }, true);
        }}
        className="search-control"
        rightSection={
          name ? (
            <Button
              size="compact-xs"
              variant="subtle"
              aria-label="Clear search"
              onClick={() => {
                setName('');
                update({ q: '' }, true);
              }}
            >
              ×
            </Button>
          ) : undefined
        }
      />
      <NativeSelect
        label="Sort by"
        value={state.sort}
        onChange={(event) => update({ sort: event.currentTarget.value as SortField })}
        data={[
          { value: 'first_name', label: 'First name' },
          { value: 'last_name', label: 'Last name' },
          { value: 'age', label: 'Age' },
          { value: 'nationality', label: 'Nationality' },
        ]}
      />
      <NativeSelect
        label="Direction"
        value={state.direction}
        onChange={(event) => update({ direction: event.currentTarget.value as SortDirection })}
        data={[
          { value: 'asc', label: 'Ascending' },
          { value: 'desc', label: 'Descending' },
        ]}
      />
    </Paper>
  );
};
