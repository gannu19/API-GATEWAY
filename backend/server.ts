// backend/server.ts
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import proxy from 'express-http-proxy';
import routes, { updateRouteConfig, getTargets } from './config/routes';
import { authenticateToken } from './middleware/auth';
import { createRateLimiter, getRequestLogs } from './middleware/rateLimiter';
import { getCircuitBreaker, getAllBreakersStatus } from './middleware/circuitBreaker';
import { loadPersistedData, savePersistedData } from './db/persistence';

const app = express();
const PORT = process.env.GATEWAY_PORT ? parseInt(process.env.GATEWAY_PORT, 10) : 3000;

// Load persisted configuration overrides on startup
const persisted = loadPersistedData();
if (persisted.routeConfigs) {
  Object.entries(persisted.routeConfigs).forEach(([path, cfg]) => {
    if (cfg.max !== undefined || cfg.authRequired !== undefined) {
      updateRouteConfig(path, cfg.max || 0, cfg.authRequired);
    }
  });
}

// Track round-robin indices per route
const roundRobinIndices: Record<string, number> = {};
routes.forEach(r => { roundRobinIndices[r.id] = 0; });

async function checkServiceHealth(target: string) {
  try {
    const response = await fetch(`${target}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    const body = await response.json();
    return {
      target,
      status: response.ok ? 'UP' : 'DOWN',
      statusCode: response.status,
      details: body
    };
  } catch (error) {
    return {
      target,
      status: 'DOWN',
      statusCode: 0,
      details: { error: 'Unable to reach downstream service' }
    };
  }
}

// Enable CORS & Custom Telemetry Headers
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Gateway Telemetry & Management Endpoints
app.get('/gateway/metrics', async (req: Request, res: Response) => {
  const allTargets = Array.from(new Set(routes.flatMap(r => getTargets(r))));
  const healthResults = await Promise.all(allTargets.map(target => checkServiceHealth(target)));

  res.json({
    status: 'ONLINE',
    port: PORT,
    routes: routes,
    logs: getRequestLogs(),
    circuitBreakers: getAllBreakersStatus(),
    serviceHealth: healthResults
  });
});

app.post('/gateway/routes/update', express.json(), (req: Request, res: Response) => {
  const { path, max, authRequired } = req.body;
  const success = updateRouteConfig(path, max, authRequired);
  if (success) {
    savePersistedData({
      routeConfigs: {
        [path]: { max, authRequired }
      }
    });
    return res.json({ message: `Successfully updated config for ${path}`, routes });
  }
  return res.status(404).json({ error: 'Route not found' });
});

app.post('/gateway/circuit-breaker/reset', express.json(), (req: Request, res: Response) => {
  const { target } = req.body;
  const breaker = getCircuitBreaker(target);
  breaker.recordSuccess();
  breaker.state = 'CLOSED';
  res.json({ message: `Circuit breaker reset for ${target}`, circuitBreakers: getAllBreakersStatus() });
});

app.get('/gateway/service-health', async (req: Request, res: Response) => {
  const allTargets = Array.from(new Set(routes.flatMap(r => getTargets(r))));
  const healthResults = await Promise.all(allTargets.map(target => checkServiceHealth(target)));
  res.json({ serviceHealth: healthResults });
});

// Configure Gateway Proxy Routes with Round-Robin Load Balancing & Circuit Breaker Isolation
routes.forEach(route => {
  const middlewares: any[] = [];

  middlewares.push((req: Request, res: Response, next: NextFunction) => {
    return createRateLimiter(route.rateLimit)(req as any, res, next);
  });

  middlewares.push((req: Request, res: Response, next: NextFunction) => {
    if (route.authRequired) {
      return authenticateToken(req as any, res, next);
    }
    next();
  });

  app.use(route.path, middlewares, (req: Request, res: Response, next: NextFunction) => {
    const targets = getTargets(route);
    const currentIndex = (roundRobinIndices[route.id] || 0) % targets.length;
    const targetUrl = targets[currentIndex];
    roundRobinIndices[route.id] = currentIndex + 1;

    const breaker = getCircuitBreaker(targetUrl);

    if (!breaker.canRequest()) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: `Circuit Breaker is OPEN for ${route.path}. Target ${targetUrl} isolated.`
      });
    }

    res.setHeader('X-Served-By', targetUrl);
    res.setHeader('X-Load-Balancer', `Round-Robin (Instance ${currentIndex + 1} of ${targets.length})`);
    res.setHeader('Access-Control-Expose-Headers', 'X-Served-By, X-Load-Balancer, X-RateLimit-Limit, X-RateLimit-Remaining');

    proxy(targetUrl, {
      parseReqBody: false,
      proxyReqPathResolver: (req: Request) => req.originalUrl,
      userResDecorator: (proxyRes: any, proxyResData: any) => {
        if (proxyRes.statusCode >= 500) breaker.recordFailure();
        else breaker.recordSuccess();
        return proxyResData;
      },
      proxyErrorHandler: (err: any, res: Response) => {
        breaker.recordFailure();
        res.status(502).json({
          error: 'Bad Gateway',
          message: `Connection failed to downstream microservice target at ${targetUrl}.`
        });
      }
    })(req, res, next);
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API Gateway Server running on http://localhost:${PORT}`);
});
