import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: string;
    [key: string]: any;
  };
}

/* ============================
   CREATE EVENT (OWNER ONLY)
============================ */
export const createEvent = async (req: Request, res: Response) => {
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
      description, 
      startDate, 
      endDate, 
      businessId,
      address, 
      city, 
      region, 
      lat, 
      lng, 
      price, 
      capacity, 
      isPublic
    } = req.body;

    // التحقق من البيانات المطلوبة
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ 
        ok: false,
        message: "اسم الحدث مطلوب (على الأقل حرفين)" 
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        ok: false,
        message: "تاريخ البداية والنهاية مطلوب" 
      });
    }

    if (!businessId) {
      return res.status(400).json({ 
        ok: false,
        message: "معرف العمل مطلوب" 
      });
    }

    // تحويل businessId إلى رقم
    const parsedBusinessId = parseInt(businessId);
    if (isNaN(parsedBusinessId)) {
      return res.status(400).json({ 
        ok: false,
        message: "معرف العمل غير صالح" 
      });
    }

    // Verify business ownership
    const business = await prisma.business.findFirst({
      where: { 
        id: parsedBusinessId, 
        ownerId: userId 
      }
    });

    if (!business) {
      return res.status(404).json({ 
        ok: false,
        message: "العمل غير موجود أو ليس لديك صلاحية للوصول إليه" 
      });
    }

    // تحويل التواريخ
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return res.status(400).json({ 
        ok: false,
        message: "تنسيق التاريخ غير صالح" 
      });
    }

    if (endDateObj <= startDateObj) {
      return res.status(400).json({ 
        ok: false,
        message: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" 
      });
    }

    // التحقق من البيانات الاختيارية
    const latNum = lat ? parseFloat(lat) : null;
    const lngNum = lng ? parseFloat(lng) : null;
    const priceNum = price ? parseFloat(price) : null;
    const capacityNum = capacity ? parseInt(capacity) : null;

    if (lat && isNaN(latNum!)) {
      return res.status(400).json({ 
        ok: false,
        message: "خط العرض غير صالح" 
      });
    }

    if (lng && isNaN(lngNum!)) {
      return res.status(400).json({ 
        ok: false,
        message: "خط الطول غير صالح" 
      });
    }

    if (price && isNaN(priceNum!)) {
      return res.status(400).json({ 
        ok: false,
        message: "السعر غير صالح" 
      });
    }

    if (capacity && isNaN(capacityNum!)) {
      return res.status(400).json({ 
        ok: false,
        message: "السعة غير صالحة" 
      });
    }

    const event = await prisma.event.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        startDate: startDateObj,
        endDate: endDateObj,
        businessId: parsedBusinessId,
        address: address?.trim() || null,
        city: city?.trim() || null,
        region: region?.trim() || null,
        lat: latNum,
        lng: lngNum,
        price: priceNum,
        capacity: capacityNum,
        isPublic: isPublic !== undefined ? Boolean(isPublic) : true,
      },
    });

    res.status(201).json({
      ok: true,
      message: "تم إنشاء الحدث بنجاح",
      data: event,
    });
  } catch (err: any) {
    console.error("Error in createEvent:", err);
    
    let errorMessage = "حدث خطأ أثناء إنشاء الحدث";
    if (err.code === "P2003") {
      errorMessage = "العمل المرتبط غير موجود";
    }
    
    res.status(500).json({ 
      ok: false,
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};

/* ============================
   GET BUSINESS EVENTS (OWNER ONLY)
============================ */
export const getBusinessEvents = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    
    if (!user) {
      return res.status(401).json({ 
        ok: false,
        message: "يجب تسجيل الدخول أولاً" 
      });
    }

    const userId = user.id;
    const businessId = parseInt(req.params.businessId);

    if (isNaN(businessId)) {
      return res.status(400).json({ 
        ok: false,
        message: "معرف العمل غير صالح" 
      });
    }

    // Verify business ownership
    const business = await prisma.business.findFirst({
      where: { 
        id: businessId, 
        ownerId: userId 
      }
    });

    if (!business) {
      return res.status(404).json({ 
        ok: false,
        message: "العمل غير موجود أو ليس لديك صلاحية للوصول إليه" 
      });
    }

    const events = await prisma.event.findMany({
      where: { businessId },
      include: {
        media: true,
        liveStream: true,
      },
      orderBy: { startDate: 'asc' }
    });

    res.json({
      ok: true,
      message: "تم جلب الأحداث بنجاح",
      data: events,
      count: events.length
    });
  } catch (err: any) {
    console.error("Error in getBusinessEvents:", err);
    res.status(500).json({ 
      ok: false,
      message: "حدث خطأ في جلب الأحداث",
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
};