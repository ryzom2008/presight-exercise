import type { RequestHandler } from 'express';
import type { UserService } from '../services/users.js';
import { parseUserQuery, parseUserFilters } from '../validation/userQuery.js';

export const createUserController = (service: UserService) => {
  const list: RequestHandler = (req, res) => {
    if (req.get('Content-Type') && !req.is('application/json')) {
      res
        .status(415)
        .json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Use application/json' } });
      return;
    }
    const query = parseUserQuery(req.body ?? {});
    res.json(service.findUsers(query));
  };

  const filterOptions: RequestHandler = (req, res) => {
    if (req.get('Content-Type') && !req.is('application/json')) {
      res
        .status(415)
        .json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Use application/json' } });
      return;
    }
    res.json(service.getFilterOptions(parseUserFilters(req.body ?? {})));
  };
  return { list, filterOptions };
};

export type UserController = ReturnType<typeof createUserController>;
