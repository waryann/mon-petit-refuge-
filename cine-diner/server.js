require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');

const publicRoutes = require('./routes/public');
const paymentRoutes = require('./routes/payment');
const adminRoutes = require('./routes/admin');

const app = express();
app.set('trust proxy', 1); // Trust Render proxy for secure cookies
const PORT = process.env.PORT || 3000;

// Security headers (relaxed for CDNs)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: null, // Removed to prevent localhost issues on Safari
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Trop de requêtes, veuillez réessayer dans quelques minutes.'
});
app.use(limiter);

// Stricter rate limit for payment creation
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Trop de tentatives de paiement. Veuillez réessayer dans 15 minutes.'
});

// Session management
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', publicRoutes);
app.use('/payment', paymentLimiter, paymentRoutes);
app.use('/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).render('error', { 
    message: 'Une erreur interne est survenue. Veuillez réessayer.' 
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  const { closeDb } = require('./database');
  closeDb();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`\n🎬 Soirée Ciné-Dîner — Serveur démarré`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → Admin: http://localhost:${PORT}/admin`);
  console.log(`   → Places max: ${process.env.MAX_PLACES || 80}\n`);
});

module.exports = app;
