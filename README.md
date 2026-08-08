# 🛡️ Distributed API Gateway & Next.js Admin Dashboard

A full-stack API Gateway system built with **Node.js, Express, Next.js 14, and Tailwind CSS**.

## ✨ Features
- **Frontend Dashboard (Next.js 14 + Tailwind CSS):** Real-time monitoring dashboard, interactive Postman-style API playground, rate-limit visualizer, and security event log stream.
- **Backend API Gateway (Express):** Dynamic reverse proxy, JWT authentication verification, sliding-window rate limiter, and circuit breaker.
- **Mock Microservices:** Independent User Microservice (Port 4001) and Order Microservice (Port 4002).

---

## 🚀 How to Run the Project

### 1. Install Dependencies
Open your terminal inside `C:\Users\bhuky\OneDrive\Desktop\API-GateWay` and run:
```bash
npm install
```

### 2. Start the Backend Microservices & Gateway
Run each command in a separate terminal tab:

* **Terminal 1 (User Microservice):**
  ```bash
  npm run user-service
  ```
* **Terminal 2 (Order Microservice):**
  ```bash
  npm run order-service
  ```
* **Terminal 3 (API Gateway Server):**
  ```bash
  npm run gateway
  ```

### 3. Start the Next.js + Tailwind CSS Frontend Dashboard
* **Terminal 4 (Next.js Dashboard):**
  ```bash
  npm run dev
  ```
Open **[http://localhost:3005](http://localhost:3005)** in your browser!

---

## 🧪 Interactive Playground Guide
1. Click **"Get JWT Token"** on the dashboard.
2. Select **GET /api/orders/my-orders (Limit: 5 req/min)**.
3. Click **"Send Request"** rapidly 6 times.
4. Watch requests 1-5 return `200 OK` and request 6 get blocked with **`429 Rate Limited`** live in the UI!

---

## Environment

- **File:** [.env.example](.env.example) — copy to `.env` to override defaults.
- **Secrets:** Set `SECRET_KEY` in your `.env` for JWT signing.
- **Ports:** Optionally override `GATEWAY_PORT`, `USER_SERVICE_PORT`, and `ORDER_SERVICE_PORT`.

After creating a `.env` file, restart services so `dotenv` loads values.
