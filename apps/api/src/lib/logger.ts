import { randomUUID } from 'node:crypto';
import pino, { type Logger } from 'pino';
import { pinoHttp } from 'pino-http';

export function createLogger(level = 'info', pretty = false): Logger {
  return pino({
    level,
    redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
    ...(pretty ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
  });
}

/** Logs JSON corrélés par requestId (en-tête x-request-id repris s'il est fourni). */
export function httpLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id = typeof incoming === 'string' && incoming.length <= 100 ? incoming : randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    customLogLevel: (_req, res, err) =>
      err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
  });
}
