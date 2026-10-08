import { Avatar, Badge, Group, Text, Tooltip } from '@mantine/core';
import type { DirectoryUser } from '@presight/shared';

export const UserCard = ({ user }: { user: DirectoryUser }) => (
  <article className="user-card" aria-label={`${user.first_name} ${user.last_name}`}>
    <Avatar
      src={user.avatar?.trim() || null}
      alt=""
      radius={0}
      className="user-card-portrait"
      imageProps={{ referrerPolicy: 'no-referrer' }}
    />
    <div className="user-card-panel">
      <Text component="h3" className="user-card-name break-text">
        {user.first_name} {user.last_name}
      </Text>
      <Text className="user-card-meta break-text">
        {user.nationality} · age: {user.age}
      </Text>
      <Group gap={6} mt="md">
        {user.hobbies.slice(0, 2).map((hobby) => (
          <Badge key={hobby} variant="outline" color="brand.2" tt="none">
            {hobby}
          </Badge>
        ))}
        {user.hobbies.length > 2 && (
          <Tooltip
            label={user.hobbies.slice(2).join(', ')}
            multiline
            maw={280}
            events={{ hover: true, focus: true, touch: true }}
          >
            <Badge
              color="brand.2"
              variant="outline"
              tabIndex={0}
              aria-label={`${user.hobbies.length - 2} more hobbies`}
            >
              +{user.hobbies.length - 2}
            </Badge>
          </Tooltip>
        )}
        {!user.hobbies.length && (
          <Text size="sm" className="user-card-meta">
            No hobbies listed
          </Text>
        )}
      </Group>
    </div>
  </article>
);
