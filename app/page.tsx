'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement,
  ArcElement,
  Title, 
  Tooltip, 
  Legend, 
  Filler 
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { 
  ShieldCheck, 
  Activity, 
  Layers, 
  Zap, 
  Server, 
  Lock, 
  RefreshCw, 
  Play, 
  Key, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Terminal,
  Sun,
  Moon,
  Download,
  Sliders,
  RotateCcw,
  UserCheck,
  BarChart3,
  PieChart,
  Cpu,
  ArrowRight
} from 'lucide-react';

// Register Chart.js Modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export interface RouteConfig {
  id: string;
  name: string;
  path: string;
  target: string;
  targets?: string[];
  authRequired: boolean;
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

export interface RequestLog {
  id: string;
  timestamp: string;
  path: string;
  client: string;
  status: number;
  allowed: boolean;
  servedBy?: string;
}

export interface CircuitBreakerStatus {
  target: string;
  state: 'CLOSED' | 'OPEN' | 'HALF-OPEN';
  failures: number;
}

export interface ServiceHealth {
  target: string;
  status: 'UP' | 'DOWN';
  statusCode: number;
  details: any;
}

export interface LoadBalancerStats {
  userRouteTargets: string[];
  nextTargetIndex: number;
  nextTarget: string;
  instanceStats: Record<string, number>;
}

export interface GatewayMetrics {
  status: string;
  port: number;
  routes: RouteConfig[];
  logs: RequestLog[];
  circuitBreakers: CircuitBreakerStatus[];
  serviceHealth: ServiceHealth[];
  loadBalancerStats?: LoadBalancerStats;
}

export interface ApiResponseState {
  status?: number;
  statusText?: string;
  latencyMs?: number;
  rateLimitRemaining?: string | null;
  rateLimitLimit?: string | null;
  retryAfter?: string | null;
  data?: any;
  error?: string;
  message?: string;
}

