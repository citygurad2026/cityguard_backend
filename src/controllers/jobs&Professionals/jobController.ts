import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { validateJobInput } from "../../middlewares/jobvalidation";

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: string;
    businessId?: number;
    [key: string]: any;
  };
}

interface JobData {
  title: string;
  description?: string;
  city?: string;
  region?: string;
  type?: string;
  salary?: string;
  isActive?: boolean;
  expiresAt?: string;
}

export const jobController = {
  /* ======================================================
     CREATE JOB - OWNER فقط
  ====================================================== */
  async createJob(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const data: JobData = req.body; 
      const userBusiness = await prisma.business.findFirst({ where: { ownerId: user!.id } });

      if (!userBusiness) {
        return res.status(403).json({
          success: false,
          message: "ليس لديك أي منشأة تجارية مسجلة"
        });
      }
     
      const validation = validateJobInput(data);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: "بيانات غير صالحة",
          errors: validation.errors
        });
      }

      let expiresAtDate = null;
      if (data.expiresAt) {
        expiresAtDate = new Date(data.expiresAt);
        if (isNaN(expiresAtDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: "تاريخ الانتهاء غير صالح"
          });
        }
      }

      const job = await prisma.job.create({
        data: {
          title: data.title,
          description: data.description || null,
          businessId: userBusiness.id,
          city: data.city || null,
          region: data.region || null,
          type: data.type || "عام",
          salary: data.salary?.toString() || null,
          isActive: data.isActive !== undefined ? data.isActive : true,
          expiresAt: expiresAtDate
        },
        include: {
          business: {
            select: {
              id: true,
              name: true,
              phone: true,
              city: true
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        message: "تم نشر الوظيفة بنجاح",
        data: job
      });
    } catch (error: any) {
      console.error("Error creating job:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء نشر الوظيفة"
      });
    }
  },

  /* ======================================================
     GET ALL JOBS - ADMIN فقط
  ====================================================== */
