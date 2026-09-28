import { useState } from 'react';
import {
  Box,
  Button,
  Container,
  Drawer,
  Group,
  Paper,
  Pill,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useDirectory } from './directory/api';
import { Filters } from './directory/Filters';
import { DirectoryControls } from './directory/DirectoryControls';
import { DirectoryResults } from './directory/DirectoryResults';
import { fold, stateParams } from './directory/state';
import { useDirectoryState } from './directory/useDirectoryState';
import './directory/styles.css';

export const App = () => {
  const { state, update } = useDirectoryState();
  const query = useDirectory(state);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const desktop = useMediaQuery('(min-width: 62em)');
  const firstPage = query.data?.pages[0];
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
      options={firstPage?.filterOptions}
      loading={query.isPending}
      failed={query.isError && !firstPage}
      onToggle={toggle}
      onClear={clearFilters}
    />
  );

  return (
    <>
      <Box component="header" bg="white" className="site-header">
        <Container size="lg">
          <Group h={{ base: 56, sm: 68 }} justify="space-between">
            <Group gap="sm">
              <Box className="brand-mark" aria-hidden="true">
                P
              </Box>
              <Text fw={750} c="brand">
                People Directory
              </Text>
            </Group>
            <Text size="sm" c="dimmed" visibleFrom="sm">
              People. Interests. Connections.
            </Text>
          </Group>
        </Container>
      </Box>
      <Container component="main" size="lg" py={{ base: 16, sm: 28 }} px={{ base: 12, sm: 'md' }}>
        <Stack gap="lg" className="mobile-section-gap">
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
            <Stack gap="md" className="mobile-results-gap" style={{ minWidth: 0 }}>
              <Group justify="space-between">
                <Text role="status" aria-live="polite" fw={600}>
                  {query.isPending
                    ? 'Finding people…'
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
              <DirectoryResults
                key={stateParams(state).toString()}
                query={query}
                active={active}
                onClear={() => update({ q: '', hobbies: [], nationalities: [] })}
              />
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
