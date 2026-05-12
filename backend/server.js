require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');

const { migrate } = require('./src/database');
const { globalLimiter } = require('./src/middlewares/rateLimiter');

const authRoutes = require('./src/routes/auth');
const otpRoutes = require('./src/routes/otp');
const passwordRoutes = require('./src/routes/password');

const app = express();

// Trust reverse proxy (nginx/traefik in Docker)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// CORS — restrict to app URL
const allowedOrigin = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
}));

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// Session
const dbDir = path.dirname(process.env.DB_PATH || './data/app.db');
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: dbDir }),
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 60 * 1000, // 30 minutes
  },
  name: 'prs.sid',
}));

// Global rate limiter
app.use(globalLimiter);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/password', passwordRoutes);

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.resolve(__dirname, '../frontend/dist');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
}

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Error handler (never leak internals)
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Ocorreu um erro interno. Tente novamente.' });
});

const PORT = process.env.PORT || 3000;

migrate()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[pass-ad-reset] Backend rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Falha ao inicializar banco de dados:', err);
    process.exit(1);
  });
