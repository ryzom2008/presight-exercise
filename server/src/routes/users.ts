import { Router } from 'express';
import type { UserController } from '../controllers/users.js';

export const createUserRouter = (controller: UserController) => {
  const router = Router();
  router.post('/search', controller.list);
  router.post('/filter-options', controller.filterOptions);
  return router;
};
