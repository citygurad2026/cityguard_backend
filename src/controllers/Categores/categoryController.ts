// src/controllers/admin/categoryController.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CategoryRequest {
  name: string;
  description?: string;
  parentId?: string | number;
  imageUrl?: string;
  isActive?: boolean;
  sortOrder?: string | number;
}

// 1. إنشاء تصنيف جديد
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, parentId, imageUrl } = req.body as CategoryRequest;

    if (!name || name.trim().length < 2) {
      res.status(400).json({
        success: false,
        message: "اسم التصنيف مطلوب (على الأقل حرفين)"
      });
      return;
    }

    // توليد slug من الاسم
    const generateSlug = (text: string): string =>
      text
        .normalize("NFKD")
        .replace(/[^\w\s-\u0600-\u06FF]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .toLowerCase();

    let slug = generateSlug(name);

    // تحقق من أن slug فريد
    const existingCategory = await prisma.category.findUnique({ 
      where: { slug } 
    });
    
    if (existingCategory) {
      const timestamp = Date.now().toString().slice(-4);
      slug = `${slug}-${timestamp}`;
    }

    // تحويل parentId إلى number أو null
    const parsedParentId = parentId ? 
      (typeof parentId === 'string' ? parseInt(parentId) : parentId) : 
      null;

    if (parsedParentId !== null && isNaN(parsedParentId as number)) {
      res.status(400).json({
        success: false,
        message: "معرف التصنيف الرئيسي غير صالح"
      });
      return;
    }

    // إنشاء التصنيف
    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        parentId: parsedParentId as number | null,
        imageUrl: imageUrl?.trim() || null,
      },
    });

    res.status(201).json({
      success: true,
      message: "تم إنشاء التصنيف بنجاح",
      data: category,
    });

  } catch (error: any) {
    console.error("خطأ في createCategory:", error);
    
    let errorMessage = "حدث خطأ أثناء إنشاء التصنيف";
    if (error.code === "P2002") errorMessage = "اسم التصنيف مستخدم بالفعل";
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 2. جلب جميع التصنيفات
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: [
        { parentId: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' }
      ],
      include: {
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
            imageUrl: true,
            isActive: true,
          },
          orderBy: { sortOrder: 'asc' }
        },
        _count: {
          select: {
            businesses: true
          }
        }
      },
      where: {
        OR: [
          { parentId: null }, // التصنيفات الرئيسية
          { parentId: { not: null } } // التصنيفات الفرعية
        ]
      }
    });

    res.status(200).json({
      success: true,
      data: categories,
      count: categories.length
    });
  } catch (error: any) {
    console.error("خطأ في getCategories:", error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء جلب التصنيفات",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 3. جلب تصنيف واحد
export const getCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id);
    
    if (isNaN(categoryId)) {
      res.status(400).json({
        success: false,
        message: "معرف التصنيف غير صالح"
      });
      return;
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
            imageUrl: true,
            isActive: true,
            sortOrder: true,
            _count: {
              select: { businesses: true }
            }
          },
          orderBy: { sortOrder: 'asc' }
        },
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        },
        businesses: {
          take: 10,
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
        _count: {
          select: {
            businesses: true,
            children: true
          }
        }
      }
    });

    if (!category) {
      res.status(404).json({
        success: false,
        message: "التصنيف غير موجود"
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error: any) {
    console.error("خطأ في getCategory:", error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء جلب التصنيف",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 4. تحديث تصنيف
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id);
    
    if (isNaN(categoryId)) {
      res.status(400).json({
        success: false,
        message: "معرف التصنيف غير صالح"
      });
      return;
    }

    const { name, description, parentId, imageUrl, isActive, sortOrder } = req.body as CategoryRequest;

    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!existingCategory) {
      res.status(404).json({
        success: false,
        message: "التصنيف غير موجود"
      });
      return;
    }
    
    
    // إذا تغير الاسم، عدل الـ slug
    let slug = existingCategory.slug;
    if (name && name.trim() !== existingCategory.name) {
      const generateSlug = (text: string): string =>
        text
          .normalize("NFKD")
          .replace(/[^\w\s-\u0600-\u06FF]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .toLowerCase();
      
      slug = generateSlug(name.trim());
      
      // تحقق من أن slug فريد
      const existingSlug = await prisma.category.findFirst({
        where: { 
          slug,
          id: { not: categoryId }
        }
      });
      
      if (existingSlug) {
        const timestamp = Date.now().toString().slice(-4);
        slug = `${slug}-${timestamp}`;
      }
    }

    // تحويل القيم الرقمية
    const parsedParentId = parentId !== undefined 
      ? (parentId ? (typeof parentId === 'string' ? parseInt(parentId) : parentId) : null)
      : existingCategory.parentId;

    const parsedSortOrder = sortOrder !== undefined
      ? (typeof sortOrder === 'string' ? parseInt(sortOrder) : sortOrder)
      : existingCategory.sortOrder;

    // التحقق من عدم جعل التصنيف ابناً لنفسه
    if (parsedParentId === categoryId) {
      res.status(400).json({
        success: false,
        message: "لا يمكن جعل التصنيف ابناً لنفسه"
      });
      return;
    }

    // التحقق من وجود دورة (أي تصنيف يجعله ابناً لأحد أبنائه)
    if (parsedParentId !== null) {
      let currentParentId :number  = parsedParentId as number;
      while (currentParentId) {
        if (currentParentId === categoryId) {
          res.status(400).json({
            success: false,
            message: "لا يمكن جعل التصنيف ابناً لأحد تصنيفاته الفرعية"
          });
          return;
        }
        
        const parent = await prisma.category.findUnique({
          where: { id: currentParentId },
          select: { parentId: true }
        });
        
        currentParentId = parent?.parentId || 0;
      }
    }

    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: {
        name: name?.trim() || existingCategory.name,
        slug,
        description: description !== undefined ? description?.trim() || null : existingCategory.description,
        parentId: parsedParentId as number | null,
        imageUrl: imageUrl !== undefined ? imageUrl?.trim() || null : existingCategory.imageUrl,
        isActive: isActive !== undefined ? Boolean(isActive) : existingCategory.isActive,
        sortOrder: parsedSortOrder as number,
      },
    });

    res.status(200).json({
      success: true,
      message: "تم تحديث التصنيف بنجاح",
      data: updatedCategory,
    });
  } catch (error: any) {
    console.error("خطأ في updateCategory:", error);
    
    let errorMessage = "حدث خطأ أثناء تحديث التصنيف";
    if (error.code === "P2002") errorMessage = "اسم التصنيف مستخدم بالفعل";
    else if (error.code === "P2003") errorMessage = "التصنيف الرئيسي غير موجود";
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 5. حذف تصنيف
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id);
    
    if (isNaN(categoryId)) {
      res.status(400).json({
        success: false,
        message: "معرف التصنيف غير صالح"
      });
      return;
    }

    // تحقق إذا كان التصنيف موجوداً
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      res.status(404).json({
        success: false,
        message: "التصنيف غير موجود"
      });
      return;
    }

    // تحقق إذا كان التصنيف يحتوي على تصنيفات فرعية
    const hasChildren = await prisma.category.findFirst({
      where: { parentId: categoryId }
    });

    if (hasChildren) {
      res.status(400).json({
        success: false,
        message: "لا يمكن حذف التصنيف لأنه يحتوي على تصنيفات فرعية"
      });
      return;
    }

    // تحقق إذا كان التصنيف يحتوي على أعمال
    const hasBusinesses = await prisma.business.findFirst({
      where: { categoryId }
    });

    if (hasBusinesses) {
      res.status(400).json({
        success: false,
        message: "لا يمكن حذف التصنيف لأنه مرتبط بأعمال تجارية"
      });
      return;
    }

    await prisma.category.delete({
      where: { id: categoryId }
    });

    res.status(200).json({
      success: true,
      message: "تم حذف التصنيف بنجاح",
      data: { id: categoryId, name: category.name }
    });
  } catch (error: any) {
    console.error("خطأ في deleteCategory:", error);
    
    let errorMessage = "حدث خطأ أثناء حذف التصنيف";
    if (error.code === "P2025") errorMessage = "التصنيف غير موجود";
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 6. جلب التصنيفات الرئيسية فقط
export const getParentCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ],
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        description: true,
        _count: {
          select: {
            children: true,
            businesses: true
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: categories,
      count: categories.length
    });
  } catch (error: any) {
    console.error("خطأ في getParentCategories:", error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء جلب التصنيفات الرئيسية",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// تصدير ككائن واحد
export const categoryController = {
  createCategory,
  getCategories,
  getCategory,
  updateCategory,
  deleteCategory,
  getParentCategories
};

export default categoryController;