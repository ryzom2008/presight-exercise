import type { UserQuery, UserFilters } from '../validation/userQuery.js';

export interface UserFilter {
  where: string;
  params: (string | number)[];
}

const placeholders = (count: number) => Array(count).fill('?').join(',');

export const buildUserFilter = (query: UserFilters): UserFilter => {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (query.q) {
    const pattern = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`;
    clauses.push(`(u.first_name LIKE ? ESCAPE '\\' OR u.last_name LIKE ? ESCAPE '\\'
      OR (u.first_name || ' ' || u.last_name) LIKE ? ESCAPE '\\')`);
    params.push(pattern, pattern, pattern);
  }

  if (query.nationalities.length) {
    clauses.push(`u.nationality IN (${placeholders(query.nationalities.length)})`);
    params.push(...query.nationalities);
  }

  for (const hobby of query.hobbies) {
    clauses.push(`EXISTS (SELECT 1 FROM user_hobbies uh JOIN hobbies h ON h.id = uh.hobby_id
      WHERE uh.user_id = u.id AND h.value = ?)`);
    params.push(hobby);
  }

  return { where: clauses.length ? clauses.join(' AND ') : '1 = 1', params };
};

export const buildUserOrderBy = (query: UserQuery): string => {
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC';
  return `ORDER BY u.${query.sort} ${direction}, u.id ${direction}`;
};
