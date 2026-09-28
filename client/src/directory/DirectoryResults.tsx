import { Alert, Button, Paper, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useDirectory } from './api';
import { UserCard } from './UserCard';

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
      {query.isError && (
        <Alert
          color="red"
          title={
            query.isFetchNextPageError ? 'Could not load more people' : 'Unable to load directory'
          }
          role="alert"
        >
          <Text size="sm">{query.error.message}</Text>
          <Button
            mt="sm"
            size="xs"
            color="red"
            variant="light"
            onClick={() =>
              query.isFetchNextPageError ? void query.fetchNextPage() : void query.refetch()
            }
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
        <Stack gap="sm" className="mobile-card-list-gap" aria-label="People">
          {users.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
        </Stack>
      )}
      {query.hasNextPage && !query.isFetchNextPageError && (
        <Button
          variant="light"
          loading={query.isFetchingNextPage}
          disabled={query.isFetching}
          onClick={() => void query.fetchNextPage()}
        >
          Load more people
        </Button>
      )}
      {users.length > 0 && (
        <Text size="sm" c="dimmed" ta="center">
          Showing {users.length.toLocaleString()} of {firstPage?.pagination.total.toLocaleString()}{' '}
          people
        </Text>
      )}
    </>
  );
};