async getAllJobs(req: Request, res: Response) {
  try {
    const {
      page = "1",
      limit = "20",
      city,
      region,
      type,
      businessId,
      isActive,
      search,
      title,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    const where: any = {
      AND: [
        {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      ]
    };

    // ===== Filters =====

    if (city) {
      where.AND.push({
        city: { contains: city as string, mode: "insensitive" }
      });
    }

    if (region) {
      where.AND.push({
        region: { contains: region as string, mode: "insensitive" }
      });
    }

    if (type) {
      where.AND.push({
        type: { contains: type as string, mode: "insensitive" }
      });
    }

    if (businessId) {
      where.AND.push({
        businessId: parseInt(businessId as string)
      });
    }

    if (isActive !== undefined) {
      where.AND.push({
        isActive: isActive === "true"
      });
    }

    if (title) {
      where.AND.push({
        title: { contains: title as string, mode: "insensitive" }
      });
    }

    if (search) {
      where.AND.push({
        OR: [
          { title: { contains: search as string, mode: "insensitive" } },
          { description: { contains: search as string, mode: "insensitive" } },
          { city: { contains: search as string, mode: "insensitive" } },
          { region: { contains: search as string, mode: "insensitive" } },
          { type: { contains: search as string, mode: "insensitive" } }
        ]
      });
    }

    // ===== Pagination =====

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // ===== Sorting =====

    const validSortFields = ["createdAt", "title", "expiresAt"];
    const validSortOrders = ["asc", "desc"];

    const sortField = validSortFields.includes(sortBy as string)
      ? sortBy
      : "createdAt";

    const order = validSortOrders.includes(sortOrder as string)
      ? sortOrder
      : "desc";

    const orderBy: any = {};
    orderBy[sortField as string] = order;

    // ===== Query =====

    const [jobs, total] = await prisma.$transaction([
      prisma.job.findMany({
        where,
        skip,
        take: limitNum,
        orderBy,
        include: {
          business: {
            select: {
              id: true,
              name: true,
              city: true,
              phone: true
            }
          }
        }
      }),
      prisma.job.count({ where })
    ]);

    // ===== Filters Data =====

    const activeJobsCondition = {
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    };

    const categories = await prisma.job.findMany({
      select: { type: true },
      where: {
        type: { not: null },
        isActive: true,
        ...activeJobsCondition
      },
      distinct: ["type"]
    });

    const cities = await prisma.job.findMany({
      select: { city: true },
      where: {
        city: { not: null },
        isActive: true,
        ...activeJobsCondition
      },
      distinct: ["city"]
    });

    const regions = await prisma.job.findMany({
      select: { region: true },
      where: {
        region: { not: null },
        isActive: true,
        ...activeJobsCondition
      },
      distinct: ["region"]
    });

    res.json({
      success: true,
      data: {
        jobs,
        filters: {
          categories: categories.map(c => c.type).filter(Boolean),
          cities: cities.map(c => c.city).filter(Boolean),
          regions: regions.map(r => r.region).filter(Boolean)
        },
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum),
          limit: limitNum,
          hasNext: pageNum < Math.ceil(total / limitNum),
          hasPrev: pageNum > 1
        }
      }
    });

  } catch (error: any) {
    console.error("Error getting all jobs:", error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء جلب الوظائف"
    });
  }
},


  /* ======================================================
     GET JOB DETAILS - عام
  ====================================================== */
  async getJob(req: Request, res: Response) {
    try {
      const jobId = parseInt(req.params.id);

      if (isNaN(jobId)) {
        return res.status(400).json({
          success: false,
          message: "معرف الوظيفة غير صالح"
        });
      }

      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          business: {
            select: {
              id: true,
              name: true,
              description: true,
              city: true,
              phone: true,
              website: true,
              address: true
            }
          }
        }
      });

      if (!job) {
        return res.status(404).json({
          success: false,
          message: "الوظيفة غير موجودة"
        });
      }

      if (job.expiresAt && job.expiresAt < new Date()) {
        return res.status(410).json({
          success: false,
          message: "انتهت صلاحية هذه الوظيفة"
        });
      }

      res.json({
        success: true,
        data: {
          ...job,
          contactInfo: {
            phone: job.business?.phone,
            website: job.business?.website,
            address: job.business?.address
          },
          applicationInstructions: "يمكنك التقديم على هذه الوظيفة عن طريق التواصل مباشرة مع صاحب العمل عبر المعلومات المذكورة أعلاه"
        }
      });
    } catch (error: any) {
      console.error("Error getting job:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء جلب الوظيفة"
      });
    }
  },

  /* ======================================================
     UPDATE JOB - ADMIN + OWNER (مع التحقق من الملكية)
  ====================================================== */
  async updateJob(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const jobId = parseInt(req.params.id);
      const data: Partial<JobData> = req.body;

      if (isNaN(jobId)) {
        return res.status(400).json({
          success: false,
          message: "معرف الوظيفة غير صالح"
        });
      }

      const existingJob = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          business: {
            select: {
              ownerId: true
            }
          }
        }
      });

      if (!existingJob) {
        return res.status(404).json({
          success: false,
          message: "الوظيفة غير موجودة"
        });
      }

      const isBusinessOwner = existingJob.business?.ownerId === user!.id;
      if (user!.role !== "ADMIN" && !isBusinessOwner) {
        return res.status(403).json({
          success: false,
          message: "ليس لديك صلاحية لتعديل هذه الوظيفة"
        });
      }

      let expiresAtDate = undefined;
      if (data.expiresAt !== undefined) {
        if (data.expiresAt === null) {
          expiresAtDate = null;
        } else {
          expiresAtDate = new Date(data.expiresAt);
          if (isNaN(expiresAtDate.getTime())) {
            return res.status(400).json({
              success: false,
              message: "تاريخ الانتهاء غير صالح"
            });
          }
        }
      }

      const updateData: any = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.city !== undefined) updateData.city = data.city;
      if (data.region !== undefined) updateData.region = data.region;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.salary !== undefined) updateData.salary = data.salary;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.expiresAt !== undefined) updateData.expiresAt = expiresAtDate;

      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: updateData,
        include: {
          business: {
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
        message: "تم تحديث الوظيفة بنجاح",
        data: updatedJob
      });
    } catch (error: any) {
      console.error("Error updating job:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء تحديث الوظيفة"
      });
    }
  },

  /* ======================================================
     DELETE JOB - ADMIN + OWNER (مع التحقق من الملكية)
  ====================================================== */
  async deleteJob(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const jobId = parseInt(req.params.id);

      if (isNaN(jobId)) {
        return res.status(400).json({
          success: false,
          message: "معرف الوظيفة غير صالح"
        });
      }

      const existingJob = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          business: {
            select: { ownerId: true }
          }
        }
      });

      if (!existingJob) {
        return res.status(404).json({
          success: false,
          message: "الوظيفة غير موجودة"
        });
      }

      const isBusinessOwner = existingJob.business?.ownerId === user!.id;
      if (user!.role !== "ADMIN" && !isBusinessOwner) {
        return res.status(403).json({
          success: false,
          message: "ليس لديك صلاحية لحذف هذه الوظيفة"
        });
      }

      await prisma.job.delete({
        where: { id: jobId }
      });

      res.json({
        success: true,
        message: "تم حذف الوظيفة بنجاح"
      });
    } catch (error: any) {
      console.error("Error deleting job:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء حذف الوظيفة"
      });
    }
  },

  /* ======================================================
     GET BUSINESS JOBS - OWNER فقط
  ====================================================== */
  async getBusinessJobs(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const {
        page = "1",
        limit = "20",
        isActive
      } = req.query;

      const userBusiness = await prisma.business.findFirst({
        where: { ownerId: user!.id }
      });

      if (!userBusiness) {
        return res.status(404).json({
          success: false,
          message: "ليس لديك أي منشأة تجارية"
        });
      }

      const where: any = {
        businessId: userBusiness.id
      };

      if (isActive !== undefined) {
        where.isActive = isActive === "true";
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const [jobs, total] = await prisma.$transaction([
        prisma.job.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { createdAt: "desc" },
          include: {
            business: {
              select: {
                id: true,
                name: true,
                phone: true
              }
            }
          }
        }),
        prisma.job.count({ where })
      ]);

      res.json({
        success: true,
        data: {
          jobs,
          pagination: {
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
            limit: limitNum
          }
        }
      });
    } catch (error: any) {
      console.error("Error getting business jobs:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء جلب وظائفك"
      });
    }
  },

  /* ======================================================
     GET JOBS STATISTICS - ADMIN فقط
  ====================================================== */
  async getJobsStatistics(req: Request, res: Response) {
    try {
      const [
        totalJobs,
        activeJobs,
        expiredJobs,
        jobsByType,
        jobsByCity,
        recentJobs
      ] = await prisma.$transaction([
        prisma.job.count(),
        prisma.job.count({
          where: {
            isActive: true,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          }
        }),
        prisma.job.count({
          where: {
            expiresAt: { lt: new Date() }
          }
        }),
        prisma.job.groupBy({
          by: ["type"],
          _count: { id: true },
          where: { isActive: true },
          orderBy: { type: "asc" }
        }),
        prisma.job.groupBy({
          by: ["city"],
          _count: { id: true },
          where: { isActive: true },
          orderBy: { city: "asc" }
        }),
        prisma.job.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          totalJobs,
          activeJobs,
          expiredJobs,
          jobsByType,
          jobsByCity,
          recentJobs,
          activePercentage: totalJobs > 0 ?
            Math.round((activeJobs / totalJobs) * 100) : 0
        }
      });
    } catch (error: any) {
      console.error("Error getting jobs statistics:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء جلب إحصائيات الوظائف"
      });
    }
  },

  /* ======================================================
     GET POPULAR CATEGORIES - عام
  ====================================================== */
  async getPopularCategories(req: Request, res: Response) {
    try {
      const categories = await prisma.job.groupBy({
        by: ["type"],
        _count: {
          id: true
        },
        where: {
          type: { not: null },
          isActive: true
        },
        orderBy: {
          _count: {
            id: "desc"
          }
        },
        take: 10
      });

      res.json({
        success: true,
        data: categories.map(cat => ({
          name: cat.type,
          count: cat._count.id
        }))
      });
    } catch (error: any) {
      console.error("Error getting popular categories:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء جلب الفئات الشائعة"
      });
    }
  },

  /* ======================================================
     GET JOBS BY CATEGORY - عام
  ====================================================== */
  async getJobsByCategory(req: Request, res: Response) {
    try {
      const { category } = req.params;
      const { limit = "10" } = req.query;

      const jobs = await prisma.job.findMany({
        where: {
          type: category,
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        },
        take: parseInt(limit as string),
        orderBy: { createdAt: "desc" },
        include: {
          business: {
            select: {
              id: true,
              name: true,
              city: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: {
          category,
          jobs,
          count: jobs.length
        }
      });
    } catch (error: any) {
      console.error("Error getting jobs by category:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء جلب الوظائف حسب الفئة"
      });
    }
  },

  /* ======================================================
     SEARCH JOBS - عام
  ====================================================== */
  async quickSearchJobs(req: Request, res: Response) {
    try {
      const { q, limit = "5" } = req.query;

      if (!q || q.toString().trim().length < 2) {
        return res.json({
          success: true,
          data: []
        });
      }

      const searchTerm = q.toString().trim();

      const jobs = await prisma.job.findMany({
        where: {
          isActive: true,
          AND: [
            {
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } }
              ]
            },
            {
              OR: [
                { title: { contains: searchTerm, mode: "insensitive" as const } },
                { description: { contains: searchTerm, mode: "insensitive" as const } },
                { city: { contains: searchTerm, mode: "insensitive" as const } },
                { type: { contains: searchTerm, mode: "insensitive" as const } }
              ]
            }
          ]
        },
        take: parseInt(limit as string),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          city: true,
          type: true,
          salary: true,
          business: {
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
        data: jobs
      });
    } catch (error: any) {
      console.error("Error in quick search:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء البحث"
      });
    }
  },

  /* ======================================================
     GET FEATURED JOBS - عام
  ====================================================== */
  async getFeaturedJobs(req: Request, res: Response) {
    try {
      const { limit = "6" } = req.query;

      const featuredJobs = await prisma.job.findMany({
        where: {
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        },
        take: parseInt(limit as string),
        orderBy: { createdAt: "desc" },
        include: {
          business: {
            select: {
              id: true,
              name: true,
              phone: true,
              city: true
            }
          }
        }
      });

      res.json({
        success: true,
        data: featuredJobs
      });
    } catch (error: any) {
      console.error("Error getting featured jobs:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء جلب الوظائف المميزة"
      });
    }
  },

  /* ======================================================
     RENEW JOB - ADMIN + OWNER (مع التحقق من الملكية)
  ====================================================== */
  async renewJob(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const jobId = parseInt(req.params.id);
      const { days = 30 } = req.body;

      if (isNaN(jobId)) {
        return res.status(400).json({
          success: false,
          message: "معرف الوظيفة غير صالح"
        });
      }

      const existingJob = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          business: {
            select: { ownerId: true }
          }
        }
      });

      if (!existingJob) {
        return res.status(404).json({
          success: false,
          message: "الوظيفة غير موجودة"
        });
      }

      const isBusinessOwner = existingJob.business?.ownerId === user!.id;
      if (user!.role !== "ADMIN" && !isBusinessOwner) {
        return res.status(403).json({
          success: false,
          message: "ليس لديك صلاحية لتجديد هذه الوظيفة"
        });
      }

      const newExpiryDate = new Date();
      newExpiryDate.setDate(newExpiryDate.getDate() + parseInt(days.toString()));

      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: {
          expiresAt: newExpiryDate,
          isActive: true
        },
        include: {
          business: {
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
        message: `تم تجديد الوظيفة لمدة ${days} يوم بنجاح`,
        data: updatedJob
      });
    } catch (error: any) {
      console.error("Error renewing job:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء تجديد الوظيفة"
      });
    }
  },

  /* ======================================================
     TOGGLE JOB STATUS - ADMIN + OWNER (مع التحقق من الملكية)
  ====================================================== */
  async toggleJobStatus(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const jobId = parseInt(req.params.id);

      if (isNaN(jobId)) {
        return res.status(400).json({
          success: false,
          message: "معرف الوظيفة غير صالح"
        });
      }

      const existingJob = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          business: {
            select: { ownerId: true }
          }
        }
      });

      if (!existingJob) {
        return res.status(404).json({
          success: false,
          message: "الوظيفة غير موجودة"
        });
      }

      const isBusinessOwner = existingJob.business?.ownerId === user!.id;
      if (user!.role !== "ADMIN" && !isBusinessOwner) {
        return res.status(403).json({
          success: false,
          message: "ليس لديك صلاحية لتغيير حالة هذه الوظيفة"
        });
      }

      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: {
          isActive: !existingJob.isActive
        },
        include: {
          business: {
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
        message: `تم ${updatedJob.isActive ? 'تفعيل' : 'إلغاء تفعيل'} الوظيفة بنجاح`,
        data: updatedJob
      });
    } catch (error: any) {
      console.error("Error toggling job status:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء تغيير حالة الوظيفة"
      });
    }
  },

  /* ======================================================
     GET JOBS IN MY CITY - USER فقط
  ====================================================== */
  async getJobsInMyCity(req: Request, res: Response) {
    try {
      const { limit = "10" } = req.query;
      const city = req.query.city as string;

      if (!city) {
        return res.json({
          success: true,
          data: [],
          message: "الرجاء تحديد المدينة"
        });
      }

      const jobs = await prisma.job.findMany({
        where: {
          city: {
            contains: city,
            mode: "insensitive" as const
          },
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        },
        take: parseInt(limit as string),
        orderBy: { createdAt: "desc" },
        include: {
          business: {
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
          city,
          jobs,
          count: jobs.length
        }
      });
    } catch (error: any) {
      console.error("Error getting jobs in city:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء جلب الوظائف في مدينتك"
      });
    }
  },

  /* ======================================================
     GET NEW JOBS NOTIFICATION - عام + USER
  ====================================================== */
  async getNewJobsNotification(req: Request, res: Response) {
    try {
      const user = (req as AuthenticatedRequest).user;
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);

      const newJobsCount = await prisma.job.count({
        where: {
          isActive: true,
          createdAt: {
            gte: last24Hours
          },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      });

      let userNotifications = 0;
      if (user) {
        userNotifications = await prisma.job.count({
          where: {
            isActive: true,
            city: user.city || undefined,
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        });
      }

      res.json({
        success: true,
        data: {
          newJobsCount,
          userNotifications,
          hasNotifications: newJobsCount > 0 || userNotifications > 0,
          lastChecked: new Date()
        }
      });
    } catch (error: any) {
      console.error("Error getting notifications:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء جلب الإشعارات"
      });
    }
  }
};

export default jobController;