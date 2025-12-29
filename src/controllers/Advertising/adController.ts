import { Request, Response } from "express";
import { PrismaClient, AdTargetType, BannerType, AdStatus } from "@prisma/client";
import { uploadToCloudinary, deleteFromCloudinary } from "../../utils/uploadToCloudinary";


const prisma = new PrismaClient();
const ALLOWED_SORT_FIELDS = ["createdAt", "priority", "clicks", "impressions"] as const;

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: string;
    [key: string]: any;
  };
}

interface QueryParams {
  page?: string;
  limit?: string;
  status?: AdStatus;
  bannerType?: BannerType;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface CreateAdData {
  title: string;
  content?: string;
  ctaText?: string;
  ctaUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  bannerType?: BannerType;
  targetType: AdTargetType;
  targetId?: string | number;
  url?: string;
  startAt?: string;
  endAt?: string;
}

export const adController = {
  
  /* ======================================================
     CREATE AD
  ====================================================== */
  async createAd(req: Request, res: Response) {
    try {
      
      const user = (req as AuthenticatedRequest).user;
      const data = req.body as CreateAdData;
      
      if (!user || !["ADMIN", "OWNER"].includes(user.role)) {
        return res.status(403).json({ message: "غير مصرح" });
      }

      const startAt = new Date(data.startAt as string);
      const endAt = new Date(data.endAt as string);
      if (!data.startAt || !data.endAt) {
      return res.status(400).json({ 
        message: "تاريخ البداية والنهاية مطلوبان" 
      });
      }
      // ========== التحقق بناءً على الدور ==========
      if (user.role === "ADMIN") {
        // المدير يمكنه إنشاء إعلانات SYSTEM فقط
        if (data.targetType !== "EXTERNAL") {
          return res.status(400).json({
            message: "المدير يمكنه إنشاء إعلانات نظامية فقط"
          });
        }
        data.targetId = undefined; // لا يوجد متجر
      }

      if (user.role === "OWNER") {
        // صاحب العمل يمكنه إنشاء إعلانات BUSINESS فقط
        if (data.targetType !== "BUSINESS") {
          return res.status(400).json({
            message: "صاحب العمل يمكنه إنشاء إعلانات لمتجره فقط"
          });
        }

        // التحقق من أن المتجر يخصه
        const businessId = Number(data.targetId);
        if (!businessId || isNaN(businessId)) {
          return res.status(400).json({ message: "معرف المتجر غير صالح" });
        }

        const business = await prisma.business.findUnique({
          where: { id: businessId },
        });

        if (!business) {
          return res.status(404).json({ message: "المتجر غير موجود" });
        }

        if (business.ownerId !== user.id) {
          return res.status(403).json({
            message: "لا يمكنك الإعلان لمتجر لا تملكه"
          });
        }
      }

      // رفع الصور مرة واحدة فقط
      let imageUrl: string | undefined;
      let mobileImageUrl: string | undefined;
      let tabletImageUrl: string | undefined;

      const files = req.files as {
        [fieldname: string]: Express.Multer.File[];
      } | undefined;

      if (files?.image?.[0]) {
        imageUrl = (await uploadToCloudinary(files.image[0])).secure_url;
      }
      if (files?.mobileImage?.[0]) {
        mobileImageUrl = (await uploadToCloudinary(files.mobileImage[0])).secure_url;
      }
      if (files?.tabletImage?.[0]) {
        tabletImageUrl = (await uploadToCloudinary(files.tabletImage[0])).secure_url;
      }

      // التحقق من الحقول المطلوبة
      if (!data.title) {
        return res.status(400).json({ message: "العنوان مطلوب" });
      }

      const ad = await prisma.ad.create({
        data: {
          title: data.title,
          content: data.content || null,
          imageUrl: imageUrl || null,
          mobileImageUrl: mobileImageUrl || null,
          tabletImageUrl: tabletImageUrl || null,
          ctaText: data.ctaText || null,
          ctaUrl: data.ctaUrl || null,
          backgroundColor: data.backgroundColor || null,
          textColor: data.textColor || null,
          bannerType: data.bannerType || BannerType.MAIN_HERO,
          targetType: data.targetType,
          targetId: user.role === "OWNER" ? Number(data.targetId) : null,
          url: data.url || null,
          startAt: startAt ,
          endAt:endAt ,
          status: "PENDING_REVIEW" as AdStatus,
          isActive: false,
          priority: 0,
        },
      });

      res.status(201).json({ message: "تم إنشاء الإعلان", ad });
    } catch (err: any) {
      console.error("Error in createAd:", err);
      res.status(500).json({ message: "خطأ داخلي", error: err.message });
    }
  },

  /* ======================================================
     GET ALL ADS (ADMIN / OWNER)
  ====================================================== */
  async getAllAds(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const {
        page = "1",
        limit = "20",
        status,
        bannerType,
        search,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query as QueryParams;

      if (!user || !["ADMIN", "OWNER"].includes(user.role)) {
        return res.status(403).json({ message: "غير مصرح" });
      }

      if (!ALLOWED_SORT_FIELDS.includes(sortBy as any)) {
        return res.status(400).json({ message: "حقل الترتيب غير مسموح" });
      }

      const where: any = {};

      if (status) where.status = status;
      if (bannerType) where.bannerType = bannerType;

      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" as const } },
          { content: { contains: search, mode: "insensitive" as const } },
        ];
      }

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
    } catch (err: any) {
      console.error("Error in getAllAds:", err);
      res.status(500).json({ message: "خطأ داخلي" });
    }
  },

  /* ======================================================
   GET AD BY ID
====================================================== */
  async getAdById(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ message: "معرف الإعلان غير صالح" });
      }

      const ad = await prisma.ad.findUnique({
        where: { id },
        include: {
          business: { select: { id: true, name: true } },
        },
      });

      if (!ad) {
        return res.status(404).json({ message: "الإعلان غير موجود" });
      }

      // تحقق من الصلاحية للمالك
      if (user?.role === "OWNER") {
        if (ad.targetType !== "BUSINESS" || !ad.targetId) {
          return res.status(403).json({ message: "غير مصرح" });
        }

        const business = await prisma.business.findUnique({
          where: { id: ad.targetId },
        });

        if (!business || business.ownerId !== user.id) {
          return res.status(403).json({ message: "غير مصرح" });
        }
      }

      res.json({ ad });
    } catch (err: any) {
      console.error("Error in getAdById:", err);
      res.status(500).json({ message: "خطأ داخلي" });
    }
  },

  /* ======================================================
     UPDATE AD STATUS
  ====================================================== */
  async updateAdStatus(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const id = parseInt(req.params.id);
      const { status, rejectionReason } = req.body as {
        status: AdStatus;
        rejectionReason?: string;
      };

      if (isNaN(id)) {
        return res.status(400).json({ message: "معرف الإعلان غير صالح" });
      }

      // للادمن فقط
      if (!user || user.role !== "ADMIN") {
        return res.status(403).json({ message: "غير مصرح" });
      }

      const validStatuses: AdStatus[] = ["APPROVED", "REJECTED", "PENDING_REVIEW"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: "حالة غير صالحة" });
      }

      const ad = await prisma.ad.findUnique({ where: { id } });
      if (!ad) return res.status(404).json({ message: "الإعلان غير موجود" });

      const updateData: any = { status };
      if (status === "REJECTED" && rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }
      if (status === "APPROVED") {
        updateData.isActive = true;
      }

      const updated = await prisma.ad.update({
        where: { id },
        data: updateData,
      });

      const statusMessage = status === "APPROVED" ? "الموافقة" :
                          status === "REJECTED" ? "الرفض" :
                          "تحديث الحالة";

      res.json({ message: `تم ${statusMessage}`, ad: updated });
    } catch (err: any) {
      console.error("Error in updateAdStatus:", err);
      res.status(500).json({ message: "خطأ داخلي" });
    }
  },

  /* ======================================================
   INCREMENT CLICKS
====================================================== */
  async incrementClicks(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ message: "معرف الإعلان غير صالح" });
      }

      await prisma.ad.update({
        where: { id },
        data: { clicks: { increment: 1 } },
      });

      res.json({ message: "تم تحديث النقرات" });
    } catch (err: any) {
      console.error("Error in incrementClicks:", err);
      res.status(500).json({ message: "خطأ داخلي" });
    }
  },

  /* ======================================================
   GET ADS BY BUSINESS (OWNER)
====================================================== */
  async getMyAds(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { page = "1", limit = "20", status } = req.query as {
        page?: string;
        limit?: string;
        status?: AdStatus;
      };

      if (!user || user.role !== "OWNER") {
        return res.status(403).json({ message: "غير مصرح" });
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [ads, total] = await Promise.all([
        prisma.ad.findMany({
          where: {
            targetType: "BUSINESS",
            business: { ownerId: user.id },
            ...(status && { status }),
          },
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: "desc" },
          include: {
            business: { select: { id: true, name: true } },
          },
        }),
        prisma.ad.count({
          where: {
            targetType: "BUSINESS",
            business: { ownerId: user.id },
            ...(status && { status }),
          },
        }),
      ]);

      res.json({
        ads,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (err: any) {
      console.error("Error in getMyAds:", err);
      res.status(500).json({ message: "خطأ داخلي" });
    }
  },

  /* ======================================================
   GET ACTIVE ADS BY BANNER TYPE
====================================================== */
  async getAdsByType(req: Request, res: Response) {
    try {
      const { type } = req.params;
      const now = new Date();

      // التحقق من صحة النوع
      const validTypes = Object.values(BannerType);
      if (!type || !validTypes.includes(type as BannerType)) {
        return res.status(400).json({ message: "نوع البانر غير صالح" });
      }

      const ads = await prisma.ad.findMany({
        where: {
          bannerType: type as BannerType,
          isActive: true,
          status: "APPROVED",
          startAt: { lte: now },
          endAt: { gte: now },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: 5,
      });

      // تحديث الـimpressions بشكل غير متزامن بدون انتظار
      if (ads.length > 0) {
        const updatePromises = ads.map(ad =>
          prisma.ad.update({
            where: { id: ad.id },
            data: { impressions: { increment: 1 } },
          })
        );
        Promise.all(updatePromises).catch(console.error); // لا نعيق الاستجابة
      }

      res.json({ ads });
    } catch (err: any) {
      console.error("Error in getAdsByType:", err);
      res.status(500).json({ message: "خطأ داخلي" });
    }
  },

  /* ======================================================
     DELETE AD
  ====================================================== */
  async deleteAd(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ message: "معرف الإعلان غير صالح" });
      }

      const ad = await prisma.ad.findUnique({ where: { id } });
      if (!ad) return res.status(404).json({ message: "غير موجود" });

      if (!user || user.role !== "ADMIN") {
        return res.status(403).json({ message: "للمدير فقط" });
      }

      // حذف الصور من Cloudinary إذا كانت موجودة
      const deletePromises = [];
      if (ad.imageUrl) deletePromises.push(deleteFromCloudinary(ad.imageUrl));
      if (ad.mobileImageUrl) deletePromises.push(deleteFromCloudinary(ad.mobileImageUrl));
      if (ad.tabletImageUrl) deletePromises.push(deleteFromCloudinary(ad.tabletImageUrl));

      await Promise.all(deletePromises);
      await prisma.ad.delete({ where: { id } });
      
      res.json({ message: "تم الحذف" });
    } catch (err: any) {
      console.error("Error in deleteAd:", err);
      res.status(500).json({ message: "خطأ داخلي" });
    }
  },

  /* ======================================================
   UPDATE AD (FULL UPDATE)
====================================================== */
  async updateAd(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const id = parseInt(req.params.id);
      const data = req.body as any;

      if (isNaN(id)) {
        return res.status(400).json({ message: "معرف الإعلان غير صالح" });
      }

      const ad = await prisma.ad.findUnique({ where: { id } });
      if (!ad) return res.status(404).json({ message: "الإعلان غير موجود" });

      // تحقق من الصلاحيات
      if (user?.role === "OWNER") {
        if (ad.targetType !== "BUSINESS" || !ad.targetId) {
          return res.status(403).json({ message: "غير مصرح" });
        }

        const business = await prisma.business.findUnique({
          where: { id: ad.targetId }
        });

        if (!business || business.ownerId !== user.id) {
          return res.status(403).json({ message: "غير مصرح" });
        }

        // المالك لا يمكنه تغيير بعض الحقول
        delete data.status;
        delete data.priority;
        delete data.isActive;
        delete data.targetType;
        delete data.targetId;
      }

      // معالجة التواريخ
      if (data.startAt) data.startAt = new Date(data.startAt);
      if (data.endAt) data.endAt = new Date(data.endAt);

      // التحقق من صحة التواريخ
      if (data.startAt && data.endAt && data.endAt <= data.startAt) {
        return res.status(400).json({
          message: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية"
        });
      }

      // معالجة الصور
      const updateData: any = { ...data };
      
      if (req.files) {
        const files = req.files as any;

        // معالجة كل صورة على حدة
        if (files.image?.[0]) {
          if (ad.imageUrl) {
            await deleteFromCloudinary(ad.imageUrl);
          }
          updateData.imageUrl = (await uploadToCloudinary(files.image[0])).secure_url;
        }

        if (files.mobileImage?.[0]) {
          if (ad.mobileImageUrl) {
            await deleteFromCloudinary(ad.mobileImageUrl);
          }
          updateData.mobileImageUrl = (await uploadToCloudinary(files.mobileImage[0])).secure_url;
        }

        if (files.tabletImage?.[0]) {
          if (ad.tabletImageUrl) {
            await deleteFromCloudinary(ad.tabletImageUrl);
          }
          updateData.tabletImageUrl = (await uploadToCloudinary(files.tabletImage[0])).secure_url;
        }
      }

      const updated = await prisma.ad.update({
        where: { id },
        data: updateData,
      });

      res.json({ message: "تم تحديث الإعلان بنجاح", ad: updated });
    } catch (err: any) {
      console.error("Error in updateAd:", err);
      res.status(500).json({ message: "خطأ داخلي", error: err.message });
    }
  },

  /* ======================================================
     PUBLIC ADS
  ====================================================== */
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
        take: 10,
      });

      // تحديث الـimpressions
      if (ads.length > 0) {
        await prisma.ad.updateMany({
          where: { id: { in: ads.map(a => a.id) } },
          data: { impressions: { increment: 1 } },
        });
      }

      res.json({ ads });
    } catch (err: any) {
      console.error("Error in getPublicAds:", err);
      res.status(500).json({ message: "خطأ داخلي" });
    }
  },
};

export default adController;