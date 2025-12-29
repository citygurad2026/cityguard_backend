import { Request, Response } from "express";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// Interface للمستخدم المصادق عليه
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: Role;
    [key: string]: any;
  };
}

/* ============================
   REGISTER USER (ADMIN)
============================ */
export const adminCreateUser = async (req: Request, res: Response) => {
  try {
    const { username, password, name, phone, role } = req.body;

    // التحقق من صلاحيات المستخدم
    const adminUser = (req as AuthenticatedRequest).user;
    if (!adminUser || adminUser.role !== "ADMIN") {
      return res.status(403).json({ 
        ok: false, 
        message: "غير مصرح - للمشرفين فقط" 
      });
    }

    // التحقق من البيانات
    if (!username || !password || !name) {
      return res.status(400).json({ 
        ok: false, 
        message: "اسم المستخدم وكلمة المرور والاسم مطلوبة" 
      });
    }

    if (!["OWNER", "USER", "ADMIN"].includes(role)) {
      return res.status(400).json({ 
        ok: false, 
        message: "الدور غير صالح" 
      });
    }

    // التحقق من عدم وجود المستخدم مسبقاً
    const existingUser = await prisma.user.findUnique({ 
      where: { username } 
    });
    
    if (existingUser) {
      return res.status(409).json({ 
        ok: false, 
        message: "اسم المستخدم مستخدم بالفعل" 
      });
    }

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { 
        username: username.trim(), 
        password: hashedPassword, 
        name: name.trim(), 
        phone: phone?.trim() || null, 
        role: role as Role 
      },
    });

    res.json({ 
      ok: true, 
      message: "تم إنشاء المستخدم بنجاح",
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (err: any) {
    console.error("Error in adminCreateUser:", err);
    
    let errorMessage = "حدث خطأ أثناء إنشاء المستخدم";
    if (err.code === "P2002") {
      errorMessage = "اسم المستخدم مستخدم بالفعل";
    }
    
    res.status(500).json({ 
      ok: false, 
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

/* ============================
   REGISTER USER (PUBLIC)
============================ */
export const registerUser = async (req: Request, res: Response) => {
  try {
    const { username, password, name, phone } = req.body;

    // التحقق من البيانات
    if (!username || username.trim().length < 3) {
      return res.status(400).json({ 
        ok: false,
        message: "اسم المستخدم مطلوب (على الأقل 3 أحرف)" 
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ 
        ok: false,
        message: "كلمة المرور مطلوبة (على الأقل 6 أحرف)" 
      });
    }

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ 
        ok: false,
        message: "الاسم مطلوب (على الأقل حرفين)" 
      });
    }

    // Check if username exists
    const existingUser = await prisma.user.findUnique({ 
      where: { username: username.trim() } 
    });
    
    if (existingUser) {
      return res.status(409).json({ 
        ok: false,
        message: "اسم المستخدم مستخدم بالفعل" 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        phone: phone?.trim() || null,
        password: hashedPassword,
        name: name.trim(),
        role: "USER",
      },
    });

    // إنشاء جلسة وتسجيل الدخول تلقائياً
    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: "15m" }  
    );

    const refreshToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-key',
      { expiresIn: "7d" }
    );

    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isValid: true,
      },
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict", 
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      ok: true,
      message: "تم إنشاء الحساب بنجاح",
      accessToken,
      data: {
        id: user.id,
        username: user.username,
        phone: user.phone,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error("Error in registerUser:", err);
    
    let errorMessage = "حدث خطأ أثناء إنشاء الحساب";
    if (err.code === "P2002") {
      errorMessage = "اسم المستخدم مستخدم بالفعل";
    }
    
    res.status(500).json({ 
      ok: false,
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

/* ============================
   LOGIN USER
============================ */
export const loginUser = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        ok: false,
        message: "اسم المستخدم وكلمة المرور مطلوبان" 
      });
    }

    const user = await prisma.user.findUnique({ 
      where: { username: username.trim() } 
    });

    if (!user) {
      return res.status(404).json({ 
        ok: false,
        message: "اسم المستخدم أو كلمة المرور غير صحيحة" 
      });
    }

    // التحقق من حالة المستخدم
    if (!user.isActive) {
      return res.status(403).json({ 
        ok: false,
        message: "الحساب معطل، يرجى التواصل مع الإدارة" 
      });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ 
        ok: false,
        message: "اسم المستخدم أو كلمة المرور غير صحيحة" 
      });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // إبطال الجلسات القديمة
    await prisma.session.updateMany({
      where: { 
        userId: user.id,
        isValid: true 
      },
      data: { isValid: false }
    });

    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: "15m" }  
    );

    const refreshToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-key',
      { expiresIn: "7d" }
    );

    // إنشاء جلسة جديدة
    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isValid: true,
      },
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict", 
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      ok: true,
      message: "تم تسجيل الدخول بنجاح",
      accessToken,
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
      },
    });
  } catch (err: any) {
    console.error("Error in loginUser:", err);
    res.status(500).json({ 
      ok: false,
      message: "حدث خطأ أثناء تسجيل الدخول",
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

/* ============================
   GET USER INFO
============================ */
export const getUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ 
        ok: false, 
        message: "معرف المستخدم غير صالح" 
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,        
        phone: true,
        avatarUrl: true,
        bio: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
        ownedBusinesses: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            _count: {
              select: {
                reviews: true,
                favorites: true
              }
            }
          }
        },
        reviews: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            business: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        },
        favorites: {
          take: 5,
          select: {
            business: {
              select: {
                id: true,
                name: true,
                slug: true,
              }
            }
          }
        },
        _count: {
          select: {
            reviews: true,
            favorites: true,
            sentMessages: true,
            bookmarks: true
          }
        }
      },
    });

    if (!user) {
      return res.status(404).json({ 
        ok: false, 
        message: "المستخدم غير موجود" 
      });
    }

    res.json({ 
      ok: true, 
      message: "تم جلب بيانات المستخدم",
      data: user 
    });
  } catch (err: any) {
    console.error("Error in getUser:", err);
    res.status(500).json({ 
      ok: false,
      message: "حدث خطأ في جلب بيانات المستخدم",
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

/* ============================
   GET USERS LIST
============================ */
export const getUsers = async (req: Request, res: Response) => {
  try {
    // التحقق من صلاحيات المستخدم
    const adminUser = (req as AuthenticatedRequest).user;
    if (!adminUser || adminUser.role !== "ADMIN") {
      return res.status(403).json({ 
        ok: false, 
        message: "غير مصرح - للمشرفين فقط" 
      });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        lastLogin: true,
        createdAt: true
      },
      orderBy: { id: "desc" }
    });

    res.json({ 
      ok: true, 
      message: "تم جلب المستخدمين بنجاح",
      data: users,
      count: users.length
    });
  } catch (err: any) {
    console.error("Error in getUsers:", err);
    res.status(500).json({ 
      ok: false, 
      message: "حدث خطأ في جلب المستخدمين",
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

/* ============================
   UPDATE USER (ADMIN)
============================ */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ 
        ok: false, 
        message: "معرف المستخدم غير صالح" 
      });
    }

    const adminUser = (req as AuthenticatedRequest).user;
    if (!adminUser || adminUser.role !== "ADMIN") {
      return res.status(403).json({ 
        ok: false, 
        message: "غير مصرح - للمشرفين فقط" 
      });
    }

    const { name, phone, username, role, password } = req.body;
    
    // التحقق من صحة الدور
    if (role && !["OWNER", "USER", "ADMIN"].includes(role)) {
      return res.status(400).json({ 
        ok: false, 
        message: "الدور غير صالح" 
      });
    }

    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (username !== undefined) updateData.username = username.trim();
    if (role !== undefined) updateData.role = role as Role;
    
    // تحديث كلمة المرور إذا تم إرسالها
    if (password && password.length >= 6) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    res.json({ 
      ok: true,
      message: "تم تحديث المستخدم بنجاح",
      data: {
        id: updated.id,
        username: updated.username,
        name: updated.name,
        phone: updated.phone,
        role: updated.role,
        isActive: updated.isActive
      }
    });
  } catch (err: any) {
    console.error("Error in updateUser:", err);
    
    let errorMessage = "حدث خطأ أثناء تحديث المستخدم";
    if (err.code === "P2002") {
      errorMessage = "اسم المستخدم مستخدم بالفعل";
    } else if (err.code === "P2025") {
      errorMessage = "المستخدم غير موجود";
    }
    
    res.status(400).json({ 
      ok: false,
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

/* ============================
   UPDATE PROFILE (USER)
============================ */
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ 
        ok: false, 
        message: "معرف المستخدم غير صالح" 
      });
    }

    const currentUser = (req as AuthenticatedRequest).user;
    if (!currentUser || currentUser.id !== userId) {
      return res.status(403).json({ 
        ok: false, 
        message: "غير مصرح - لا يمكنك تعديل بيانات مستخدم آخر" 
      });
    }

    const { name, phone, avatarUrl, bio } = req.body;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name?.trim() || undefined,
        phone: phone?.trim() || null,
        avatarUrl: avatarUrl?.trim() || null,
        bio: bio?.trim() || null,
      },
    });

    res.json({ 
      ok: true,
      message: "تم تحديث الملف الشخصي بنجاح",
      data: {
        id: updated.id,
        username: updated.username,
        name: updated.name,
        phone: updated.phone,
        avatarUrl: updated.avatarUrl,
        bio: updated.bio
      }
    });
  } catch (err: any) {
    console.error("Error in updateProfile:", err);
    res.status(400).json({ 
      ok: false,
      message: "حدث خطأ أثناء تحديث الملف الشخصي",
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

/* ============================
   DELETE USER
============================ */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ 
        ok: false, 
        message: "معرف المستخدم غير صالح" 
      });
    }

    const adminUser = (req as AuthenticatedRequest).user;
    if (!adminUser || adminUser.role !== "ADMIN") {
      return res.status(403).json({ 
        ok: false, 
        message: "غير مصرح - للمشرفين فقط" 
      });
    }

    // التحقق من وجود المستخدم
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ 
        ok: false, 
        message: "المستخدم غير موجود" 
      });
    }

    // منع حذف حساب admin آخر
    if (user.role === "ADMIN" && adminUser.id !== userId) {
      return res.status(403).json({ 
        ok: false, 
        message: "لا يمكن حذف حساب مشرف آخر" 
      });
    }

    // حذف الجلسات أولاً
    await prisma.session.deleteMany({
      where: { userId }
    });

    await prisma.user.delete({ 
      where: { id: userId } 
    });

    res.json({ 
      ok: true, 
      message: "تم حذف المستخدم بنجاح",
      data: { id: userId, username: user.username }
    });
  } catch (err: any) {
    console.error("Error in deleteUser:", err);
    
    let errorMessage = "حدث خطأ أثناء حذف المستخدم";
    if (err.code === "P2025") {
      errorMessage = "المستخدم غير موجود";
    }
    
    res.status(500).json({ 
      ok: false, 
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

/* ============================
   REFRESH TOKEN
============================ */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ 
        ok: false,
        message: 'لم يتم تقديم رمز التحديث' 
      });
    }

    const session = await prisma.session.findUnique({
      where: { token },
    });

    if (!session || !session.isValid || session.expiresAt < new Date()) {
      // حذف الكوكي غير الصالح
      res.clearCookie("refreshToken");
      return res.status(403).json({ 
        ok: false,
        message: "رمز التحديث غير صالح أو منتهي الصلاحية" 
      });
    }

    const decoded = jwt.verify(
      token, 
      process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-key'
    ) as any;
    
    const newAccessToken = jwt.sign(
      { id: decoded.id, role: decoded.role }, 
      process.env.JWT_SECRET || 'fallback-secret-key', 
      { expiresIn: '15m' }
    );

    res.json({ 
      ok: true,
      message: "تم تحديث رمز الوصول",
      accessToken: newAccessToken 
    });
  } catch (err: any) {
    console.error("Error in refreshToken:", err);
    res.status(403).json({ 
      ok: false,
      message: 'رمز التحديث غير صالح'
    });
  }
};

