import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getJwtSecret } from '../utils/jwt';
import { verifyTotp } from '../utils/totp';
import { formatUserPet, safeJsonParse } from '../utils/jsonHelper';

function formatPreference(pref: any) {
  if (!pref) return pref;
  return {
    ...pref,
    selectedMusicTrack: typeof pref.selectedMusicTrack === 'string' ? safeJsonParse(pref.selectedMusicTrack, null) : pref.selectedMusicTrack,
    settings: typeof pref.settings === 'string' ? safeJsonParse(pref.settings, null) : pref.settings
  };
}

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
 * Request OTP for User Registration
 */
router.post('/request-register-otp', async (req: Request, res: Response) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Vui lòng nhập địa chỉ email hợp lệ.' });
    }
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      return res.status(503).json({ error: 'Hệ thống gửi email chưa được cấu hình.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email này đã được đăng ký. Vui lòng đăng nhập hoặc chọn Quên mật khẩu.' });
    }

    const otp = randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 8);

    try {
      await transporter.sendMail({
        from: `"OfficePet 2D Pixel" <${process.env.SMTP_USER}>`,
        to: email,
        subject: '[OfficePet] Mã OTP Xác Thực Tạo Tài Khoản',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 24px; border: 2px solid #8DA399; border-radius: 12px; background: #faf9f6;">
            <h2 style="color: #2D3748; margin-top: 0;">Chào mừng bạn đến với OfficePet! 🐾</h2>
            <p>Cảm ơn bạn đã đăng ký tham gia văn phòng ảo cùng thú cưng.</p>
            <p>Mã xác thực OTP tạo tài khoản của bạn là:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #D98A6C; margin: 20px 0; text-align: center; background: #ffffff; padding: 12px; border: 2px dashed #D98A6C; border-radius: 8px;">
              ${otp}
            </div>
            <p style="color: #718096; font-size: 13px;">Mã có hiệu lực trong vòng 10 phút. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
          </div>
        `
      });
    } catch (mailErr) {
      console.error('Register OTP email delivery failed:', mailErr);
      return res.status(503).json({ error: 'Không thể gửi email OTP. Vui lòng thử lại sau.' });
    }

    otpStore['reg_' + email] = {
      otpHash,
      expiresAt: Date.now() + 10 * 60 * 1000
    };
    res.json({ message: 'Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư.', email });
  } catch (err: any) {
    console.error('Register OTP error:', err);
    res.status(500).json({ error: 'Không thể gửi mã OTP.', details: err.message });
  }
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Vui lòng nhập địa chỉ email hợp lệ.' });
  }
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    return res.status(503).json({ error: 'Chức năng khôi phục mật khẩu chưa được cấu hình gửi email.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      const now = new Date();
      const recentRequests = await prisma.passwordResetToken.count({
        where: { userId: user.id, createdAt: { gte: new Date(now.getTime() - 15 * 60 * 1000) } }
      });
      if (recentRequests >= 5) {
        return res.json({ message: 'Nếu email thuộc tài khoản OfficePet, mã OTP và liên kết đặt lại mật khẩu đã được gửi đến hộp thư.' });
      }

      // 1. Generate 6-digit OTP
      const otp = randomInt(100000, 1000000).toString();
      const otpHash = await bcrypt.hash(otp, 8);
      otpStore['reset_' + email] = {
        otpHash,
        expiresAt: Date.now() + 15 * 60 * 1000
      };

      // 2. Also generate Token Link for direct web link reset
      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(now.getTime() + 30 * 60 * 1000)
        }
      });

      const frontendUrl = (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
      const resetUrl = `${frontendUrl}/?resetToken=${encodeURIComponent(token)}`;
      try {
        await transporter.sendMail({
          from: `"OfficePet 2D Pixel" <${process.env.SMTP_USER}>`,
          to: email,
          subject: '[OfficePet] Mã OTP Khôi Phục Mật Khẩu',
          text: `Mã OTP khôi phục mật khẩu của bạn là: ${otp} (Hiệu lực 15 phút).\nHoặc mở liên kết sau: ${resetUrl}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:2px solid #8DA399;border-radius:12px;background:#faf9f6;">
              <h2 style="color:#2D3748;margin-top:0;">Khôi phục mật khẩu OfficePet 🐾</h2>
              <p>Bạn đã yêu cầu đặt lại mật khẩu. Sử dụng mã OTP dưới đây để nhập trực tiếp trên ứng dụng:</p>
              <div style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#D98A6C;margin:20px 0;text-align:center;background:#ffffff;padding:12px;border:2px dashed #D98A6C;border-radius:8px;">
                ${otp}
              </div>
              <p style="color:#718096;font-size:13px;">Mã OTP có hiệu lực trong vòng 15 phút.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
              <p style="font-size:13px;color:#4a5568;">Hoặc bạn có thể bấm vào liên kết trực tiếp sau để đổi mật khẩu:</p>
              <p style="text-align:center;"><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#8DA399;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">Đặt lại mật khẩu qua liên kết</a></p>
              <p style="font-size:12px;color:#a0aec0;">Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
            </div>
          `
        });
      } catch (mailError) {
        await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, tokenHash } });
        delete otpStore['reset_' + email];
        console.error('Password reset email delivery failed:', mailError);
        return res.status(503).json({ error: 'Không thể gửi email khôi phục. Vui lòng thử lại sau.' });
      }
    }
    res.json({ message: 'Mã OTP khôi phục mật khẩu đã được gửi đến email của bạn.', email });
  } catch (error) {
    console.error('Password reset request failed:', error);
    res.status(500).json({ error: 'Không thể xử lý yêu cầu khôi phục mật khẩu.' });
  }
});

/**
 * Reset password via 6-digit OTP code directly
 */
router.post('/reset-password-otp', async (req: Request, res: Response) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const otp = typeof req.body.otp === 'string' ? req.body.otp.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'Vui lòng cung cấp email và mã OTP 6 chữ số hợp lệ.' });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Mật khẩu mới cần có từ 8 đến 128 ký tự.' });
  }

  const record = otpStore['reset_' + email];
  if (!record || Date.now() > record.expiresAt) {
    return res.status(400).json({ error: 'Mã OTP không hợp lệ hoặc đã hết hạn. Vui lòng lấy mã mới.' });
  }

  const isValid = await bcrypt.compare(otp, record.otpHash);
  if (!isValid) {
    return res.status(400).json({ error: 'Mã OTP không chính xác.' });
  }

  delete otpStore['reset_' + email];

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản với email này.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    res.json({ message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.' });
  } catch (error) {
    console.error('Password reset via OTP failed:', error);
    res.status(500).json({ error: 'Không thể đặt lại mật khẩu lúc này.' });
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  const token = typeof req.body.token === 'string' ? req.body.token : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ error: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Mật khẩu mới cần có từ 8 đến 128 ký tự.' });
  }

  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();
    const result = await prisma.$transaction(async tx => {
      const resetToken = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
      if (!resetToken || resetToken.expiresAt <= now) return false;

      const consumed = await tx.passwordResetToken.deleteMany({
        where: { id: resetToken.id, tokenHash, expiresAt: { gt: now } }
      });
      if (consumed.count !== 1) return false;

      await tx.user.update({ where: { id: resetToken.userId }, data: { passwordHash } });
      await tx.passwordResetToken.deleteMany({ where: { userId: resetToken.userId } });
      return true;
    }, { isolationLevel: 'Serializable' });

    if (!result) {
      return res.status(400).json({ error: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
    }
    res.json({ message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.' });
  } catch (error) {
    console.error('Password reset failed:', error);
    res.status(500).json({ error: 'Không thể đặt lại mật khẩu. Vui lòng thử lại.' });
  }
});

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

    // 2. Validate OTP if sent
    const otp = typeof req.body.otp === 'string' ? req.body.otp.trim() : '';
    if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
      if (!otp) {
        return res.status(400).json({ error: 'Vui lòng nhấn "Gửi mã OTP" và nhập mã 6 số từ email để xác thực tạo tài khoản.' });
      }
      const record = otpStore['reg_' + email];
      if (!record || Date.now() > record.expiresAt) {
        return res.status(400).json({ error: 'Mã OTP xác thực không hợp lệ hoặc đã hết hạn. Vui lòng nhấn gửi lại mã mới.' });
      }
      const isValid = await bcrypt.compare(otp, record.otpHash);
      if (!isValid) {
        return res.status(400).json({ error: 'Mã OTP xác thực không chính xác. Vui lòng kiểm tra lại.' });
      }
      delete otpStore['reg_' + email];
    } else if (otp) {
      const record = otpStore['reg_' + email];
      if (!record || Date.now() > record.expiresAt) {
        return res.status(400).json({ error: 'Mã OTP xác thực không hợp lệ hoặc đã hết hạn. Vui lòng gửi lại mã mới.' });
      }
      const isValid = await bcrypt.compare(otp, record.otpHash);
      if (!isValid) {
        return res.status(400).json({ error: 'Mã OTP không chính xác.' });
      }
      delete otpStore['reg_' + email];
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
        userPet: user.role === 'USER' ? formatUserPet(user.userPet) : null,
        preference: formatPreference(user.preference)
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
      user: {
        ...safeUser,
        userPet: user.role === 'USER' ? formatUserPet(user.userPet) : null,
        preference: formatPreference(user.preference)
      }
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

    res.json({
      ...user,
      userPet: user.role === 'USER' ? formatUserPet(user.userPet) : null,
      preference: formatPreference(user.preference)
    });
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
