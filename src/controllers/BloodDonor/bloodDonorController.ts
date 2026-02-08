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

interface RegisterDonorData {
  bloodType: string;
  city: string;
  phone?: string;
  notes?: string;
  isAvailable?: boolean;
  receiveAlerts?: boolean;
  maxDistance?: number;
}

export const bloodDonorController = {
  /* ======================================================
     REGISTER AS BLOOD DONOR
  ====================================================== */
  async registerDonor(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const data: RegisterDonorData = req.body;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "يجب تسجيل الدخول"
        });
      }

      // التحقق من الحقول المطلوبة
      if (!data.bloodType || !data.city) {
        return res.status(400).json({
          success: false,
          message: "فصيلة الدم والمدينة مطلوبان"
        });
      }
      if (!data.phone) {
  return res.status(400).json({
    success: false,
    message: "رقم الهاتف مطلوب"
  });
}


      // تحقق من صحة فصيلة الدم
      const validBloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
      if (!validBloodTypes.includes(data.bloodType.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: "فصيلة الدم غير صالحة"
        });
      }

      // تحقق إذا كان المستخدم مسجلًا مسبقًا
      const existingDonor = await prisma.bloodDonor.findUnique({
        where: { userId: user.id }
      });

      if (existingDonor) {
        // تحديث بيانات المتبرع الحالي
        const updatedDonor = await prisma.bloodDonor.update({
          where: { userId: user.id },
          data: {
            bloodType: data.bloodType.toUpperCase(),
            city: data.city,
            phone: data.phone || existingDonor.phone,
            notes: data.notes || existingDonor.notes,
            isAvailable: data.isAvailable !== undefined ? data.isAvailable : existingDonor.isAvailable,
            receiveAlerts: data.receiveAlerts !== undefined ? data.receiveAlerts : existingDonor.receiveAlerts,
          maxDistance:
  data.maxDistance !== undefined
    ? data.maxDistance
    : existingDonor.maxDistance

          }
        });

        return res.json({
          success: true,
          message: "تم تحديث بيانات المتبرع بنجاح",
          data: updatedDonor
        });
      }

      // تسجيل متبرع جديد
      const donor = await prisma.bloodDonor.create({
        data: {
          userId: user.id,
          bloodType: data.bloodType.toUpperCase(),
          city: data.city,
          phone: data.phone || user.phone || null,
          notes: data.notes || null,
          isAvailable: data.isAvailable !== undefined ? data.isAvailable : true,
          receiveAlerts: data.receiveAlerts !== undefined ? data.receiveAlerts : true,
          maxDistance: data.maxDistance || 50
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        message: "تم تسجيلك كمتبرع بالدم بنجاح",
        data: donor
      });
    } catch (error: any) {
      console.error("Error registering donor:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء التسجيل كمتبرع"
      });
    }
  },

  /* ======================================================
     GET DONOR PROFILE
  ====================================================== */
  async getDonorProfile(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "يجب تسجيل الدخول"
        });
      }

      const donor = await prisma.bloodDonor.findUnique({
        where: { userId: user.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              createdAt: true
            }
          }
        }
      });

      if (!donor) {
        return res.status(404).json({
          success: false,
          message: "لم يتم العثور على بيانات المتبرع"
        });
      }

      res.json({
        success: true,
        data: donor
      });
    } catch (error: any) {
      console.error("Error getting donor profile:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء جلب بيانات المتبرع"
      });
    }
  },

  /* ======================================================
     UPDATE DONOR STATUS
  ====================================================== */
  async updateDonorStatus(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { isAvailable, receiveAlerts, maxDistance } = req.body;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "يجب تسجيل الدخول"
        });
      }

      const donor = await prisma.bloodDonor.findUnique({
        where: { userId: user.id }
      });

      if (!donor) {
        return res.status(404).json({
          success: false,
          message: "لم يتم العثور على بيانات المتبرع"
        });
      }

      const updateData: any = {};
      if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
      if (receiveAlerts !== undefined) updateData.receiveAlerts = receiveAlerts;
      if (maxDistance !== undefined) updateData.maxDistance = maxDistance;

      const updatedDonor = await prisma.bloodDonor.update({
        where: { userId: user.id },
        data: updateData
      });

      res.json({
        success: true,
        message: "تم تحديث حالة المتبرع بنجاح",
        data: updatedDonor
      });
    } catch (error: any) {
      console.error("Error updating donor status:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء تحديث حالة المتبرع"
      });
    }
  },

  /* ======================================================
     UPDATE LAST DONATION DATE
  ====================================================== */
  async updateLastDonation(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { lastDonation, canDonateAfter } = req.body;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "يجب تسجيل الدخول"
        });
      }

      const donor = await prisma.bloodDonor.findUnique({
        where: { userId: user.id }
      });

      if (!donor) {
        return res.status(404).json({
          success: false,
          message: "لم يتم العثور على بيانات المتبرع"
        });
      }

      const updateData: any = {};
      if (lastDonation !== undefined) {
        updateData.lastDonation = new Date(lastDonation);
      }
      if (canDonateAfter !== undefined) {
        updateData.canDonateAfter = new Date(canDonateAfter);
      }

      const updatedDonor = await prisma.bloodDonor.update({
        where: { userId: user.id },
        data: updateData
      });

      res.json({
        success: true,
        message: "تم تحديث تاريخ آخر تبرع بنجاح",
        data: updatedDonor
      });
    } catch (error: any) {
      console.error("Error updating last donation:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء تحديث تاريخ التبرع"
      });
    }
  },

  /* ======================================================
     GET ALL DONORS (ADMIN ONLY)
  ====================================================== */
  async getAllDonors(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const {
        page = "1",
        limit = "20",
        bloodType,
        city,
        isAvailable
      } = req.query;

      // للأدمن فقط
      if (!user || user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "غير مصرح - للأدمن فقط"
        });
      }

      const where: any = {};
      if (bloodType) where.bloodType = bloodType;
      if (city) where.city = { contains: city as string, mode: "insensitive" as const };
      if (isAvailable !== undefined) where.isAvailable = isAvailable === "true";

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const [donors, total] = await prisma.$transaction([
        prisma.bloodDonor.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profilePicture: true,
                phone: true
              }
            }
          }
        }),
        prisma.bloodDonor.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          donors,
          pagination: {
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum)
          }
        }
      });
    } catch (error: any) {
      console.error("Error getting all donors:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء جلب المتبرعين"
      });
    }
  },

  /* ======================================================
     SEARCH DONORS
  ====================================================== */
  async searchDonors(req: Request, res: Response) {
    try {
      const { 
        bloodType, 
        city, 
        limit = "20" 
      } = req.query;

      const where: any = { isAvailable: true };

      if (bloodType) where.bloodType = bloodType;
      if (city) where.city = { contains: city as string, mode: "insensitive" as const };

      const donors = await prisma.bloodDonor.findMany({
        where,
        take: parseInt(limit as string),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          bloodType: true,
          city: true,
          lastDonation: true,
          isAvailable: true,
          user: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      });

      res.json({
        success: true,
        data: donors
      });
    } catch (error: any) {
      console.error("Error searching donors:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء البحث عن متبرعين"
      });
    }
  },

  /* ======================================================
     GET DONOR STATISTICS
  ====================================================== */
  async getDonorStatistics(req: Request, res: Response) {
    try {
      const [
        totalDonors,
        activeDonors,
        donorsByBloodType,
        donorsByCity,
        recentDonors
      ] = await prisma.$transaction([
        prisma.bloodDonor.count(),
        prisma.bloodDonor.count({ where: { isAvailable: true } }),
        prisma.bloodDonor.groupBy({
          by: ["bloodType"],
          _count: { id: true },
          where: { isAvailable: true }
        }),
        prisma.bloodDonor.groupBy({
          by: ["city"],
          _count: { id: true },
          where: { isAvailable: true }
        }),
        prisma.bloodDonor.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // آخر 30 يوم
            }
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          totalDonors,
          activeDonors,
          donorsByBloodType,
          donorsByCity,
          recentDonors,
          activationRate: totalDonors > 0 ? 
            Math.round((activeDonors / totalDonors) * 100) : 0
        }
      });
    } catch (error: any) {
      console.error("Error getting donor statistics:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء جلب إحصائيات المتبرعين"
      });
    }
  },

  /* ======================================================
     GET MATCHING DONORS FOR REQUEST
  ====================================================== */
  async getMatchingDonors(req: Request, res: Response) {
    try {
      const requestId = parseInt(req.params.requestId);
      
      if (isNaN(requestId)) {
        return res.status(400).json({
          success: false,
          message: "معرف الطلب غير صالح"
        });
      }

      // جلب بيانات الطلب
      const bloodRequest = await prisma.bloodRequest.findUnique({
        where: { id: requestId }
      });

      if (!bloodRequest) {
        return res.status(404).json({
          success: false,
          message: "طلب التبرع غير موجود"
        });
      }

      // البحث عن متبرعين متطابقين
      const matchingDonors = await prisma.bloodDonor.findMany({
        where: {
          isAvailable: true,
          bloodType: bloodRequest.bloodType,
          city: { contains: bloodRequest.city || "", mode: "insensitive" as const },
          // تحقق من تاريخ آخر تبرع
          OR: [
            { lastDonation: null },
            { lastDonation: { lte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } }, // 90 يوم كحد أدنى
            { canDonateAfter: { lte: new Date() } }
          ]
        },
        take: 10,
        orderBy: { lastDonation: "asc" }, // الأقدم في التبرع أولاً
        select: {
          id: true,
          bloodType: true,
          city: true,
          lastDonation: true,
          user: {
            select: {
              id: true,
              name: true,
              phone: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: {
          request: bloodRequest,
          matchingDonors,
          matchCount: matchingDonors.length
        }
      });
    } catch (error: any) {
      console.error("Error getting matching donors:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء البحث عن متبرعين متطابقين"
      });
    }
  },
  async updateDonorProfile(req: Request, res: Response) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const data: Partial<RegisterDonorData> = req.body;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "يجب تسجيل الدخول"
      });
    }

    const donor = await prisma.bloodDonor.findUnique({
      where: { userId: user.id }
    });

    if (!donor) {
      return res.status(404).json({
        success: false,
        message: "لم يتم العثور على بيانات المتبرع"
      });
    }

    // التحقق من فصيلة الدم إذا تم إرسالها
    if (data.bloodType) {
      const validBloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
      if (!validBloodTypes.includes(data.bloodType.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: "فصيلة الدم غير صالحة"
        });
      }
    }

    // إعداد بيانات التحديث
    const updateData: any = {};
    if (data.bloodType !== undefined) updateData.bloodType = data.bloodType.toUpperCase();
    if (data.city !== undefined) updateData.city = data.city;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updatedDonor = await prisma.bloodDonor.update({
      where: { userId: user.id },
      data: updateData
    });

    res.json({
      success: true,
      message: "تم تحديث بيانات المتبرع بنجاح",
      data: updatedDonor
    });
  } catch (error: any) {
    console.error("Error updating donor profile:", error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء تحديث بيانات المتبرع"
    });
  }
},
};

export default bloodDonorController;