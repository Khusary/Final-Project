const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

const { generalLimiter } = require('./middlewares/rateLimiter');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');
const decryptRoutes = require('./routes/decryptRoutes');
const profileRoutes = require('./routes/profileRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// --- Security middleware ---
app.use(helmet());
app.use(mongoSanitize());
app.use(xss());

// --- CORS: allow local dev + production frontend ---
const allowedOrigins = [process.env.CLIENT_URL, process.env.PRODUCTION_CLIENT_URL].filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// --- Body parsing & logging ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// --- Global rate limiting ---
app.use('/api', generalLimiter);

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'SecureCrypt API is running.', timestamp: new Date().toISOString() });
});

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/decrypt', decryptRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);

// --- 404 + error handler (must be last) ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;
