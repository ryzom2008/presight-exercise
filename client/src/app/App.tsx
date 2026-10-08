import { useMemo, useState } from 'react';
import { Button, Container, Drawer, Group, Paper, Pill, Stack, Text, Title } from '@mantine/core';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { useDirectory, useFilterOptions } from '../features/directory/api';
import { Filters } from '../features/directory/components/Filters';
import { DirectoryControls } from '../features/directory/components/DirectoryControls';
import { DirectoryResults } from '../features/directory/components/DirectoryResults';
import { fold, isValidNameSearch, stateParams } from '../features/directory/state';
import { useDirectoryState } from '../features/directory/hooks/useDirectoryState';
import '../features/directory/styles.css';

export const App = () => {
  const { state, update, goHome } = useDirectoryState();
  const [debouncedSearch] = useDebouncedValue(state.q, 300);
  const requestState = useMemo(() => ({ ...state, q: debouncedSearch }), [state, debouncedSearch]);

  const ready = isValidNameSearch(state.q) && isValidNameSearch(debouncedSearch);
  const usersQuery = useDirectory(requestState, ready);
  const filterQuery = useFilterOptions(requestState, ready);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const desktop = useMediaQuery('(min-width: 62em)');
  const firstPage = usersQuery.data?.pages[0];
  const selectedCount = state.hobbies.length + state.nationalities.length;
  const active = selectedCount > 0 || state.q.length > 0;

  const toggle = (key: 'hobbies' | 'nationalities', value: string) => {
    const normalized = fold(value);
    update({
      [key]: state[key].includes(normalized)
        ? state[key].filter((item) => item !== normalized)
        : [...state[key], normalized],
    });
  };

  const clearFilters = () => update({ hobbies: [], nationalities: [] });

  const selectedFilters = (
    <Group gap="xs" aria-label="Selected filters">
      {(['nationalities', 'hobbies'] as const).flatMap((key) =>
        state[key].map((value) => (
          <Pill
            key={`${key}:${value}`}
            withRemoveButton
            onRemove={() => toggle(key, value)}
            removeButtonProps={{
              tabIndex: 0,
              'aria-hidden': false,
              'aria-label': `Remove ${key === 'hobbies' ? 'hobby' : 'nationality'} ${value}`,
            }}
          >
            {value}
          </Pill>
        )),
      )}
    </Group>
  );

  const filterPanel = (
    <Filters
      state={state}
      options={filterQuery.data}
      loading={filterQuery.isLoading}
      failed={filterQuery.isError}
      onRetry={() => void filterQuery.refetch()}
      onToggle={toggle}
      onClearGroup={(key) => update({ [key]: [] })}
      onClear={clearFilters}
    />
  );

  return (
    <>
      <Container
        component="main"
        size="lg"
        className="directory-page"
        py={12}
        px={{ base: 12, sm: 'md' }}
      >
        <Stack gap={12} className="directory-shell">
          <section className="directory-intro" aria-labelledby="directory-heading">
            <Title order={1} id="directory-heading" className="directory-heading">
              <a
                href="/"
                className="directory-home-link"
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  setDrawerOpen(false);
                  goHome();
                }}
              >
                People directory
              </a>
            </Title>
            <Text className="directory-intro-copy">Find people. Discover shared interests.</Text>
          </section>
          <DirectoryControls state={state} update={update} />
          <div className="directory-layout">
            {desktop && (
              <Paper
                component="aside"
                aria-label="Directory filters"
                withBorder
                p="lg"
                className="filter-sidebar"
              >
                {filterPanel}
              </Paper>
            )}
            <Stack gap="md" className="directory-results mobile-results-gap">
              <Group justify="space-between">
                <Text role="status" aria-live="polite" fw={600}>
                  {!ready
                    ? 'Enter a name to search'
                    : usersQuery.isPending
                      ? 'Finding people for you…'
                      : firstPage
                        ? `${firstPage.pagination.total.toLocaleString()} people found`
                        : 'Directory unavailable'}
                </Text>
                {!desktop && (
                  <Button variant="default" onClick={() => setDrawerOpen(true)}>
                    Filters{selectedCount ? ` (${selectedCount})` : ''}
                  </Button>
                )}
                {active && (
                  <Button
                    variant="subtle"
                    size="compact-sm"
                    onClick={() => update({ q: '', hobbies: [], nationalities: [] })}
                  >
                    Clear all
                  </Button>
                )}
              </Group>
              {selectedCount > 0 && selectedFilters}
              {ready && (
                <DirectoryResults
                  key={stateParams(requestState).toString()}
                  query={usersQuery}
                  active={active}
                  onClear={() => update({ q: '', hobbies: [], nationalities: [] })}
                />
              )}
            </Stack>
          </div>
        </Stack>
      </Container>
      <Drawer
        opened={drawerOpen && !desktop}
        onClose={() => setDrawerOpen(false)}
        title="Directory filters"
        size="min(100%, 380px)"
        closeButtonProps={{ 'aria-label': 'Close filters' }}
      >
        <Stack gap="lg">
          {selectedCount > 0 && selectedFilters}
          {filterPanel}
          <Button onClick={() => setDrawerOpen(false)}>Show results</Button>
        </Stack>
      </Drawer>
    </>
  );
};
