import express from 'express';
import type Database from 'better-sqlite3';
import { InvalidQuery } from './validation/userQuery.js';
import { createUserRepository } from './repositories/users.js';
import { createUserService, UserNotFound } from './services/users.js';
import { createUserController } from './controllers/users.js';
import { createUserRouter } from './routes/users.js';
import { createRequestLogger, type WriteRequestLog } from './middleware/requestLogger.js';

export const createApp = (
  db: Database.Database,
  clientDirectory?: string,
  writeRequestLog?: WriteRequestLog,
) => {
  const app = express();
  app.disable('x-powered-by');
  app.use(createRequestLogger(writeRequestLog));
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const repository = createUserRepository(db);
  const service = createUserService(repository);
  const controller = createUserController(service);
  app.use('/api/users', createUserRouter(controller));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { message: 'API route not found' } });
  });

  if (clientDirectory) {
    app.use(express.static(clientDirectory));
  }

  const errorHandler: express.ErrorRequestHandler = (error: unknown, req, res, _next) => {
    if (error instanceof UserNotFound) {
      res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: error.message } });
      return;
    }
    if (error instanceof InvalidQuery) {
      res.status(400).json({ error: { code: 'INVALID_QUERY', message: error.message } });
      return;
    }
    if (error && typeof error === 'object' && 'type' in error) {
      if (error.type === 'entity.parse.failed') {
        res
          .status(400)
          .json({ error: { code: 'INVALID_JSON', message: 'Body must contain valid JSON' } });
        return;
      }
      if (error.type === 'entity.too.large') {
        res
          .status(413)
          .json({ error: { code: 'BODY_TOO_LARGE', message: 'Request body exceeds 16kb' } });
        return;
      }
    }
    console.error(
      JSON.stringify({
        event: 'request_error',
        requestId: res.locals.requestId,
        method: req.method,
        path: req.path,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to load users' } });
  };
  app.use(errorHandler);
  return app;
};
