// backend/config/routes.ts

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export interface RouteConfig {
  id: string;
  name: string;
  path: string;
  target: string;
  targets?: string[];
  authRequired: boolean;
  rateLimit: RateLimitOptions;
}

const routes: RouteConfig[] = [
  {
    id: 'route-users',
    name: 'User Microservice Profile (4 Replicas)',
    path: '/api/users/profile',
    target: 'http://localhost:4001',
    targets: [
      'http://localhost:4001',
      'http://localhost:4003',
      'http://localhost:4004',
      'http://localhost:4005'
    ],
    authRequired: true,
    rateLimit: { windowMs: 60000, max: 20 }
  },
  {
    id: 'route-orders',
    name: 'Order Microservice List',
    path: '/api/orders/my-orders',
    target: 'http://localhost:4002',
    targets: ['http://localhost:4002'],
    authRequired: true,
    rateLimit: { windowMs: 60000, max: 5 }
  },
  {
    id: 'route-auth',
    name: 'Authentication Token Endpoint',
    path: '/auth/login',
    target: 'http://localhost:4001',
    targets: [
      'http://localhost:4001',
      'http://localhost:4003',
      'http://localhost:4004',
      'http://localhost:4005'
    ],
    authRequired: false,
    rateLimit: { windowMs: 60000, max: 20 }
  }
];

export function getTargets(route: RouteConfig): string[] {
  if (route.targets && route.targets.length > 0) return route.targets;
  return [route.target];
}

export function updateRouteConfig(id: string, newMax: number, authRequired?: boolean): boolean {
  const route = routes.find(r => r.id === id || r.path === id);
  if (route) {
    if (newMax > 0) route.rateLimit.max = newMax;
    if (authRequired !== undefined) route.authRequired = authRequired;
    return true;
  }
  return false;
}

export default routes;
