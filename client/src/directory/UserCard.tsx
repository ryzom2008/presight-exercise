import { Avatar, Badge, Group, Paper, Stack, Text } from '@mantine/core';
import type { DirectoryUser } from '@presight/shared';

export const UserCard = ({ user }: { user: DirectoryUser }) => (
  <Paper
    component="article"
    withBorder
    p={{ base: 12, sm: 'lg' }}
    className="user-card"
    aria-label={`${user.first_name} ${user.last_name}`}
  >
    <Group align="flex-start" wrap="nowrap" gap="md" className="mobile-card-content-gap">
      <Avatar
        src={user.avatar}
        alt=""
        size={56}
        w={{ base: 44, sm: 56 }}
        h={{ base: 44, sm: 56 }}
        radius="xl"
        color="brand"
      >
        {user.first_name[0]}
        {user.last_name[0]}
      </Avatar>
      <Stack gap={8} className="mobile-card-details-gap" style={{ minWidth: 0, flex: 1 }}>
        <Group gap="xs" justify="space-between" align="flex-start" wrap="nowrap">
          <Text component="h3" fw={650} size="lg" m={0} className="break-text" style={{ minWidth: 0 }}>
            {user.first_name} {user.last_name}
          </Text>
          <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
            age: {user.age}
          </Text>
        </Group>
        <Text size="sm" c="dimmed" className="break-text">
          {user.nationality}
        </Text>
        <Group gap={6} className="mobile-card-details-gap" mt={{ base: 2, sm: 4 }}>
          {user.hobbies.slice(0, 2).map((hobby) => (
            <Badge key={hobby} variant="light" color="brand" tt="none">
              {hobby}
            </Badge>
          ))}
          {user.hobbies.length > 2 && (
            <Badge
              color="gray"
              variant="light"
              aria-label={`${user.hobbies.length - 2} more hobbies`}
            >
              +{user.hobbies.length - 2}
            </Badge>
          )}
          {!user.hobbies.length && (
            <Text size="xs" c="dimmed">
              No hobbies listed
            </Text>
          )}
        </Group>
      </Stack>
    </Group>
  </Paper>
);
