import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// تعريف صحيح - الـ JWT token يحتوي id و role مباشرة
interface IUserPayload {
  id: number;
  role: string;

}

interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
  }; 
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized: No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as IUserPayload;
    req.user = {
      id: decoded.id,   // ✓ الآن decoded.id موجود
      role: decoded.role, // ✓ الآن decoded.role موجود
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};