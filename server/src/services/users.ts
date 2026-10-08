import type { DirectoryResponse, DirectoryUser } from '@presight/shared';
import type { UserRepository } from '../repositories/users.js';
import type { UserQuery, UserFilters } from '../validation/userQuery.js';

export class UserNotFound extends Error {
  constructor() {
    super('User not found');
    this.name = 'UserNotFound';
  }
}

export const createUserService = (repository: UserRepository) => ({
  getFilterOptions: (filters: UserFilters) => repository.filterOptions(filters),
  findUsers: (query: UserQuery): DirectoryResponse => {
    const { users, total } = repository.find(query);
    const nextOffset = query.offset + users.length;
    const hasMore = nextOffset < total;

    return {
      users,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore,
        nextOffset: hasMore ? nextOffset : null,
      },
    };
  },
  findUserById: (id: number): DirectoryUser => {
    const user = repository.findById(id);
    if (!user) throw new UserNotFound();
    return user;
  },
});

export type UserService = ReturnType<typeof createUserService>;
