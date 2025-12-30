import cookieParser from 'cookie-parser';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes';
import eventRoutes from './routes/eventRoutes'
import busRoutes from './routes/businessRoutes'
import { errorHandler } from './middlewares/errorHandler';
import categoryrouter from './routes/categoryRoutes';
import path from 'path';
import adrouter from './routes/adRoutes';

dotenv.config();
const app = express();

// ====== MIDDLEWARES ======
/* const allowedOrigins = [
  "http://localhost:3000",
  "https://cityguard-ten.vercel.app",
]; */

app.use(cors(
 /*  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, */
));
app.use(morgan('dev'));
app.use(express.json());

// هذا السطر مهم جداً للكوكيز
app.use(cookieParser());

// ====== ROUTES ======
app.use('/api/users', userRoutes);

app.use('/api/bus',busRoutes)
app.use('/api/event',eventRoutes)
app.use('/api/categories',categoryrouter)
app.use('/api/ads',adrouter)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ====== ERROR HANDLER ======
app.use(errorHandler);
app.get('/', (req, res) => {
  res.send('API is running!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
});
