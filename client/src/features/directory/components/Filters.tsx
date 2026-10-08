import { useEffect, useId, useState } from 'react';
import { Alert, Badge, Button, Checkbox, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import { MAX_NATIONALITY_FILTERS, MAX_HOBBY_FILTERS, type FilterOption } from '@presight/shared';
import { fold, type DirectoryState } from '../state';

interface Props {
  state: DirectoryState;
  options?: { hobbies: FilterOption[]; nationalities: FilterOption[] };
  loading: boolean;
  failed: boolean;
  onToggle: (key: 'hobbies' | 'nationalities', value: string) => void;
  onClearGroup: (key: 'hobbies' | 'nationalities') => void;
  onClear: () => void;
  onRetry: () => void;
}

const selectedFirst = (options: FilterOption[], selected: string[]) => {
  const selectedValues = new Set(selected);
  return [...options].sort(
    (left, right) =>
      Number(selectedValues.has(fold(right.value))) - Number(selectedValues.has(fold(left.value))),
  );
};

const FilterGroup = ({
  title,
  anyLabel,
  onAny,
  hint,
  options,
  selected,
  max,
  loading,
  failed,
  onToggle,
}: {
  title: string;
  anyLabel: string;
  onAny: () => void;
  hint: string;
  options?: FilterOption[];
  selected: string[];
  max: number;
  loading: boolean;
  failed: boolean;
  onToggle: (value: string) => void;
}) => {
  const [expanded, setExpanded] = useState(true);
  const optionsId = useId();
  useEffect(() => {
    if (selected.length > 0) setExpanded(true);
  }, [selected.length]);
  return (
    <Stack gap="sm" className="filter-group">
      <div>
        <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
          <Title order={3} size="h5">
            {title}
          </Title>
          <Checkbox
            label="Any"
            aria-label={anyLabel}
            size="xs"
            color="brand"
            checked={!expanded}
            aria-controls={optionsId}
            aria-expanded={expanded}
            onChange={(event) => {
              const any = event.currentTarget.checked;
              setExpanded(!any);
              if (any) onAny();
            }}
          />
        </Group>
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      </div>
      <Stack id={optionsId} gap="sm" hidden={!expanded}>
        {expanded &&
          (loading ? (
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
            selectedFirst(options, selected).map(({ value, count }) => {
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
          ))}
      </Stack>
    </Stack>
  );
};

export const Filters = ({
  state,
  options,
  loading,
  failed,
  onToggle,
  onClearGroup,
  onClear,
  onRetry,
}: Props) => (
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
      anyLabel="Any nationality"
      onAny={() => onClearGroup('nationalities')}
      hint="Match any selected nationality · counts use name and hobby filters"
      options={options?.nationalities}
      selected={state.nationalities}
      max={MAX_NATIONALITY_FILTERS}
      loading={loading}
      failed={failed}
      onToggle={(value) => onToggle('nationalities', value)}
    />
    <FilterGroup
      title="Top 20 hobbies"
      anyLabel="Any hobbies"
      onAny={() => onClearGroup('hobbies')}
      hint={`Match all selected hobbies · up to ${MAX_HOBBY_FILTERS}`}
      options={options?.hobbies}
      selected={state.hobbies}
      max={MAX_HOBBY_FILTERS}
      loading={loading}
      failed={failed}
      onToggle={(value) => onToggle('hobbies', value)}
    />
  </Stack>
);
