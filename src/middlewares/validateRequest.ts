export function validateAdInput(data: any) {
  const errors: Record<string, string> = {};

  if (!data.title || typeof data.title !== "string") {
    errors.title = "العنوان مطلوب";
  }

  if (!data.startAt || isNaN(Date.parse(data.startAt))) {
    errors.startAt = "تاريخ البداية غير صحيح";
  }

  if (!data.endAt || isNaN(Date.parse(data.endAt))) {
    errors.endAt = "تاريخ الانتهاء غير صحيح";
  }

  if (!data.targetType || !["BUSINESS", "LISTING", "CATEGORY", "EXTERNAL"].includes(data.targetType)) {
    errors.targetType = "نوع الإعلان غير صالح";
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}