export default function Dashboard() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [metrics, setMetrics] = useState<GatewayMetrics | null>(null);
  const [isGatewayOnline, setIsGatewayOnline] = useState<boolean>(false);
  const [token, setToken] = useState<string>('');
  const [tokenSource, setTokenSource] = useState<'Clerk Auth' | 'Mock JWT' | 'None'>('None');
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('/api/users/profile');
  const [apiResponse, setApiResponse] = useState<ApiResponseState | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [simulatingLB, setSimulatingLB] = useState<boolean>(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [newRateLimitMax, setNewRateLimitMax] = useState<number>(10);

  const { getToken, isSignedIn } = useAuth();

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (typeof document !== 'undefined') {
      document.body.className = `${newTheme} font-sans antialiased transition-colors duration-300`;
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await fetch('http://localhost:3000/gateway/metrics');
      if (res.ok) {
        const data: GatewayMetrics = await res.json();
        setMetrics(data);
        setIsGatewayOnline(true);
      } else {
        setIsGatewayOnline(false);
      }
    } catch (err) {
      setIsGatewayOnline(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchClerkToken() {
      if (isSignedIn && getToken) {
        try {
          const clerkJwt = await getToken();
          if (clerkJwt) {
            setToken(clerkJwt);
            setTokenSource('Clerk Auth');
          }
        } catch (e) {
          // Ignore
        }
      }
    }
    fetchClerkToken();
  }, [isSignedIn, getToken]);

  const handleQuickLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'sde_user', password: 'pass123' })
      });
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        setTokenSource('Mock JWT');
        setApiResponse({
          status: res.status,
          statusText: '200 OK',
          data: data
        });
      } else {
        setApiResponse({ status: res.status, data });
      }
    } catch (err) {
      setApiResponse({ error: 'Failed to connect to Gateway server. Is server.ts running?' });
    }
    setLoading(false);
    fetchMetrics();
  };

  const handleExecuteRequest = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      headers['Content-Type'] = 'application/json';

      const isLoginEndpoint = selectedEndpoint === '/auth/login';
      const requestOptions: RequestInit = {
        method: isLoginEndpoint ? 'POST' : 'GET',
        headers
      };

      if (isLoginEndpoint) {
        requestOptions.body = JSON.stringify({ username: 'sde_user', password: 'pass123' });
      }

      const startTime = performance.now();
      const res = await fetch(`http://localhost:3000${selectedEndpoint}`, requestOptions);
      const endTime = performance.now();

      const rateLimitRemaining = res.headers.get('X-RateLimit-Remaining');
      const rateLimitLimit = res.headers.get('X-RateLimit-Limit');
      const retryAfter = res.headers.get('Retry-After');

      const contentType = res.headers.get('Content-Type') || '';
      const data = contentType.includes('application/json') ? await res.json() : await res.text();

      setApiResponse({
        status: res.status,
        statusText: res.status === 200 ? '200 OK' : res.status === 429 ? '429 Rate Limited' : `${res.status}`,
        latencyMs: Math.round(endTime - startTime),
        rateLimitRemaining,
        rateLimitLimit,
        retryAfter,
        data
      });
    } catch (err) {
      setApiResponse({
        error: 'Network Error: Gateway unreachable or connection refused.',
        message: 'Ensure the API Gateway (server.ts) and mock microservices are running.'
      });
    }
    setLoading(false);
    fetchMetrics();
  };

  const handleSimulate4Requests = async () => {
    setSimulatingLB(true);
    try {
      let currentAuthToken = token;
      if (!currentAuthToken) {
        const loginRes = await fetch('http://localhost:3000/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'sde_user', password: 'pass123' })
        });
        const loginData = await loginRes.json();
        if (loginData.token) {
          currentAuthToken = loginData.token;
          setToken(loginData.token);
          setTokenSource('Mock JWT');
        }
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (currentAuthToken) headers['Authorization'] = `Bearer ${currentAuthToken}`;

      for (let i = 0; i < 4; i++) {
        const res = await fetch('http://localhost:3000/api/users/profile', { method: 'GET', headers });
        const data = await res.json();
        setApiResponse({
          status: res.status,
          statusText: res.status === 200 ? '200 OK' : `${res.status}`,
          data
        });
        await fetchMetrics();
        await new Promise(r => setTimeout(r, 450));
      }
    } catch (e) {
      // Ignore
    }
    setSimulatingLB(false);
    fetchMetrics();
  };

  const handleUpdateRouteLimit = async (path: string, max: number) => {
    try {
      const res = await fetch('http://localhost:3000/gateway/routes/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, max })
      });
      if (res.ok) {
        setEditingRouteId(null);
        fetchMetrics();
      }
    } catch (e) {
      // Ignore
    }
  };

  const handleResetCircuit = async (target: string) => {
    try {
      await fetch('http://localhost:3000/gateway/circuit-breaker/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
      });
      fetchMetrics();
    } catch (e) {
      // Ignore
    }
  };

  const getBreakerState = (target: string) => {
    return metrics?.circuitBreakers?.find(b => b.target === target)?.state || 'CLOSED';
  };

  const getServiceStatus = (target: string) => {
    return metrics?.serviceHealth?.find(s => s.target === target)?.status || 'DOWN';
  };

  const handleExportLogs = () => {
    if (!metrics || !metrics.logs) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(metrics.logs, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `gateway-security-logs-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const isDark = theme === 'dark';

  // --- Chart.js Data Preparation ---
  const logs = metrics ? metrics.logs : [];
  const allowedLogs = logs.filter(l => l.status === 200).length;
  const blockedLogs = logs.filter(l => l.status === 429).length;

  const usersCount = logs.filter(l => l.path.includes('/users')).length;
  const ordersCount = logs.filter(l => l.path.includes('/orders')).length;
  const authCount = logs.filter(l => l.path.includes('/auth')).length;

  const circuitBreakerOpenCount = metrics?.circuitBreakers?.filter(b => b.state !== 'CLOSED').length || 0;
  const serviceUpCount = metrics?.serviceHealth?.filter(s => s.status === 'UP').length || 0;
  const serviceTotalCount = metrics?.serviceHealth?.length || 0;

  const lbStats = metrics?.loadBalancerStats;
  const targetInstances = [
    { name: 'Instance 1', url: 'http://localhost:4001', port: 4001, color: 'from-blue-500 to-indigo-600' },
    { name: 'Instance 2', url: 'http://localhost:4003', port: 4003, color: 'from-cyan-500 to-blue-600' },
    { name: 'Instance 3', url: 'http://localhost:4004', port: 4004, color: 'from-purple-500 to-indigo-600' },
    { name: 'Instance 4', url: 'http://localhost:4005', port: 4005, color: 'from-emerald-500 to-teal-600' }
  ];

  // Chart 1: Traffic Line Chart Data
  const lineChartData = {
    labels: logs.slice(0, 10).reverse().map(l => l.timestamp || 'Now'),
    datasets: [
      {
        label: 'HTTP 200 OK (Allowed)',
        data: logs.slice(0, 10).reverse().map(l => (l.status === 200 ? 1 : 0)),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'HTTP 429 Rate Limited',
        data: logs.slice(0, 10).reverse().map(l => (l.status === 429 ? 1 : 0)),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        tension: 0.4,
        fill: true,
      }
    ]
  };

  // Chart 2: Endpoint Traffic Doughnut Chart Data
  const doughnutChartData = {
    labels: ['/api/users/profile', '/api/orders/my-orders', '/auth/login'],
    datasets: [
      {
        label: 'Requests',
        data: [usersCount || 1, ordersCount || 1, authCount || 1],
        backgroundColor: ['#3b82f6', '#10b981', '#a855f7'],
        borderColor: isDark ? '#0f172a' : '#ffffff',
        borderWidth: 2,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: isDark ? '#94a3b8' : '#475569',
          font: { size: 11 }
        }
      }
    },
    scales: {
      x: {
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
        ticks: { color: isDark ? '#94a3b8' : '#475569', font: { size: 10 } }
      },
      y: {
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
        ticks: { color: isDark ? '#94a3b8' : '#475569', font: { size: 10 } }
      }
    }
  };

  return (
    <div className={`min-h-screen p-4 md:p-8 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Top Header */}
      <header className={`max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-6 ${
        isDark ? 'border-slate-800' : 'border-slate-200'
      }`}>
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-500 rounded-xl border border-blue-500/30">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent">
                API Gateway Control Center
              </h1>
              <p className={`text-xs md:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                4-Instance Load Balancer • Clerk Auth • Dynamic Rate Limiter • Circuit Breaker
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <SignedIn>
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Clerk Signed In</span>
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition shadow">
                Sign In with Clerk
              </button>
            </SignInButton>
          </SignedOut>

          <button
            onClick={toggleTheme}
            className={`p-2 rounded-xl border transition flex items-center gap-1.5 text-xs font-medium ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700' 
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
            }`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{isDark ? 'Light' : 'Dark'}</span>
          </button>

          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border ${
            isGatewayOnline 
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' 
              : 'bg-rose-500/10 text-rose-500 border-rose-500/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isGatewayOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            {isGatewayOnline ? 'Gateway Online (Port 3000)' : 'Gateway Offline'}
          </div>

          <button 
            onClick={fetchMetrics}
            className={`p-2 rounded-lg transition border ${
              isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-300 shadow-sm'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-8">
        
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-5 rounded-2xl">
            <div className="flex justify-between items-start mb-3">
              <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Traffic Logs</span>
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold">{metrics ? metrics.logs.length : 0}</div>
            <span className="text-xs text-slate-500 mt-1 block">Active session request history</span>
          </div>

          <div className="glass-panel p-5 rounded-2xl">
            <div className="flex justify-between items-start mb-3">
              <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Service Health</span>
              <Server className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-500">{serviceUpCount} / {serviceTotalCount} UP</div>
            <span className="text-xs text-slate-500 mt-1 block">Active downstream replicas</span>
          </div>

          <div className="glass-panel p-5 rounded-2xl">
            <div className="flex justify-between items-start mb-3">
              <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Rate Limited Blocks</span>
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-500">{blockedLogs}</div>
            <span className="text-xs text-slate-500 mt-1 block">HTTP 429 Security blocks</span>
          </div>

          <div className="glass-panel p-5 rounded-2xl">
            <div className="flex justify-between items-start mb-3">
              <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Circuit Breakers</span>
              <Zap className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-purple-500">{circuitBreakerOpenCount === 0 ? 'All Closed' : `${circuitBreakerOpenCount} Open`}</div>
            <span className="text-xs text-slate-500 mt-1 block">Failure isolation state</span>
          </div>
        </div>

        {/* 🌟 LIVE 4-INSTANCE LOAD BALANCER INSPECTOR PANEL 🌟 */}
        <div className={`p-6 rounded-2xl border transition ${
          isDark 
            ? 'bg-gradient-to-br from-slate-900/90 via-slate-900/50 to-blue-950/40 border-blue-500/30 shadow-2xl' 
            : 'bg-gradient-to-br from-white via-blue-50/40 to-slate-50 border-blue-200 shadow-xl'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 mb-6 border-blue-500/20">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/40">
                  <Cpu className="w-5 h-5 animate-pulse" />
                </div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
                  Live 4-Instance Load Balancer Inspector (Round-Robin)
                </h2>
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Requests dynamically rotate across 4 User Service replicas (<code className="text-blue-400">Instance 1 ➔ 2 ➔ 3 ➔ 4 ➔ 1</code>)
              </p>
            </div>

            <button
              onClick={handleSimulate4Requests}
              disabled={simulatingLB}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs transition shadow-lg ${
                simulatingLB
                  ? 'bg-blue-600/50 cursor-not-allowed text-white'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/30'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${simulatingLB ? 'animate-spin' : ''}`} />
              <span>{simulatingLB ? 'Routing Requests Live...' : '🔥 Fire 4 Sequential Requests (Test Round-Robin)'}</span>
            </button>
          </div>

          {/* 4 Instance Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {targetInstances.map((inst, index) => {
              const status = getServiceStatus(inst.url);
              const requestCount = lbStats?.instanceStats ? (lbStats.instanceStats[inst.url] || 0) : 0;
              const isNextInQueue = lbStats ? lbStats.nextTargetIndex === index : index === 0;

              return (
                <div
                  key={inst.port}
                  className={`p-4 rounded-xl border relative transition-all duration-300 ${
                    isNextInQueue
                      ? 'border-blue-500 ring-2 ring-blue-500/40 bg-blue-950/30 shadow-lg scale-[1.02]'
                      : isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                  }`}
                >
                  {isNextInQueue && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-2.5 py-0.5 bg-blue-600 text-white font-mono text-[9px] font-bold rounded-full shadow border border-blue-400 animate-bounce flex items-center gap-1">
                      <span>NEXT IN QUEUE</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-3 mt-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${status === 'UP' ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
                      <span className="font-bold text-sm">{inst.name}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      :{inst.port}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="opacity-70">Status:</span>
                      <span className={`font-semibold ${status === 'UP' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {status === 'UP' ? 'UP (Healthy)' : 'DOWN'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="opacity-70">Requests Served:</span>
                      <span className="font-mono font-bold text-amber-400 text-sm">{requestCount}</span>
                    </div>

                    {/* Visual Load Bar */}
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-3 border border-slate-700/50">
                      <div
                        className={`h-full bg-gradient-to-r ${inst.color} transition-all duration-500`}
                        style={{ width: `${Math.min(100, Math.max(10, (requestCount / (logs.length || 1)) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Charts & Graphs Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between border-b pb-4 mb-4 border-slate-800">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-500" />
                <h2 className="text-lg font-semibold">Real-Time Traffic Stream (Chart.js)</h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">Live HTTP Status</span>
            </div>
            <div className="h-64 w-full">
              <Line data={lineChartData} options={chartOptions as any} />
            </div>
          </div>

          <div className="lg:col-span-4 glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between border-b pb-4 mb-4 border-slate-800">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold">Endpoint Share</h2>
              </div>
            </div>
            <div className="h-64 w-full flex items-center justify-center">
              <Doughnut data={doughnutChartData} options={chartOptions as any} />
            </div>
          </div>
        </div>

        {/* API Testing Playground & Live Security Log Stream */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Postman-style API Tester */}
          <div className="lg:col-span-7 glass-panel p-6 rounded-2xl space-y-6">
            <div className={`flex items-center justify-between border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold">Interactive API Testing Console</h2>
              </div>
              
              <button
                onClick={handleQuickLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition shadow"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Get JWT Token</span>
              </button>
            </div>

            {/* Token Status Header */}
            <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-mono ${
              token ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              <div className="flex items-center gap-2 truncate">
                <Lock className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {token ? `Active Bearer Token (${tokenSource}): ${token.substring(0, 24)}...` : 'No Auth Token set. Restricted endpoints will return HTTP 401.'}
                </span>
              </div>
            </div>

            {/* Endpoint Selector & Send Button */}
            <div className="space-y-4">
              <div>
                <label className={`text-xs font-medium block mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Target Endpoint</label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedEndpoint}
                    onChange={(e) => setSelectedEndpoint(e.target.value)}
                    className={`flex-1 p-2.5 rounded-xl text-xs font-mono border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="/api/users/profile">GET /api/users/profile (4 Replicas, Limit: 20 req/min)</option>
                    <option value="/api/orders/my-orders">GET /api/orders/my-orders (Port 4002, Limit: 5 req/min)</option>
                    <option value="/auth/login">POST /auth/login (Auth Issuer)</option>
                  </select>

                  <button
                    onClick={handleExecuteRequest}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition shadow disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{loading ? 'Sending...' : 'Send Request'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Response Viewer */}
            {apiResponse && (
              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Gateway Response Output:</span>
                  <div className="flex items-center gap-2 font-semibold">
                    <span className={`px-2 py-0.5 rounded ${apiResponse.status === 200 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {apiResponse.statusText || apiResponse.status}
                    </span>
                    {apiResponse.latencyMs !== undefined && (
                      <span className="text-slate-400">{apiResponse.latencyMs}ms</span>
                    )}
                  </div>
                </div>

                <div className={`p-4 rounded-xl border overflow-x-auto max-h-60 ${
                  apiResponse.status === 200
                    ? isDark ? 'bg-slate-900 border-emerald-500/30 text-emerald-300' : 'bg-slate-900 text-emerald-300'
                    : isDark ? 'bg-slate-900 border-rose-500/30 text-rose-300' : 'bg-slate-900 text-rose-300'
                }`}>
                  <div className="flex items-center justify-between text-[11px] border-b border-slate-800 pb-2 mb-2">
                    <span>Remaining Quota: {apiResponse.rateLimitRemaining ?? 'N/A'} / {apiResponse.rateLimitLimit ?? 'N/A'}</span>
                    {apiResponse.retryAfter && <span className="text-amber-500">Retry After: {apiResponse.retryAfter}s</span>}
                  </div>
                  <pre>{JSON.stringify(apiResponse.data || apiResponse.error || apiResponse, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Live Security Stream & Export */}
          <div className="lg:col-span-5 glass-panel p-6 rounded-2xl flex flex-col">
            <div className={`flex items-center justify-between border-b pb-4 mb-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-purple-500" />
                <h2 className="text-lg font-semibold">Live Traffic Logs & Replicas</h2>
              </div>
              
              <button
                onClick={handleExportLogs}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {metrics?.serviceHealth?.map((service) => (
                <div key={service.target} className={`rounded-xl p-2.5 border ${isDark ? 'border-slate-800' : 'border-slate-200'} ${service.status === 'UP' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                  <div className="flex items-center justify-between gap-1 text-[11px] font-semibold">
                    <span className="truncate">{service.target}</span>
                    <span className={`px-1.5 py-0.2 rounded ${service.status === 'UP' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {service.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto max-h-[320px] space-y-2 pr-1 font-mono text-xs">
              {metrics && metrics.logs.length > 0 ? (
                metrics.logs.map((log: RequestLog) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                      log.status === 200
                        ? isDark ? 'bg-slate-900/60 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
                        : isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {log.status === 200 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      <div className="truncate">
                        <span className="font-semibold">{log.path}</span>
                        <span className="text-[10px] opacity-70 block">
                          Client: {log.client} {log.servedBy ? `• ${log.servedBy}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.status === 200 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'
                      }`}>
                        {log.status}
                      </span>
                      <span className="text-[10px] opacity-60 block mt-0.5">{log.timestamp}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No requests recorded yet. Use the playground or load balancer test button!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Route Configurator Table */}
        <div className="glass-panel p-6 rounded-2xl">
          <div className={`flex items-center justify-between border-b pb-4 mb-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div>
              <h2 className="text-lg font-semibold">Dynamic Route & Rate Limit Configurator</h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Adjust rate limits and view circuit breaker states in real time</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className={`border-b ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                  <th className="pb-3 font-medium">Route Path</th>
                  <th className="pb-3 font-medium">Target Replicas</th>
                  <th className="pb-3 font-medium">Authentication</th>
                  <th className="pb-3 font-medium">Max Quota Limit</th>
                  <th className="pb-3 font-medium">Circuit Breaker</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800/60 text-slate-300' : 'divide-slate-200 text-slate-700'}`}>
                {metrics && metrics.routes ? (
                  metrics.routes.map((r: RouteConfig) => (
                    <tr key={r.id} className={isDark ? 'hover:bg-slate-900/40' : 'hover:bg-slate-100/60'}>
                      <td className="py-3 font-bold text-blue-500">{r.path}</td>
                      <td className="py-3 opacity-80">
                        {r.targets && r.targets.length > 1 ? (
                          <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded text-[10px]">
                            {r.targets.length} Target Replicas
                          </span>
                        ) : (
                          r.target
                        )}
                      </td>
                      <td className="py-3">
                        {r.authRequired ? (
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/30 rounded text-[10px]">
                            JWT Required
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
                            Public
                          </span>
                        )}
                      </td>

                      <td className="py-3 text-amber-500">
                        {editingRouteId === r.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={newRateLimitMax}
                              onChange={(e) => setNewRateLimitMax(parseInt(e.target.value) || 1)}
                              className={`w-16 px-2 py-1 rounded text-xs font-mono border focus:outline-none ${
                                isDark ? 'bg-slate-900 border-blue-500 text-white' : 'bg-white border-blue-500 text-slate-900'
                              }`}
                            />
                            <button
                              onClick={() => handleUpdateRouteLimit(r.path, newRateLimitMax)}
                              className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px]"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <span className="flex items-center gap-2">
                            {r.rateLimit.max} req / {r.rateLimit.windowMs / 1000}s
                            <button
                              onClick={() => {
                                setEditingRouteId(r.id);
                                setNewRateLimitMax(r.rateLimit.max);
                              }}
                              className="p-1 hover:bg-slate-800 text-slate-400 rounded"
                            >
                              <Sliders className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                      </td>

                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${getBreakerState(r.target) === 'CLOSED' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                          {getBreakerState(r.target)}
                        </span>
                      </td>

                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleResetCircuit(r.target)}
                          className={`px-2.5 py-1 rounded text-[10px] font-medium border transition ${
                            isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          <RotateCcw className="w-3 h-3 inline mr-1" />
                          Reset Circuit
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-500">
                      Loading routes configuration...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
