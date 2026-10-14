import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { getJwtSecret } from '../utils/jwt';

const prisma = new PrismaClient();

export type UserRole = 'USER' | 'ADMIN';

export interface AuthRequest extends Request {
  user?: { id: string; role: UserRole };
}

function readToken(req: Request, res: Response): JwtPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });
    return null;
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), getJwtSecret());
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.' });
      return null;
    }
    return payload;
  } catch {
    res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    return null;
  }
}

async function authenticate(req: AuthRequest, res: Response): Promise<boolean> {
  const payload = readToken(req, res);
  if (!payload) return false;

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, status: true }
    });

    if (!user || user.status !== 'ACTIVE') {
      res.status(401).json({ error: 'Tài khoản không tồn tại, đã bị khóa hoặc đã ngừng hoạt động.' });
      return false;
    }

    req.user = { id: user.id, role: user.role };
    return true;
  } catch (error) {
    console.error('Authentication lookup failed:', error);
    res.status(500).json({ error: 'Không thể xác minh tài khoản lúc này.' });
    return false;
  }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (await authenticate(req, res)) next();
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!(await authenticate(req, res))) return;
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Bạn cần tài khoản Admin để truy cập chức năng này.' });
  }
  next();
}

export async function requireUser(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });
  }
  if (req.user?.role !== 'USER') {
    return res.status(403).json({ error: 'Chức năng thú cưng chỉ dành cho tài khoản User.' });
  }
  next();
}
