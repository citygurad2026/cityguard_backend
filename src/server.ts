import cookieParser from 'cookie-parser';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes';
import eventRoutes from './routes/eventRoutes';
import busRoutes from './routes/businessRoutes';
import categoryrouter from './routes/categoryRoutes';
import path from 'path';
import adrouter from './routes/adRoutes';

dotenv.config();
const app = express();


const allowedOrigins = [
  "http://localhost:3000",
  "https://cityguard-ten.vercel.app",
];


app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","X-Requested-With"]
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'CORS working' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
