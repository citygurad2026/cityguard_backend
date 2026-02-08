import { Request, Response } from "express";
import {
  PrismaClient,
  AdTargetType,
  BannerType,
  AdStatus,
} from "@prisma/client";

import { uploadToCloudinary, deleteFromCloudinary } 
  from "../../utils/uploadToCloudinary";

import { validateAdInput } 
  from "../../middlewares/validateRequest";

const prisma = new PrismaClient();

/* =======================
   TYPES
======================= */
interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
  };
}

/* =======================
   CONTROLLER
======================= */
const adController = {

  /* =======================
     CREATE AD
  ======================= */
 async createAd(req: Request, res: Response) {
  try {
    const user = (req as AuthRequest).user;
    const data = req.body;

    if (!user) {
      return res.status(401).json({ message: "غير مصرح" });
    }

    // ✅ validation
    const { isValid, errors } = validateAdInput(data);
    if (!isValid) {
      return res.status(400).json({ errors });
    }

    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);

    if (endAt <= startAt) {
      return res.status(400).json({
        message: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية",
      });
    }

    // ===== صلاحيات حسب الدور =====
    if (user.role === "ADMIN") {
      if (data.targetType !== "EXTERNAL") {
        return res.status(400).json({
          message: "المدير يمكنه إنشاء إعلانات خارجية فقط",
        });
      }
    }

    if (user.role === "OWNER") {
      if (data.targetType !== "BUSINESS") {
        return res.status(400).json({
          message: "المالك يمكنه الإعلان عن متجره فقط",
        });
      }

      const businessId = Number(data.targetId);
      const business = await prisma.business.findUnique({ where: { id: businessId } });
      if (!business || business.ownerId !== user.id) {
        return res.status(403).json({
          message: "لا يمكنك الإعلان عن متجر لا تملكه",
        });
      }
    }

    // ===== رفع الصور =====
    const files = req.files as {
      image?: Express.Multer.File[];
      mobileImage?: Express.Multer.File[];
      tabletImage?: Express.Multer.File[];
    };

    let imageUrl;
    let mobileImageUrl ;
    let tabletImageUrl;

    if (files?.image?.[0]) {
      const upload = await uploadToCloudinary(files.image[0]);
      imageUrl = upload.secure_url;

    }

    if (files?.mobileImage?.[0]) {
      const upload = await uploadToCloudinary(files.mobileImage[0]);
      mobileImageUrl = upload.secure_url;

    }

    if (files?.tabletImage?.[0]) {
      const upload = await uploadToCloudinary(files.tabletImage[0]);
      tabletImageUrl = upload.secure_url;
 
    }

    // ===== تجهيز البيانات =====
    const adData: any = {
      title: data.title,
      content: data.content || null,
      bannerType: data.bannerType || "MAIN_HERO",
      targetType: data.targetType,
      url: data.url || null,
      startAt,
      endAt,
      imageUrl,
      mobileImageUrl,
      tabletImageUrl,
      status: "PENDING_REVIEW",
      isActive: false,
      priority: 0,
    };

    if (data.targetType === "BUSINESS") {
      adData.targetId = Number(data.targetId);
    } else {
      adData.targetId = null;
    }

    const ad = await prisma.ad.create({ data: adData });

    res.status(201).json({ ad });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "خطأ داخلي" });
  }
},

  /* =======================
     GET PUBLIC ADS
  ======================= */
  async getPublicAds(req: Request, res: Response) {
    try {
      const now = new Date();

      const ads = await prisma.ad.findMany({
        where: {
          isActive: true,
          status: "APPROVED",
          startAt: { lte: now },
          endAt: { gte: now },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      });

      if (ads.length) {
        await prisma.ad.updateMany({
          where: { id: { in: ads.map(a => a.id) } },
          data: { impressions: { increment: 1 } },
        });
      }

      res.json({ ads });
    } catch {
      res.status(500).json({ message: "خطأ داخلي" });
    }
  },

  /* =======================
     GET ADS BY TYPE
  ======================= */
  async getAdsByType(req: Request, res: Response) {
    try {
      const { type } = req.params;
      const now = new Date();

      if (!Object.values(BannerType).includes(type as BannerType)) {
        return res.status(400).json({ message: "نوع غير صالح" });
      }

      const ads = await prisma.ad.findMany({
        where: {
          bannerType: type as BannerType,
          isActive: true,
          status: "APPROVED",
          startAt: { lte: now },
          endAt: { gte: now },
        },
        orderBy: [{ priority: "desc" }],
        take: 5,
      });

      res.json({ ads });
    } catch {
      res.status(500).json({ message: "خطأ داخلي" });
    }
  },
  async getAllAds(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const {
      page = "1",
      limit = "20",
      status,
      bannerType,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query as any;

    if (!user || !["ADMIN", "OWNER"].includes(user.role)) {
      return res.status(403).json({ message: "غير مصرح" });
    }

    const where: any = {};

    if (status) where.status = status;
    if (bannerType) where.bannerType = bannerType;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
      ];
    }

    // المالك يشوف إعلاناته فقط
    if (user.role === "OWNER") {
      where.business = { ownerId: user.id };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [ads, total] = await prisma.$transaction([
      prisma.ad.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          business: { select: { id: true, name: true } },
        },
      }),
      prisma.ad.count({ where }),
    ]);

    res.json({
      ads,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("getAllAds error:", err);
    res.status(500).json({ message: "خطأ داخلي" });
  }
},
async getAdById(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ message: "معرف الإعلان غير صالح" });
    }

    const ad = await prisma.ad.findUnique({
      where: { id },
      include: {
        business: { select: { id: true, name: true, ownerId: true } },
      },
    });

    if (!ad) {
      return res.status(404).json({ message: "الإعلان غير موجود" });
    }

    // المالك ما يشوف إلا إعلانه
    if (
      user?.role === "OWNER" &&
      ad.business?.ownerId !== user.id
    ) {
      return res.status(403).json({ message: "غير مصرح" });
    }

    res.json({ ad });
  } catch (err) {
    console.error("getAdById error:", err);
    res.status(500).json({ message: "خطأ داخلي" });
  }
},
async updateAdStatus(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const id = Number(req.params.id);
    const { status, rejectionReason } = req.body;

    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({ message: "غير مصرح" });
    }

    if (isNaN(id)) {
      return res.status(400).json({ message: "معرف الإعلان غير صالح" });
    }

    const validStatuses: AdStatus[] = [
      "APPROVED",
      "REJECTED",
      "PENDING_REVIEW",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "حالة غير صالحة" });
    }

    const ad = await prisma.ad.findUnique({ where: { id } });
    if (!ad) {
      return res.status(404).json({ message: "الإعلان غير موجود" });
    }

    const updateData: any = { status };

    if (status === "REJECTED") {
      updateData.rejectionReason = rejectionReason || "لم يتم تحديد السبب";
      updateData.isActive = false;
    }

    if (status === "APPROVED") {
      updateData.isActive = true;
    }

    const updatedAd = await prisma.ad.update({
      where: { id },
      data: updateData,
    });

    res.json({
      message: "تم تحديث حالة الإعلان",
      ad: updatedAd,
    });
  } catch (err) {
    console.error("updateAdStatus error:", err);
    res.status(500).json({ message: "خطأ داخلي" });
  }
},


  /* =======================
     INCREMENT CLICKS
  ======================= */
  async incrementClicks(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID غير صالح" });
    }

    await prisma.ad.update({
      where: { id },
      data: { clicks: { increment: 1 } },
    });

    res.json({ ok: true });
  },

  /* =======================
     GET MY ADS (OWNER)
  ======================= */
  async getMyAds(req: Request, res: Response) {
    const user = (req as AuthRequest).user;

    if (!user || user.role !== "OWNER") {
      return res.status(403).json({ message: "غير مصرح" });
    }

    const ads = await prisma.ad.findMany({
      where: {
        targetType: "BUSINESS",
        business: { ownerId: user.id },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ ads });
  },

  /* =======================
     UPDATE AD
  ======================= */
 async updateAd(req: Request, res: Response) {
  try {
    const user = (req as AuthRequest).user;
    const id = Number(req.params.id);

    if (isNaN(id)) return res.status(400).json({ message: "معرف الإعلان غير صالح" });

    const ad = await prisma.ad.findUnique({ where: { id } });
    if (!ad) return res.status(404).json({ message: "الإعلان غير موجود" });

    // OWNER لا يمكنه تعديل هذه الحقول
    if (user?.role === "OWNER") {
      delete req.body.status;
      delete req.body.priority;
      delete req.body.isActive;
    }

    // معالجة التواريخ
    if (req.body.startAt) req.body.startAt = new Date(req.body.startAt);
    if (req.body.endAt) req.body.endAt = new Date(req.body.endAt);

    // معالجة الصور الجديدة
    const files = req.files as {
      image?: Express.Multer.File[];
      mobileImage?: Express.Multer.File[];
      tabletImage?: Express.Multer.File[];
    };

    if (files?.image?.[0]) {
      if (ad.imagePublicId) await deleteFromCloudinary(ad.imagePublicId);
      const upload = await uploadToCloudinary(files.image[0]);
      req.body.imageUrl = upload.secure_url;
      req.body.imagePublicId = upload.public_id;
    }

    if (files?.mobileImage?.[0]) {
      if (ad.mobileImagePublicId) await deleteFromCloudinary(ad.mobileImagePublicId);
      const upload = await uploadToCloudinary(files.mobileImage[0]);
      req.body.mobileImageUrl = upload.secure_url;
      req.body.mobileImagePublicId = upload.public_id;
    }

    if (files?.tabletImage?.[0]) {
      if (ad.tabletImagePublicId) await deleteFromCloudinary(ad.tabletImagePublicId);
      const upload = await uploadToCloudinary(files.tabletImage[0]);
      req.body.tabletImageUrl = upload.secure_url;
      req.body.tabletImagePublicId = upload.public_id;
    }

    // تحديث الإعلان
    const updatedAd = await prisma.ad.update({
      where: { id },
      data: req.body,
    });

    res.json({ ad: updatedAd });
  } catch (err: any) {
    console.error("updateAd error:", err);
    res.status(500).json({ message: "خطأ داخلي" });
  }
},


  /* =======================
     DELETE AD
  ======================= */
  async deleteAd(req: Request, res: Response) {
    const id = Number(req.params.id);

    const ad = await prisma.ad.findUnique({ where: { id } });
    if (!ad) return res.status(404).json({ message: "غير موجود" });

    if (ad.imagePublicId) await deleteFromCloudinary(ad.imagePublicId);
    if (ad.mobileImagePublicId) await deleteFromCloudinary(ad.mobileImagePublicId);
    if (ad.tabletImagePublicId) await deleteFromCloudinary(ad.tabletImagePublicId);

    await prisma.ad.delete({ where: { id } });

    res.json({ ok: true });
  },
};

export default adController;
