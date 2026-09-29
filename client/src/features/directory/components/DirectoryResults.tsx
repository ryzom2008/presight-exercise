import { Alert, Button, Paper, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useDirectory } from '../api';
import { VirtualUserList } from './VirtualUserList';

export const DirectoryResults = ({
  query,
  active,
  onClear,
}: {
  query: ReturnType<typeof useDirectory>;
  active: boolean;
  onClear: () => void;
}) => {
  const firstPage = query.data?.pages[0];
  const users = query.data?.pages.flatMap((page) => page.users) ?? [];
  return (
    <>
      {query.isError && !query.isFetchNextPageError && (
        <Alert color="red" title="Unable to load directory" role="alert">
          <Text size="sm">{query.error.message}</Text>
          <Button
            mt="sm"
            size="xs"
            color="red"
            variant="light"
            onClick={() => void query.refetch()}
          >
            Try again
          </Button>
        </Alert>
      )}
      {query.isPending ? (
        <Stack gap="sm" className="mobile-card-list-gap" aria-label="Loading people">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} h={{ base: 120, sm: 156 }} radius="md" />
          ))}
        </Stack>
      ) : firstPage && users.length === 0 ? (
        <Paper withBorder p="xl" ta="center">
          <Title order={2}>No people found</Title>
          <Text c="dimmed" mt="sm">
            Try another name or remove a filter to broaden your search.
          </Text>
          {active && (
            <Button mt="lg" variant="light" onClick={onClear}>
              Clear search and filters
            </Button>
          )}
        </Paper>
      ) : (
        users.length > 0 && (
          <VirtualUserList
            users={users}
            total={firstPage?.pagination.total ?? 0}
            hasMore={query.hasNextPage}
            fetching={query.isFetching}
            failed={query.isError}
            onLoadMore={() => void query.fetchNextPage({ cancelRefetch: false })}
          />
        )
      )}
      {query.isFetchNextPageError && (
        <Alert color="red" title="Could not load more people" role="alert">
          <Text size="sm">Your loaded results are still available.</Text>
          <Button
            mt="sm"
            variant="light"
            color="red"
            onClick={() => void query.fetchNextPage({ cancelRefetch: false })}
          >
            Try again
          </Button>
        </Alert>
      )}
      {query.isFetchingNextPage && (
        <Text role="status" size="sm" c="dimmed" ta="center">
          Loading more people…
        </Text>
      )}
      {users.length > 0 && (
        <Text size="sm" c="dimmed" ta="center">
          Showing {users.length.toLocaleString()} of {firstPage?.pagination.total.toLocaleString()}{' '}
          people{!query.hasNextPage ? ' · End of results' : ''}
        </Text>
      )}
    </>
  );
};
