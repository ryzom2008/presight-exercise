import type { RequestHandler } from 'express';
import type { UserService } from '../services/users.js';
import { InvalidQuery, parseUserQuery, parseUserFilters } from '../validation/userQuery.js';

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
    const query = parseUserFilters(req.body ?? {});
    res.json(service.getFilterOptions(query));
  };

  const getUserById: RequestHandler = (req, res) => {
    const rawId = req.params.id;
    if (typeof rawId !== 'string' || !/^[1-9]\d*$/.test(rawId)) {
      throw new InvalidQuery('id: Invalid user id');
    }
    const id = Number(rawId);
    if (!Number.isSafeInteger(id)) throw new InvalidQuery('id: Invalid user id');
    res.json(service.findUserById(id));
  };

  return { list, filterOptions, getUserById };
};

export type UserController = ReturnType<typeof createUserController>;
