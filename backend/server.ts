// backend/server.ts
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import proxy from 'express-http-proxy';
import routes, { updateRouteConfig } from './config/routes';
import { authenticateToken } from './middleware/auth';
import { createRateLimiter, getRequestLogs } from './middleware/rateLimiter';
import { getCircuitBreaker, getAllBreakersStatus } from './middleware/circuitBreaker';

const app = express();
const PORT = process.env.GATEWAY_PORT ? parseInt(process.env.GATEWAY_PORT, 10) : 3000;

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

// Enable CORS
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Gateway Telemetry Endpoints (Uses express.json for dashboard payload parsing)
app.get('/gateway/metrics', async (req: Request, res: Response) => {
  const routeHealth = await Promise.all(routes.map(route => checkServiceHealth(route.target)));
  res.json({
    status: 'ONLINE',
    port: PORT,
    routes: routes,
    logs: getRequestLogs(),
    circuitBreakers: getAllBreakersStatus(),
    serviceHealth: routeHealth
  });
});

app.post('/gateway/routes/update', express.json(), (req: Request, res: Response) => {
  const { path, max, authRequired } = req.body;
  const success = updateRouteConfig(path, max, authRequired);
  if (success) {
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
  const routeHealth = await Promise.all(routes.map(route => checkServiceHealth(route.target)));
  res.json({ serviceHealth: routeHealth });
});

// Configure Gateway Proxy Routes (Unconsumed raw stream for fast & error-free proxying)
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

  const breaker = getCircuitBreaker(route.target);

  app.use(route.path, middlewares, (req: Request, res: Response, next: NextFunction) => {
    if (!breaker.canRequest()) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: `Circuit Breaker is OPEN for ${route.path}. Downstream target ${route.target} isolated.`
      });
    }

    proxy(route.target, {
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
          message: `Connection failed to downstream microservice at ${route.target}.`
        });
      }
    })(req, res, next);
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API Gateway Server running on http://localhost:${PORT}`);
});
