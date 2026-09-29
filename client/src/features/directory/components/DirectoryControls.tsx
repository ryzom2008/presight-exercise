import { useEffect, useState } from 'react';
import { Button, NativeSelect, Paper, TextInput } from '@mantine/core';
import { sanitizeNameSearch, type DirectoryState } from '../state';
import type { SortField, SortDirection } from '@presight/shared';

const nameSearchError = 'Letters, spaces, hyphens, apostrophes, and periods only.';

export const DirectoryControls = ({
  state,
  update,
}: {
  state: DirectoryState;
  update: (patch: Partial<DirectoryState>, replace?: boolean) => void;
}) => {
  const [rejectedCharacters, setRejectedCharacters] = useState(false);
  useEffect(() => {
    if (state.q === '') setRejectedCharacters(false);
  }, [state.q]);

  return (
    <Paper withBorder p={{ base: 12, sm: 'md' }} className="directory-controls">
      <TextInput
        label="Search people"
        placeholder="Search by first or last name"
        value={state.q}
        maxLength={200}
        error={rejectedCharacters ? nameSearchError : undefined}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          const next = sanitizeNameSearch(raw);
          setRejectedCharacters(next !== raw);
          update({ q: next }, true);
        }}
        className="search-control"
        rightSection={
          state.q ? (
            <Button
              size="compact-xs"
              variant="subtle"
              aria-label="Clear search"
              onClick={() => {
                setRejectedCharacters(false);
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
