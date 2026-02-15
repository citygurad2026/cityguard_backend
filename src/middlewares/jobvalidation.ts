export function validateJobInput(data: any) {
  const errors: Record<string, string> = {};
  const validTypes = ["عام","تقنية معلومات","محاسبة","تسويق","مبيعات","هندسة","طب","تعليم","إدارة","خدمة عملاء","موارد بشرية","قانون","إعلام","سياحة","فندقة","أمن","نقل","مقاولات","صيانة","أخرى"];


  if (!data.title || typeof data.title !== "string" || data.title.trim().length < 3) {
    errors.title = "العنوان مطلوب (3 أحرف على الأقل)";
  }

  if (data.description && data.description.length > 5000) {
    errors.description = "الوصف طويل جداً (الحد الأقصى 5000 حرف)";
  }

  if (data.expiresAt && isNaN(Date.parse(data.expiresAt))) {
    errors.expiresAt = "تاريخ الانتهاء غير صالح";
  }

if (data.salary && typeof data.salary !== "string" && typeof data.salary !== "number") {
  errors.salary = "الراتب يجب أن يكون نص أو رقم";
}



  if (data.type && !validTypes.includes(data.type)) {
    errors.type = `نوع الوظيفة غير صالح. الأنواع المسموحة: ${validTypes.join(", ")}`;
  }

  return { 
    isValid: Object.keys(errors).length === 0, 
    errors 
  };
}