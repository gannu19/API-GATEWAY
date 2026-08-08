// backend/middleware/circuitBreaker.ts

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF-OPEN';

export interface CircuitBreakerStatus {
  target: string;
  state: CircuitBreakerState;
  failures: number;
}

export class CircuitBreaker {
  name: string;
  failureThreshold: number;
  resetTimeoutMs: number;
  state: CircuitBreakerState;
  failureCount: number;
  lastStateChange: number;

  constructor(name: string, failureThreshold = 3, resetTimeoutMs = 10000) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastStateChange = Date.now();
  }

  canRequest(): boolean {
    const now = Date.now();
    if (this.state === 'OPEN') {
      if (now - this.lastStateChange > this.resetTimeoutMs) {
        this.state = 'HALF-OPEN';
        this.lastStateChange = now;
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'HALF-OPEN') {
      this.state = 'CLOSED';
    }
  }

  recordFailure(): void {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
    }
  }
}

const breakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(targetUrl: string): CircuitBreaker {
  if (!breakers.has(targetUrl)) {
    breakers.set(targetUrl, new CircuitBreaker(targetUrl));
  }
  return breakers.get(targetUrl)!;
}

export function getAllBreakersStatus(): CircuitBreakerStatus[] {
  const result: CircuitBreakerStatus[] = [];
  breakers.forEach((breaker, key) => {
    result.push({
      target: key,
      state: breaker.state,
      failures: breaker.failureCount
    });
  });
  return result;
}
