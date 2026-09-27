import { Box, Container, Group, Paper, Stack, Text, Title } from '@mantine/core';

export function App() {
  return (
    <>
      <Box component="header" bg="white" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Group h={64} px="md">
          <Text fw={700} c="brand">
            People Directory
          </Text>
        </Group>
      </Box>
      <Container component="main" size="lg" py={{ base: 32, md: 56 }}>
        <Stack gap={32}>
          <div>
            <Title order={1} fz={{ base: '1.875rem', md: '2.25rem' }} style={{ letterSpacing: '-0.04em' }}>
              Discover people
            </Title>
            <Text c="dimmed" mt={8}>
              Explore a world of people and shared interests.
            </Text>
          </div>
          <Paper withBorder bg="white" radius="md" p={{ base: 24, md: 40 }}>
            <Title order={2}>Your directory is taking shape</Title>
            <Text c="dimmed" mt={8} maw={560}>
              Search, filters, and user profiles are coming soon.
            </Text>
          </Paper>
        </Stack>
      </Container>
    </>
  );
}
