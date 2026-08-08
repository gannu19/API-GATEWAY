// backend/mock-services/userService.ts
import 'dotenv/config';
import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.USER_SERVICE_PORT ? parseInt(process.env.USER_SERVICE_PORT, 10) : 4001;
const SECRET_KEY = process.env.SECRET_KEY || 'super_secret_sde_placement_key';

app.use(express.json());

app.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (username === 'sde_user' && password === 'pass123') {
    const token = jwt.sign({ userId: 'USR-101', role: 'SDE Developer' }, SECRET_KEY, { expiresIn: '1h' });
    return res.json({ message: 'Login successful!', token, userId: 'USR-101' });
  }
  return res.status(400).json({ error: 'Invalid credentials. Use username: sde_user, password: pass123' });
});

app.get('/api/users/profile', (req: Request, res: Response) => {
  res.json({
    service: 'User Microservice (Port 4001)',
    status: 'SUCCESS',
    profile: {
      userId: req.headers['x-user-id'] || 'USR-101',
      name: 'Ganapathi Bhukya',
      role: req.headers['x-user-role'] || 'SDE Developer',
      location: 'India'
    }
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    service: 'User Microservice',
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`👤 User Service running on http://localhost:${PORT}`);
});
