import { Button, NativeSelect, Paper, TextInput } from '@mantine/core';
import type { DirectoryState } from './state';
import type { SortField, SortDirection } from '@presight/shared';

export const DirectoryControls = ({
  state,
  update,
}: {
  state: DirectoryState;
  update: (patch: Partial<DirectoryState>, replace?: boolean) => void;
}) => (
  <Paper withBorder p={{ base: 12, sm: 'md' }} className="directory-controls">
    <TextInput
      label="Search people"
      placeholder="Search by first or last name"
      value={state.q}
      maxLength={200}
      onChange={(event) => update({ q: event.currentTarget.value }, true)}
      className="search-control"
      rightSection={
        state.q ? (
          <Button
            size="compact-xs"
            variant="subtle"
            aria-label="Clear search"
            onClick={() => update({ q: '' }, true)}
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
