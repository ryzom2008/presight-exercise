import express from 'express';
import type Database from 'better-sqlite3';
import { InvalidQuery, parseUserQuery } from './users/query.js';
import { findUsers } from './users/repository.js';

export const createApp = (db: Database.Database) => {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/users', (req, res) => {
    const params = new URL(req.originalUrl, 'http://localhost').searchParams;
    const query = parseUserQuery(params);
    res.json(findUsers(db, query));
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { message: 'API route not found' } });
  });

  const errorHandler: express.ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof InvalidQuery) {
      res.status(400).json({ error: { code: 'INVALID_QUERY', message: error.message } });
      return;
    }
    console.error('API request failed:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to load users' } });
  };
  app.use(errorHandler);
  return app;
};
