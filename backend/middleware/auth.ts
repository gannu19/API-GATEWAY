// backend/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const SECRET_KEY = process.env.SECRET_KEY || 'super_secret_sde_placement_key';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access denied. No JWT token provided in Authorization header.'
    });
  }

  // First try standard JWT secret verification
  jwt.verify(token, SECRET_KEY, (err: any, decoded: any) => {
    if (!err && decoded) {
      req.user = decoded;
      req.headers['x-user-id'] = decoded.userId || 'USR-101';
      req.headers['x-user-role'] = decoded.role || 'SDE Developer';
      return next();
    }

    // Fallback: Decode Clerk JWT Token payload (unverified claim parsing for dev environment)
    try {
      const clerkDecoded: any = jwt.decode(token);
      if (clerkDecoded) {
        req.user = clerkDecoded;
        req.headers['x-user-id'] = clerkDecoded.sub || 'CLERK-USER';
        req.headers['x-user-role'] = 'Clerk Authenticated User';
        return next();
      }
    } catch (clerkErr) {
      // Ignore
    }

    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or expired JWT token signature.'
    });
  });
}
