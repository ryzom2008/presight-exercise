import { Badge, Button, Checkbox, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import type { FilterOption } from '@presight/shared';
import { fold, type DirectoryState } from './state';

interface Props {
  state: DirectoryState;
  options?: { hobbies: FilterOption[]; nationalities: FilterOption[] };
  loading: boolean;
  failed: boolean;
  onToggle: (key: 'hobbies' | 'nationalities', value: string) => void;
  onClear: () => void;
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
  <Stack gap="sm">
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
        Filters unavailable. Retry loading the directory.
      </Text>
    ) : !options?.length ? (
      <Text size="sm" c="dimmed">
        No matching options
      </Text>
    ) : (
      options.map(({ value, count }) => {
        const checked = selected.includes(fold(value));
        return (
          <Group key={value} justify="space-between" wrap="nowrap" gap="xs">
            <Checkbox
              label={value}
              checked={checked}
              onChange={() => onToggle(value)}
              disabled={!checked && selected.length >= max}
              styles={{ root: { flex: 1, minWidth: 0 }, label: { overflowWrap: 'anywhere' } }}
            />
            <Badge variant="light" color="gray" size="sm" aria-label={`${count} matching people`}>
              {count.toLocaleString()}
            </Badge>
          </Group>
        );
      })
    )}
  </Stack>
);

export const Filters = ({ state, options, loading, failed, onToggle, onClear }: Props) => (
  <Stack gap="xl">
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
    <FilterGroup
      title="Nationality"
      hint="Match any selected nationality"
      options={options?.nationalities}
      selected={state.nationalities}
      max={50}
      loading={loading}
      failed={failed}
      onToggle={(value) => onToggle('nationalities', value)}
    />
    <FilterGroup
      title="Hobbies"
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
