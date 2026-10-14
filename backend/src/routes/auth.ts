import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { randomInt } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getJwtSecret } from '../utils/jwt';
import { verifyTotp } from '../utils/totp';

const router = Router();
const prisma = new PrismaClient();

const smtpPort = Number(process.env.SMTP_PORT) || 465;
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: smtpPort,
  secure: smtpPort === 465,
  auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD.replace(/\s+/g, '')
      }
    : undefined,
});

function signToken(userId: string, role: string) {
  const payload = { sub: userId, role };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

// In-memory OTP storage with 10-minute expiration
const otpStore: Record<string, { otpHash: string; expiresAt: number }> = {};

/**
 * Register User (US-U01)
 * Creates a user account; department membership is optional and managed after sign-up.
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const { password, fullName, petName, petTypeId } = req.body;

    if (!email || !password || typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({ error: 'Vui lòng cung cấp email, mật khẩu và họ tên.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email không đúng định dạng.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Mật khẩu cần có ít nhất 8 ký tự.' });
    }
    if (fullName.trim().length > 100) {
      return res.status(400).json({ error: 'Họ tên không được vượt quá 100 ký tự.' });
    }

    // 1. Check existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email này đã được sử dụng trong hệ thống.' });
    }

    // Department and organization membership can be added later by the user.
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: fullName.trim(),
        role: 'USER',
        status: 'ACTIVE'
      }
    });

    // 5. Create default UserPreference
    await prisma.userPreference.create({
      data: {
        userId: user.id,
        favMusicGenre: 'Lo-fi Hip Hop',
        petPersona: 'Vui vẻ',
        soundEnabled: true,
        aiLearningEnabled: true
      }
    });

    // 6. Create Virtual Pet if petTypeId provided or fallback to first PetType
    let selectedPetType = null;
    if (petTypeId) {
      selectedPetType = await prisma.petType.findUnique({ where: { id: petTypeId } });
    }
    if (!selectedPetType) {
      selectedPetType = await prisma.petType.findFirst({ where: { isActive: true } });
    }

    if (selectedPetType) {
      await prisma.userPet.create({
        data: {
          userId: user.id,
          typeId: selectedPetType.id,
          name: petName || 'Pixel Buddy',
          level: 1,
          exp: 0,
          hunger: 80,
          happiness: 100,
          health: 100,
          currentState: 'IDLE',
          currentMode: 'RELAXED'
        }
      });
    }

    const token = signToken(user.id, user.role);
    res.status(201).json({
      message: 'Đăng ký thành công!',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        department: null,
        organization: null
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ khi đăng ký tài khoản.', details: error.message });
  }
});

/**
 * Login User
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const otp = typeof req.body.otp === 'string' ? req.body.otp.trim() : '';
    if (!email || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Vui lòng cung cấp email và mật khẩu.' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        department: true,
        organization: true,
        userPet: {
          include: { petType: true }
        },
        preference: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động.' });
    }

    if (user.twoFactorEnabled) {
      if (!otp) {
        return res.status(200).json({ requires2FA: true, message: 'Vui lòng nhập mã 2FA để tiếp tục.' });
      }
      if (!user.twoFactorSecret || !verifyTotp(user.twoFactorSecret, otp)) {
        return res.status(401).json({ error: 'Mã xác thực 2FA không chính xác hoặc chưa được cấu hình.' });
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    const token = signToken(user.id, user.role);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        department: user.department,
        organization: user.organization,
        userPet: user.role === 'USER' ? user.userPet : null,
        preference: user.preference
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Lỗi máy chủ khi đăng nhập.', details: error.message });
  }
});

/**
 * Request OTP via SMTP Gmail (App Password)
 */
router.post('/request-otp', async (req: Request, res: Response) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) {
      return res.status(400).json({ error: 'Vui lòng cung cấp email.' });
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      return res.status(503).json({ error: 'Chức năng gửi OTP chưa được cấu hình.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản với email này.' });
    }
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động.' });
    }

    const otp = randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 8);

    try {
      await transporter.sendMail({
        from: `"OfficePet 2D Pixel" <${process.env.SMTP_USER}>`,
        to: email,
        subject: '[OfficePet] Mã OTP Xác Thực Đăng Nhập Của Bạn',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px; border: 2px solid #8DA399; border-radius: 8px;">
            <h2 style="color: #2D3748;">OfficePet 2D Pixel - Xác thực 2 Bước</h2>
            <p>Chào bạn,</p>
            <p>Mã xác thực OTP đăng nhập an toàn của bạn là:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #D98A6C; margin: 20px 0; text-align: center;">
              ${otp}
            </div>
            <p style="color: #718096; font-size: 13px;">Mã này có hiệu lực trong vòng 10 phút. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
          </div>
        `
      });
    } catch (mailErr) {
      console.error('OTP email delivery failed:', mailErr);
      return res.status(503).json({ error: 'Không thể gửi OTP. Vui lòng kiểm tra cấu hình email và thử lại.' });
    }

    otpStore[email] = {
      otpHash,
      expiresAt: Date.now() + 10 * 60 * 1000
    };
    res.json({ message: 'Mã OTP đã được gửi đến email của bạn.', email });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi gửi mã OTP.', details: error.message });
  }
});

/**
 * Verify OTP
 */
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const otp = typeof req.body.otp === 'string' ? req.body.otp.trim() : '';
    if (!email || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: 'Email hoặc mã OTP không hợp lệ.' });
    }
    const record = otpStore[email];

    if (!record || Date.now() > record.expiresAt) {
      return res.status(400).json({ error: 'Mã OTP không hợp lệ hoặc đã hết hạn.' });
    }

    const isValid = await bcrypt.compare(otp, record.otpHash);
    if (!isValid) {
      return res.status(400).json({ error: 'Mã OTP không chính xác.' });
    }

    delete otpStore[email];

    const user = await prisma.user.findUnique({
      where: { email },
      include: { department: true, userPet: { include: { petType: true } }, preference: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User không tồn tại.' });
    }
    if (user.status !== 'ACTIVE') {
      delete otpStore[email];
      return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động.' });
    }

    const token = signToken(user.id, user.role);
    const { passwordHash: _passwordHash, ...safeUser } = user;
    res.json({
      message: 'Xác thực OTP thành công!',
      token,
      user: { ...safeUser, userPet: user.role === 'USER' ? user.userPet : null }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi xác thực OTP.', details: error.message });
  }
});

/**
 * Get Current User Profile (US-U15)
 */
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        status: true,
        orgId: true,
        deptId: true,
        createdAt: true,
        updatedAt: true,
        organization: true,
        department: {
          include: { background: true }
        },
        userPet: {
          include: { petType: true }
        },
        preference: true,
        dailyGoals: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User không tồn tại.' });
    }

    res.json({ ...user, userPet: user.role === 'USER' ? user.userPet : null });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi lấy thông tin tài khoản.', details: error.message });
  }
});

/**
 * Update Profile or Password (US-U15)
 */
router.patch('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { fullName, avatarUrl, oldPassword, newPassword } = req.body;

    const dataToUpdate: any = {};
    if (fullName) dataToUpdate.fullName = fullName;
    if (avatarUrl) dataToUpdate.avatarUrl = avatarUrl;

    if (newPassword) {
      if (!oldPassword) {
        return res.status(400).json({ error: 'Cần nhập mật khẩu hiện tại để đổi mật khẩu.' });
      }
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const isMatch = await bcrypt.compare(oldPassword, user!.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác.' });
      }
      dataToUpdate.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        status: true,
        orgId: true,
        deptId: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({ message: 'Cập nhật thông tin thành công!', user: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi cập nhật hồ sơ.', details: error.message });
  }
});

export default router;
