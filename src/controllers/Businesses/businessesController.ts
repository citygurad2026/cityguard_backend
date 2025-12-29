import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { deleteFromCloudinary, uploadToCloudinary } from "../../utils/uploadToCloudinary";
declare global {
  namespace Express {
    interface Request {
      files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
    }
  }
}
const prisma = new PrismaClient();

// Interface للمستخدم المصادق عليه
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: string;
    [key: string]: any;
  };
}

/* ============================
   CREATE BUSINESS (OWNER ONLY)
============================ */
export const createBusiness = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    
    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "يجب تسجيل الدخول أولاً"
      });
    }

    const userId = user.id;
    const {
      name,
      categoryId,
      description,
      tags,
      address,
      city,
      region,
      phone,
      mobile,
      website,
      openingHours,
    } = req.body;

    // 1. التحقق: هل المستخدم لديه عمل بالفعل؟
    const existingBusiness = await prisma.business.findFirst({
      where: { ownerId: userId }
    });

    if (existingBusiness) {
      return res.status(400).json({
        ok: false,
        message: "لديك عمل مسجل بالفعل. يمكنك تعديله من لوحة التحكم.",
        existingBusinessId: existingBusiness.id
      });
    }

    // 2. التحقق من البيانات المطلوبة
    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        ok: false,
        message: "اسم العمل مطلوب (على الأقل حرفين)",
      });
    }

    // 3. توليد slug
    const generateSlug = (text: string) =>
      text
        .toString()
        .normalize("NFKD")
        .replace(/[^\w\s-\u0600-\u06FF]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .toLowerCase();

    let slug = generateSlug(name);

    // تحقق من أن slug فريد
    const slugExists = await prisma.business.findUnique({ where: { slug } });
    if (slugExists) {
      const timestamp = Date.now().toString().slice(-6);
      slug = `${slug}-${timestamp}`;
    }

    // تحويل categoryId إلى رقم
    const parsedCategoryId = categoryId ? parseInt(categoryId) : null;
    if (parsedCategoryId && isNaN(parsedCategoryId)) {
      return res.status(400).json({
        ok: false,
        message: "معرف التصنيف غير صالح"
      });
    }

    // تحويل openingHours من JSON string إلى object
    let parsedOpeningHours = {};
    if (openingHours) {
      try {
        parsedOpeningHours = typeof openingHours === "string" 
          ? JSON.parse(openingHours) 
          : openingHours;
      } catch (error) {
        console.warn("خطأ في تحليل openingHours، سيتم استخدام object فارغ");
      }
    }

    // 4. إنشاء العمل
    const business = await prisma.business.create({
      data: {
        ownerId: userId,
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        categoryId: parsedCategoryId,
        tags: tags?.trim() || "",
        address: address?.trim() || null,
        city: city?.trim() || null,
        region: region?.trim() || null,
        phone: phone?.trim() || null,
        mobile: mobile?.trim() || null,
        website: website?.trim() || null,
        openingHours: parsedOpeningHours,
        status: "PENDING",
      },
    });

    // 5. التعامل مع الصور
    const files = req.files as Express.Multer.File[] | undefined;
    if (files && files.length > 0) {
      const mediaPromises = files.map(async (file, index) => {
        try {
          // رفع الصورة إلى Cloudinary
          const uploadResult = await uploadToCloudinary(file);
          
          return {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            type: file.mimetype.startsWith("image") ? "IMAGE" : 
                  file.mimetype.startsWith("video") ? "VIDEO" : "DOCUMENT",
            altText: `${name} - صورة ${index + 1}`,
            title: `${name} - ${index + 1}`,
            order: index,
            businessId: business.id,
            description: null,
          };
        } catch (uploadError) {
          console.error(`خطأ في رفع الصورة ${index + 1}:`, uploadError);
          return null;
        }
      });

      const mediaData = (await Promise.all(mediaPromises)).filter(Boolean);
      
      if (mediaData.length > 0) {
        await prisma.media.createMany({ 
          data: mediaData as any[], 
          skipDuplicates: true 
        });
      }
    }

    res.status(201).json({
      ok: true,
      message: "تم إنشاء العمل بنجاح وجاري مراجعته",
      data: business,
    });
  } catch (error: any) {
    console.error("خطأ في createBusiness:", error);

    let errorMessage = "حدث خطأ أثناء إنشاء العمل";
    if (error.code === "P2002") errorMessage = "اسم العمل مستخدم بالفعل";
    else if (error.code === "P2003") errorMessage = "المستخدم أو التصنيف غير موجود";
    else if (error.code === "P2025") errorMessage = "البيانات المرجعية غير موجودة";

    res.status(500).json({ 
      ok: false, 
      message: errorMessage,
      ...(process.env.NODE_ENV === "development" && { error: error.message })
    });
  }
};

