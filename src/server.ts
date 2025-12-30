import cookieParser from 'cookie-parser';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes';
import eventRoutes from './routes/eventRoutes';
import busRoutes from './routes/businessRoutes';
import { errorHandler } from './middlewares/errorHandler';
import categoryrouter from './routes/categoryRoutes';
import path from 'path';
import adrouter from './routes/adRoutes';

dotenv.config();
const app = express();

// ====== ALLOWED ORIGINS ======
const allowedOrigins = [
  "http://localhost:3000",
  "https://cityguard-ten.vercel.app",
];

// ====== الحل الصحيح بدون app.options ======
// 1. استخدم middleware يدوي لكل الطلبات
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // تحقق إذا كان origin مسموح به
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // إذا كان طلب OPTIONS، رد فوراً
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// 2. إبقى على الـ CORS middleware الأصلي
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// ====== باقي middlewares ======
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ====== ROUTES ======
app.use('/api/users', userRoutes);
app.use('/api/bus', busRoutes);
app.use('/api/event', eventRoutes);
app.use('/api/categories', categoryrouter);
app.use('/api/ads', adrouter);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ====== TEST ENDPOINT ======
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'CORS should be working now',
    timestamp: new Date().toISOString()
  });
});

// ====== ERROR HANDLER ======
app.use(errorHandler);

app.get('/', (req, res) => {
  res.send('API is running!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
  console.log('Allowed origins:', allowedOrigins);
});