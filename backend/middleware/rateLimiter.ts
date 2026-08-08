// backend/middleware/rateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import { RateLimitOptions } from '../config/routes';
import { loadPersistedData, savePersistedData } from '../db/persistence';

export interface RequestLog {
  id: string;
  timestamp: string;
  path: string;
  client: string;
  status: number;
  allowed: boolean;
}

const memoryStore = new Map<string, number[]>();

// Initialize request logs from persistence store
const persisted = loadPersistedData();
const requestLogs: RequestLog[] = persisted.logs || [];

export function createRateLimiter(options: RateLimitOptions) {
  const windowMs = options.windowMs || 60000;
  const max = options.max || 5;

  return function (req: Request & { user?: any }, res: Response, next: NextFunction) {
    const clientId = req.user ? req.user.userId : req.ip || '127.0.0.1';
    const fullPath = req.originalUrl || req.path;
    const key = `ratelimit:${fullPath}:${clientId}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    let timestamps = memoryStore.get(key) || [];
    timestamps = timestamps.filter(ts => ts > windowStart);

    const isAllowed = timestamps.length < max;
    const newLog: RequestLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      path: fullPath,
      client: clientId,
      status: isAllowed ? 200 : 429,
      allowed: isAllowed
    };

    requestLogs.unshift(newLog);
    if (requestLogs.length > 100) requestLogs.pop();

    // Async persistence write
    try {
      savePersistedData({ logs: requestLogs.slice(0, 50) });
    } catch (e) {
      // Ignore background persistence errors
    }

    if (!isAllowed) {
      const resetTime = Math.ceil((timestamps[0] + windowMs - now) / 1000);
      res.setHeader('Retry-After', resetTime);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After');

      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded on ${fullPath}. Limit is ${max} req/min.`,
        retryAfterSeconds: resetTime
      });
    }

    timestamps.push(now);
    memoryStore.set(key, timestamps);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', max - timestamps.length);
    res.setHeader('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After');

    next();
  };
}

export function getRequestLogs(): RequestLog[] {
  return requestLogs;
}