/* ============================
   GET OWNER BUSINESSES
============================ */
export const getOwnerBusinesses = async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  
  if (!user) {
    return res.status(401).json({
      ok: false,
      message: "يجب تسجيل الدخول أولاً"
    });
  }

  const userId = user.id;

  try {
    const business = await prisma.business.findFirst({
      where: { ownerId: userId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        media: {
          orderBy: { order: 'asc' }
        },
        reviews: {
          include: {
            user: {
              select: { 
                id: true,
                name: true, 
                avatarUrl: true 
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: {
          select: {
            reviews: true,
            favorites: true,
            follows: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      ok: true,
      message: business ? "تم جلب العمل بنجاح" : "ليس لديك عمل مسجل",
      data: business
    });
  } catch (err: any) {
    console.error("Error in getOwnerBusinesses:", err);
    res.status(500).json({ 
      ok: false,
      message: "حدث خطأ في جلب البيانات",
      ...(process.env.NODE_ENV === "development" && { error: err.message })
    });
  }
};

/* ============================
   GET BUSINESS BY ID
============================ */
export const getBusinessById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as AuthenticatedRequest).user;
  
  if (!user) {
    return res.status(401).json({
      ok: false,
      message: "يجب تسجيل الدخول أولاً"
    });
  }

  const userId = user.id;
  const businessId = parseInt(id);

  if (isNaN(businessId)) {
    return res.status(400).json({
      ok: false,
      message: "معرف العمل غير صالح"
    });
  }

  try {
    const business = await prisma.business.findFirst({
      where: { 
        id: businessId,
        ownerId: userId
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        media: {
          orderBy: { order: 'asc' }
        },
        reviews: {
          include: {
            user: {
              select: { 
                id: true,
                name: true, 
                avatarUrl: true 
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!business) {
      return res.status(404).json({
        ok: false,
        message: "العمل غير موجود أو ليس لديك صلاحية للوصول إليه"
      });
    }

    res.json({
      ok: true,
      data: business
    });
  } catch (err: any) {
    console.error("Error in getBusinessById:", err);
    res.status(500).json({ 
      ok: false,
      message: "حدث خطأ في جلب البيانات",
      ...(process.env.NODE_ENV === "development" && { error: err.message })
    });
  }
};

/* ============================
   UPDATE BUSINESS (OWNER ONLY)
============================ */
export const updateBusiness = async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  
  if (!user) {
    return res.status(401).json({
      ok: false,
      message: "يجب تسجيل الدخول أولاً"
    });
  }

  const userId = user.id;
  const businessId = parseInt(req.params.id);
  const updateData = req.body;

  if (isNaN(businessId)) {
    return res.status(400).json({
      ok: false,
      message: "معرف العمل غير صالح"
    });
  }

  try {
    // التحقق من ملكية العمل
    const existingBusiness = await prisma.business.findFirst({
      where: { id: businessId, ownerId: userId },
      include: { media: true }
    });

    if (!existingBusiness) {
      return res.status(404).json({ 
        ok: false,
        message: "العمل غير موجود أو ليس لديك صلاحية التعديل" 
      });
    }

    const updatedFields: any = {};

    // تحديث الاسم و slug إذا تم تغييره
    if (updateData.name && updateData.name !== existingBusiness.name) {
      updatedFields.name = updateData.name.trim();
      
      // توليد slug جديد
      const generateSlug = (text: string) =>
        text
          .toLowerCase()
          .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
          .replace(/(^-|-$)+/g, '');
      
      let newSlug = generateSlug(updateData.name);
      
      // التحقق من أن slug فريد
      const slugExists = await prisma.business.findFirst({
        where: { 
          slug: newSlug,
          id: { not: businessId }
        }
      });
      
      if (slugExists) {
        newSlug = `${newSlug}-${Date.now().toString().slice(-6)}`;
      }
      
      updatedFields.slug = newSlug;
    }

    // تحديث الحقول الأخرى
    if (updateData.description !== undefined) {
      updatedFields.description = updateData.description?.trim() || null;
    }
    if (updateData.phone !== undefined) {
      updatedFields.phone = updateData.phone?.trim() || null;
    }
    if (updateData.address !== undefined) {
      updatedFields.address = updateData.address?.trim() || null;
    }
    if (updateData.city !== undefined) {
      updatedFields.city = updateData.city?.trim() || null;
    }
    if (updateData.website !== undefined) {
      updatedFields.website = updateData.website?.trim() || null;
    }
    if (updateData.openingHours !== undefined) {
      try {
        updatedFields.openingHours = typeof updateData.openingHours === "string" 
          ? JSON.parse(updateData.openingHours) 
          : updateData.openingHours;
      } catch (error) {
        return res.status(400).json({
          ok: false,
          message: "تنسيق أوقات العمل غير صالح"
        });
      }
    }
    if (updateData.categoryId !== undefined) {
      const categoryId = parseInt(updateData.categoryId);
      updatedFields.categoryId = isNaN(categoryId) ? null : categoryId;
    }

    // معالجة الصور المراد حذفها
    let removedImages: any = updateData.removeImages;
    
    if (removedImages) {
      if (!Array.isArray(removedImages)) {
        removedImages = [removedImages];
      }
      
      const imageIds = removedImages.map((id: string |number) => parseInt(id as string)).filter((id: number) => !isNaN(id));
      
      if (imageIds.length > 0) {
        // جلب معلومات الصور لحذفها من Cloudinary
        const mediasToDelete = await prisma.media.findMany({
          where: {
            id: { in: imageIds },
            businessId
          }
        });

        // حذف من Cloudinary
        const deletePromises = mediasToDelete
          .filter(media => media.publicId)
          .map(media => deleteFromCloudinary(media.publicId!));
        
        await Promise.allSettled(deletePromises);

        // حذف من قاعدة البيانات
        await prisma.media.deleteMany({
          where: {
            id: { in: imageIds },
            businessId
          }
        });
      }
    }

    // رفع الصور الجديدة
    const newImages: any[] = [];
    let files: Express.Multer.File[] = [];

    if (Array.isArray(req.files)) {
      files = req.files as Express.Multer.File[];
    } else if (req.files && (req.files as any).images) {
      files = (req.files as any).images;
    }

    if (files && files.length > 0) {
      // إيجاد أعلى order حالي
      const lastMedia = await prisma.media.findFirst({
        where: { businessId },
        orderBy: { order: 'desc' },
        select: { order: true }
      });
      
      let startOrder = lastMedia ? lastMedia.order + 1 : 0;

      // رفع كل صورة
      for (const file of files) {
        try {
          const result = await uploadToCloudinary(file);
          newImages.push({
            url: result.secure_url,
            publicId: result.public_id,
            type: file.mimetype.startsWith("image") ? "IMAGE" : 
                  file.mimetype.startsWith("video") ? "VIDEO" : "DOCUMENT",
            altText: `${updateData.name || existingBusiness.name} - صورة`,
            title: file.originalname,
            order: startOrder++,
            businessId,
            description: null,
          });
        } catch (uploadError) {
          console.error("خطأ في رفع الصورة:", uploadError);
        }
      }
    }

    // تحديث العمل
    const business = await prisma.business.update({
      where: { id: businessId },
      data: updatedFields,
      include: { 
        media: {
          orderBy: { order: 'asc' }
        } 
      }
    });

    // إضافة الصور الجديدة
    if (newImages.length > 0) {
      await prisma.media.createMany({
        data: newImages
      });
    }

    // جلب العمل مع جميع البيانات المحدثة
    const updatedBusiness = await prisma.business.findUnique({
      where: { id: businessId },
      include: { 
        media: {
          orderBy: { order: 'asc' }
        },
        category: true
      }
    });

    res.json({ 
      ok: true,
      message: "تم تحديث العمل بنجاح", 
      data: updatedBusiness 
    });
  } catch (err: any) {
    console.error("Error in updateBusiness:", err);
    
    if (err.code === 'P2002') {
      return res.status(409).json({ 
        ok: false,
        message: "رابط العمل (slug) مستخدم بالفعل" 
      });
    }
    
    res.status(400).json({ 
      ok: false,
      message: "حدث خطأ أثناء التحديث",
      ...(process.env.NODE_ENV === "development" && { error: err.message })
    });
  }
};

/* ============================
   GET BUSINESS STATS (OWNER ONLY)
============================ */
export const getBusinessStats = async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  
  if (!user) {
    return res.status(401).json({
      ok: false,
      message: "يجب تسجيل الدخول أولاً"
    });
  }

  const userId = user.id;
  const businessId = parseInt(req.params.id);

  if (isNaN(businessId)) {
    return res.status(400).json({
      ok: false,
      message: "معرف العمل غير صالح"
    });
  }

  try {
    // التحقق من ملكية العمل
    const business = await prisma.business.findFirst({
      where: { id: businessId, ownerId: userId }
    });

    if (!business) {
      return res.status(404).json({ 
        ok: false,
        message: "العمل غير موجود أو ليس لديك صلاحية الوصول" 
      });
    }

    const [stats, reviews, favoritesCount, followsCount] = await Promise.all([
      // الإحصائيات
      prisma.businessStats.findMany({
        where: { businessId },
        orderBy: { date: 'desc' },
        take: 30
      }),
      
      // التقييمات
      prisma.review.findMany({
        where: { businessId },
        include: {
          user: {
            select: { 
              id: true,
              name: true, 
              avatarUrl: true 
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      
      // عدد المفضلات
      prisma.favorite.count({
        where: { businessId }
      }),
      
      // عدد المتابعين
      prisma.follow.count({
        where: { businessId }
      })
    ]);

    // حساب متوسط التقييم
    const averageRating = reviews.length > 0 
      ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length 
      : 0;

    res.json({
      ok: true,
      message: "تم جلب الإحصائيات بنجاح",
      data: {
        business,
        stats,
        reviews,
        favoritesCount,
        followsCount,
        totalReviews: reviews.length,
        averageRating: parseFloat(averageRating.toFixed(1))
      }
    });

  } catch (err: any) {
    console.error("Error in getBusinessStats:", err);
    res.status(500).json({ 
      ok: false,
      message: "حدث خطأ في جلب الإحصائيات",
      ...(process.env.NODE_ENV === "development" && { error: err.message })
    });
  }
};

/* ============================
   DELETE BUSINESS
============================ */
export const deleteBusiness = async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  
  if (!user) {
    return res.status(401).json({
      ok: false,
      message: "يجب تسجيل الدخول أولاً"
    });
  }

  const userId = user.id;
  const businessId = parseInt(req.params.id);

  if (isNaN(businessId)) {
    return res.status(400).json({
      ok: false,
      message: "معرف العمل غير صالح"
    });
  }

  try {
    // التحقق من ملكية العمل
    const business = await prisma.business.findFirst({
      where: { 
        id: businessId, 
        ownerId: userId 
      },
      include: { media: true }
    });

    if (!business) {
      return res.status(404).json({
        ok: false,
        message: "العمل غير موجود أو ليس لديك صلاحية الحذف"
      });
    }

    // حذف الصور من Cloudinary أولاً
    const mediaWithPublicIds = business.media.filter(media => media.publicId);
    if (mediaWithPublicIds.length > 0) {
      const deletePromises = mediaWithPublicIds.map(media => 
        deleteFromCloudinary(media.publicId!)
      );
      await Promise.allSettled(deletePromises);
    }

    const result = await prisma.$transaction(async (tx) => {
      // حذف جميع البيانات المرتبطة
      await tx.media.deleteMany({ where: { businessId } });
      await tx.event.deleteMany({ where: { businessId } });
      await tx.review.deleteMany({ where: { businessId } });
      await tx.favorite.deleteMany({ where: { businessId } });
      await tx.ad.deleteMany({ where: { targetId: businessId } });
      await tx.businessStats.deleteMany({ where: { businessId } });
      await tx.bookmark.deleteMany({ where: { businessId } });
      await tx.follow.deleteMany({ where: { businessId } });
      await tx.job.deleteMany({ where: { businessId } });

      // حذف العمل نفسه
      const deletedBusiness = await tx.business.delete({
        where: { id: businessId }
      });

      return deletedBusiness;
    });

    res.status(200).json({
      ok: true,
      message: "تم حذف العمل بنجاح",
      data: { 
        id: result.id, 
        name: result.name,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error("خطأ في deleteBusiness:", error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        ok: false,
        message: "العمل غير موجود"
      });
    }
    
    res.status(500).json({
      ok: false,
      message: "حدث خطأ أثناء حذف العمل",
      ...(process.env.NODE_ENV === "development" && { error: error.message })
    });
  }
};

/* ============================
   CHECK IF USER HAS BUSINESS
============================ */
export const checkUserBusiness = async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  
  if (!user) {
    return res.status(401).json({
      ok: false,
      message: "يجب تسجيل الدخول أولاً"
    });
  }

  const userId = user.id;

  try {
    const business = await prisma.business.findFirst({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true
      }
    });

    res.json({
      ok: true,
      hasBusiness: !!business,
      data: business
    });
  } catch (err: any) {
    console.error("Error in checkUserBusiness:", err);
    res.status(500).json({ 
      ok: false,
      message: "حدث خطأ في التحقق",
      ...(process.env.NODE_ENV === "development" && { error: err.message })
    });
  }
};

// التصدير ككائن واحد
export const businessController = {
  createBusiness,
  getOwnerBusinesses,
  getBusinessById,
  updateBusiness,
  getBusinessStats,
  deleteBusiness,
  checkUserBusiness
};

export default businessController;