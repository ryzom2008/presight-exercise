import { Avatar, Badge, Group, Text } from '@mantine/core';
import type { DirectoryUser } from '@presight/shared';

export const UserCard = ({ user }: { user: DirectoryUser }) => (
  <article className="user-card" aria-label={`${user.first_name} ${user.last_name}`}>
    <Avatar src={user.avatar} alt="" radius={0} className="user-card-portrait">
      {user.first_name[0]}
      {user.last_name[0]}
    </Avatar>
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
          <Badge
            color="brand.2"
            variant="outline"
            aria-label={`${user.hobbies.length - 2} more hobbies`}
          >
            +{user.hobbies.length - 2}
          </Badge>
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
