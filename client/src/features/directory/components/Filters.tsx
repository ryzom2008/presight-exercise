import { Alert, Badge, Button, Checkbox, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import type { FilterOption } from '@presight/shared';
import { fold, type DirectoryState } from '../state';

interface Props {
  state: DirectoryState;
  options?: { hobbies: FilterOption[]; nationalities: FilterOption[] };
  loading: boolean;
  failed: boolean;
  onToggle: (key: 'hobbies' | 'nationalities', value: string) => void;
  onClear: () => void;
  onRetry: () => void;
}

const FilterGroup = ({
  title,
  hint,
  options,
  selected,
  max,
  loading,
  failed,
  onToggle,
}: {
  title: string;
  hint: string;
  options?: FilterOption[];
  selected: string[];
  max: number;
  loading: boolean;
  failed: boolean;
  onToggle: (value: string) => void;
}) => (
  <Stack gap="sm" className="filter-group">
    <div>
      <Title order={3} size="h5">
        {title}
      </Title>
      <Text size="xs" c="dimmed">
        {hint}
      </Text>
    </div>
    {loading ? (
      <Stack gap="xs" aria-label={`Loading ${title.toLowerCase()}`}>
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} height={24} />
        ))}
      </Stack>
    ) : failed ? (
      <Text size="sm" c="dimmed">
        Filter options unavailable.
      </Text>
    ) : !options?.length ? (
      <Text size="sm" c="dimmed">
        No matching options
      </Text>
    ) : (
      options.map(({ value, count }) => {
        const checked = selected.includes(fold(value));
        return (
          <Group
            key={value}
            justify="space-between"
            wrap="nowrap"
            gap="xs"
            className="filter-option"
            data-selected={checked || undefined}
          >
            <Checkbox
              color="brand"
              label={value}
              checked={checked}
              onChange={() => onToggle(value)}
              disabled={!checked && selected.length >= max}
              styles={{ root: { flex: 1, minWidth: 0 }, label: { overflowWrap: 'anywhere' } }}
            />
            <Badge
              variant="light"
              color={checked ? 'brand' : 'gray'}
              size="sm"
              aria-label={`${count} matching people`}
            >
              {count.toLocaleString()}
            </Badge>
          </Group>
        );
      })
    )}
  </Stack>
);

export const Filters = ({ state, options, loading, failed, onToggle, onClear, onRetry }: Props) => (
  <Stack gap="xl" className="directory-filters">
    <Group justify="space-between">
      <Title order={2}>Refine results</Title>
      <Button
        variant="subtle"
        size="compact-sm"
        onClick={onClear}
        disabled={!state.hobbies.length && !state.nationalities.length}
      >
        Clear
      </Button>
    </Group>
    {failed && (
      <Alert color="red" title="Unable to load filter options" role="alert">
        <Button variant="light" onClick={onRetry}>
          Retry filters
        </Button>
      </Alert>
    )}
    <FilterGroup
      title="Top 20 nationalities"
      hint="Match any selected nationality"
      options={options?.nationalities}
      selected={state.nationalities}
      max={50}
      loading={loading}
      failed={failed}
      onToggle={(value) => onToggle('nationalities', value)}
    />
    <FilterGroup
      title="Top 20 hobbies"
      hint="Match all selected hobbies · up to 10"
      options={options?.hobbies}
      selected={state.hobbies}
      max={10}
      loading={loading}
      failed={failed}
      onToggle={(value) => onToggle('hobbies', value)}
    />
  </Stack>
);
