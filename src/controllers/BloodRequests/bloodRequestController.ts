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

interface CreateBloodRequestData {
  bloodType: string;
  units?: number;
  urgency?: string;
  city: string;
  hospital: string;
  contactPhone: string;
  notes?: string;
  expiresAt?: string;
}

interface UpdateBloodRequestData {
  bloodType?: string;
  units?: number;
  urgency?: string;
  city?: string;
  hospital?: string;
  contactPhone?: string;
  notes?: string;
  expiresAt?: string;
  status?: string;
}

export const bloodRequestController = {
  /* ======================================================
     CREATE BLOOD REQUEST
  ====================================================== */
  async createRequest(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const data: CreateBloodRequestData = req.body;

      // التحقق من الحقول المطلوبة
      const requiredFields = ["bloodType", "city", "hospital", "contactPhone"];
      const missingFields = requiredFields.filter(field => !data[field as keyof CreateBloodRequestData]);
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `الحقول التالية مطلوبة: ${missingFields.join(", ")}`
        });
      }

      // تحقق من صحة فصيلة الدم
      const validBloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
      if (!validBloodTypes.includes(data.bloodType.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: "فصيلة الدم غير صالحة. يجب أن تكون: A+, A-, B+, B-, AB+, AB-, O+, O-"
        });
      }

      // تحقق من عدد الوحدات
      const units = data.units || 1;
      if (units < 1 || units > 10) {
        return res.status(400).json({
          success: false,
          message: "عدد الوحدات يجب أن يكون بين 1 و 10"
        });
      }

      // تحقق من درجة الإلحاح
      const validUrgency = ["low", "normal", "high", "critical"];
      const urgency = data.urgency || "normal";
      if (!validUrgency.includes(urgency)) {
        return res.status(400).json({
          success: false,
          message: "درجة الإلحاح غير صالحة"
        });
      }

      // إنشاء الطلب
      const bloodRequest = await prisma.bloodRequest.create({
        data: {
          bloodType: data.bloodType.toUpperCase(),
          units: units,
          urgency: urgency,
          city: data.city,
          hospital: data.hospital,
          contactPhone: data.contactPhone,
          notes: data.notes || null,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          requesterId: user?.id || null,
          status: "open"
        },
        include: {
          requester: {
            select: {
              id: true,
              username: true,
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        message: "تم إنشاء طلب التبرع بنجاح",
        data: bloodRequest
      });
    } catch (error: any) {
      console.error("Error creating blood request:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء إنشاء الطلب",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /* ======================================================
     GET ALL BLOOD REQUESTS (PUBLIC)
  ====================================================== */
  async getAllRequests(req: Request, res: Response) {
  try {
    const {
      page = "1",
      limit = "20",
      status = "open",
      bloodType,
      city,
      urgency,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      AND: [
        // فقط الطلبات غير المنتهية
        {
          OR: [
            { expiresAt: { gte: new Date() } },
            { expiresAt: null },
          ],
        },
      ],
    };

    // الفلاتر
    if (status) where.AND.push({ status });
    if (bloodType) where.AND.push({ bloodType });
    if (urgency) where.AND.push({ urgency });
    if (city) {
      where.AND.push({
        city: { contains: city as string, mode: "insensitive" },
      });
    }

    // البحث
    if (search) {
      where.AND.push({
        OR: [
          { hospital: { contains: search as string, mode: "insensitive" } },
          { city: { contains: search as string, mode: "insensitive" } },
          { notes: { contains: search as string, mode: "insensitive" } },
        ],
      });
    }

    const [requests, total] = await prisma.$transaction([
      prisma.bloodRequest.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: {
          [sortBy as string]: sortOrder === "asc" ? "asc" : "desc",
        },
        include: {
          requester: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      }),
      prisma.bloodRequest.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum),
          limit: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Error getting blood requests:", error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء جلب الطلبات",
    });
  }
}
,

  /* ======================================================
     GET SINGLE BLOOD REQUEST
  ====================================================== */
  async getRequestById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "معرف الطلب غير صالح"
        });
      }

      const request = await prisma.bloodRequest.findUnique({
        where: { id: Number(req.params.id) },
      });


      if (!request) {
        return res.status(404).json({
          success: false,
          message: "طلب التبرع غير موجود"
        });
      }

      res.json({
        success: true,
        data: request
      });
    } catch (error: any) {
      console.error("Error getting blood request:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء جلب الطلب"
      });
    }
  },

  /* ======================================================
     UPDATE BLOOD REQUEST
  ====================================================== */
  async updateRequest(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const id = parseInt(req.params.id);
      const data: UpdateBloodRequestData = req.body;

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "معرف الطلب غير صالح"
        });
      }

      // البحث عن الطلب
      const request = await prisma.bloodRequest.findUnique({
        where: { id }
      });

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "طلب التبرع غير موجود"
        });
      }

      // التحقق من الصلاحيات (المستخدم أو الأدمن فقط)
      if (user?.role !== "ADMIN" && request.requesterId !== user?.id) {
        return res.status(403).json({
          success: false,
          message: "غير مصرح لك بتعديل هذا الطلب"
        });
      }

      // تحقق من فصيلة الدم إذا تم تحديثها
      if (data.bloodType) {
        const validBloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
        if (!validBloodTypes.includes(data.bloodType.toUpperCase())) {
          return res.status(400).json({
            success: false,
            message: "فصيلة الدم غير صالحة"
          });
        }
        data.bloodType = data.bloodType.toUpperCase();
      }

      // تحقق من عدد الوحدات
      if (data.units && (data.units < 1 || data.units > 10)) {
        return res.status(400).json({
          success: false,
          message: "عدد الوحدات يجب أن يكون بين 1 و 10"
        });
      }

      // معالجة التواريخ
      if (data.expiresAt) {
        data.expiresAt = new Date(data.expiresAt).toISOString();
      }

      // المستخدم العادي لا يمكنه تغيير الحالة
      if (user?.role !== "ADMIN" && data.status) {
        delete data.status;
      }

      const updatedRequest = await prisma.bloodRequest.update({
        where: { id },
        data: {
          ...data,
          ...(data.expiresAt && { expiresAt: new Date(data.expiresAt) })
        },
        include: {
          requester: {
            select: {
              id: true,
              name: true,
              profilePicture: true
            }
          }
        }
      });

      res.json({
        success: true,
        message: "تم تحديث طلب التبرع بنجاح",
        data: updatedRequest
      });
    } catch (error: any) {
      console.error("Error updating blood request:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء تحديث الطلب"
      });
    }
  },

  /* ======================================================
     DELETE BLOOD REQUEST
  ====================================================== */
  async deleteRequest(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "معرف الطلب غير صالح"
        });
      }

      const request = await prisma.bloodRequest.findUnique({
        where: { id }
      });

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "طلب التبرع غير موجود"
        });
      }

      // التحقق من الصلاحيات (المستخدم أو الأدمن فقط)
      if (user?.role !== "ADMIN" && request.requesterId !== user?.id) {
        return res.status(403).json({
          success: false,
          message: "غير مصرح لك بحذف هذا الطلب"
        });
      }

      await prisma.bloodRequest.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: "تم حذف طلب التبرع بنجاح"
      });
    } catch (error: any) {
      console.error("Error deleting blood request:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء حذف الطلب"
      });
    }
  },

  /* ======================================================
     UPDATE REQUEST STATUS (ADMIN ONLY)
  ====================================================== */
 async updateStatus(req: Request, res: Response) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const id = parseInt(req.params.id);
    const { status } = req.body;

    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "غير مصرح - للأدمن فقط" });
    }

    if (isNaN(id)) return res.status(400).json({ success: false, message: "معرف الطلب غير صالح" });

    const validStatuses = ["open", "fulfilled", "cancelled", "expired"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "حالة غير صالحة" });
    }

    const request = await prisma.bloodRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ success: false, message: "طلب التبرع غير موجود" });

    const updatedRequest = await prisma.bloodRequest.update({
      where: { id },
      data: { status },
      select: { id: true, status: true } // فقط الحقول المهمة
    });

    return res.json({ success: true, message: `تم تحديث الحالة إلى "${status}"`, data: updatedRequest });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, message: "حدث خطأ أثناء تحديث الحالة" });
  }
},


  /* ======================================================
     GET MY BLOOD REQUESTS (FOR LOGGED IN USER)
  ====================================================== */
  async getMyRequests(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { 
        page = "1", 
        limit = "20", 
        status 
      } = req.query;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "يجب تسجيل الدخول"
        });
      }

      const where: any = { requesterId: user.id };
      if (status) where.status = status;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const [requests, total] = await prisma.$transaction([
        prisma.bloodRequest.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { createdAt: "desc" }
        }),
        prisma.bloodRequest.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          requests,
          pagination: {
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (error: any) {
      console.error("Error getting user blood requests:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء جلب طلباتك"
      });
    }
  },

  /* ======================================================
     GET STATISTICS
  ====================================================== */
  async getStatistics(req: Request, res: Response) {
    try {
      const [
        totalRequests,
        openRequests,
        fulfilledRequests,
        requestsByBloodType,
        requestsByCity,
        urgentRequests
      ] = await prisma.$transaction([
        prisma.bloodRequest.count(),
        prisma.bloodRequest.count({ where: { status: "open" } }),
        prisma.bloodRequest.count({ where: { status: "fulfilled" } }),
        prisma.bloodRequest.groupBy({
          by: ["bloodType"],
          _count: { id: true },
          where: { status: "open" }
        }),
        prisma.bloodRequest.groupBy({
          by: ["city"],
          _count: { id: true },
          where: { status: "open" }
        }),
        prisma.bloodRequest.count({ 
          where: { 
            status: "open",
            urgency: "critical" 
          } 
        })
      ]);

      res.json({
        success: true,
        data: {
          totalRequests,
          openRequests,
          fulfilledRequests,
          requestsByBloodType,
          requestsByCity,
          urgentRequests,
          fulfillmentRate: totalRequests > 0 ? 
            Math.round((fulfilledRequests / totalRequests) * 100) : 0
        }
      });
    } catch (error: any) {
      console.error("Error getting statistics:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء جلب الإحصائيات"
      });
    }
  },

  /* ======================================================
     SEARCH BLOOD REQUESTS
  ====================================================== */
  async searchRequests(req: Request, res: Response) {
    try {
      const { 
        bloodType, 
        city, 
        hospital, 
        limit = "10" 
      } = req.query;

      const where: any = { status: "open" };

      if (bloodType) where.bloodType = bloodType;
      if (city) where.city = { contains: city as string, mode: "insensitive" as const };
      if (hospital) where.hospital = { contains: hospital as string, mode: "insensitive" as const };

      // فقط الطلبات غير المنتهية
      where.OR = [
        { expiresAt: { gte: new Date() } },
        { expiresAt: null }
      ];

      const requests = await prisma.bloodRequest.findMany({
        where,
        take: parseInt(limit as string),
        orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          bloodType: true,
          units: true,
          urgency: true,
          city: true,
          hospital: true,
          contactPhone: true,
          createdAt: true,
          expiresAt: true
        }
      });

      res.json({
        success: true,
        data: requests
      });
    } catch (error: any) {
      console.error("Error searching blood requests:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء البحث"
      });
    }
  },
  async matchDonors(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { radius = 50 } = req.query; // نصف البحث بالكيلومتر

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: "معرف الطلب غير صالح"
        });
      }

      // الحصول على طلب الدم
      const bloodRequest = await prisma.bloodRequest.findUnique({
        where: { id }
      });

      if (!bloodRequest) {
        return res.status(404).json({
          success: false,
          message: "طلب التبرع غير موجود"
        });
      }

      // البحث عن متبرعين متطابقين
      const matchedDonors = await prisma.bloodDonor.findMany({
        where: {
          bloodType: bloodRequest.bloodType,
          city: bloodRequest.city || undefined, // إذا كانت المدينة موجودة
          canDonate: true,
          receiveAlerts: true,
          // يمكن إضافة المزيد من شروط المطابقة هنا
          // مثل: lastDonation (أن يكون قد مر وقت كافٍ منذ آخر تبرع)
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
              email: true,
              phone: true
            }
          }
        },
        take: 20 // الحد الأقصى للمتبرعين المعروضين
      });

      // إحصاءات
      const stats = {
        totalMatched: matchedDonors.length,
        byCity: matchedDonors.reduce((acc, donor) => {
          acc[donor.city] = (acc[donor.city] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };

      res.json({
        success: true,
        data: {
          request: bloodRequest,
          donors: matchedDonors,
          stats
        }
      });
    } catch (error: any) {
      console.error("Error matching donors:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء البحث عن متبرعين"
      });
    }
  },
};

export default bloodRequestController;