import path from 'path';
import multer from 'multer';
import fs from 'fs';

const uploadPath = path.join(__dirname, '../uploads'); // تعديل حسب موقع مجلد uploads

// إنشاء المجلد إذا لم يكن موجودًا
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const fileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedImageTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  const allowedVideoTypes = [
    "video/mp4",
    "video/quicktime", // mov
  ];

  if (
    allowedImageTypes.includes(file.mimetype) ||
    allowedVideoTypes.includes(file.mimetype)
  ) {
    cb(null, true);
  } else {
    cb(new Error(`File type not supported: ${file.mimetype}`));
  }
};


export const upload = multer({ storage, fileFilter });
