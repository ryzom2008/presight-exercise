import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export interface HttpRequestLog {
  event: 'http_request';
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
}

export type WriteRequestLog = (entry: HttpRequestLog) => void;

export const writeRequestLog: WriteRequestLog = (entry) => {
  console.info(JSON.stringify(entry));
};

export const createRequestLogger =
  (write: WriteRequestLog = writeRequestLog): RequestHandler =>
  (req, res, next) => {
    const requestId = randomUUID();
    const started = process.hrtime.bigint();
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    res.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      write({
        event: 'http_request',
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      });
    });
    next();
  };
