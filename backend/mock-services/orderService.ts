// backend/mock-services/orderService.ts
import 'dotenv/config';
import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.ORDER_SERVICE_PORT ? parseInt(process.env.ORDER_SERVICE_PORT, 10) : 4002;

app.use(express.json());

app.get('/api/orders/my-orders', (req: Request, res: Response) => {
  res.json({
    service: 'Order Microservice (Port 4002)',
    status: 'SUCCESS',
    orders: [
      { id: 'ORD-901', item: 'MacBook Pro M3 Max', price: '$2,499', status: 'Delivered' },
      { id: 'ORD-902', item: 'UltraWide Curved Monitor', price: '$799', status: 'In Transit' }
    ]
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    service: 'Order Microservice',
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`📦 Order Service running on http://localhost:${PORT}`);
});