/* ============================
   GET ACTIVE SESSIONS
============================ */
export const getActiveSessions = async (req: Request, res: Response) => {
  try {
    const adminUser = (req as AuthenticatedRequest).user;
    if (!adminUser || adminUser.role !== "ADMIN") {
      return res.status(403).json({ 
        ok: false, 
        message: "غير مصرح - للمشرفين فقط" 
      });
    }

    const now = new Date();
    const activeSessions = await prisma.session.findMany({
      where: {
        isValid: true,
        expiresAt: { gt: now },
      },
      include: { 
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            role: true
          }
        } 
      },
      orderBy: { expiresAt: 'desc' }
    });

    res.json({ 
      ok: true, 
      message: "تم جلب الجلسات النشطة",
      data: activeSessions,
      count: activeSessions.length 
    });
  } catch (err: any) {
    console.error("Error in getActiveSessions:", err);
    res.status(500).json({ 
      ok: false, 
      message: "حدث خطأ في جلب الجلسات",
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

/* ============================
   LOGOUT USER
============================ */
export const logoutUser = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.refreshToken;
    
    if (token) {
      // تعطيل الجلسة
      await prisma.session.updateMany({
        where: { token },
        data: { isValid: false }
      });
    }

    // حذف الكوكي
    res.clearCookie("refreshToken");
    
    res.json({ 
      ok: true, 
      message: "تم تسجيل الخروج بنجاح" 
    });
  } catch (err: any) {
    console.error("Error in logoutUser:", err);
    res.status(500).json({ 
      ok: false, 
      message: "حدث خطأ أثناء تسجيل الخروج",
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};