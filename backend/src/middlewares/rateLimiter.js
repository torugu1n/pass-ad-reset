const rateLimit = require('express-rate-limit');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '15', 10) * 60 * 1000;
const max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '20', 10);

const genericMessage = {
  error: 'Muitas tentativas. Por favor, aguarde alguns minutos e tente novamente.',
};

// Global limiter
const globalLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: genericMessage,
  keyGenerator: (req) => req.ip,
});

// Strict limiter for sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: genericMessage,
  keyGenerator: (req) => req.ip,
});

// Session-level in-memory tracker (supplemental to IP limiter)
const sessionAttempts = new Map();

function sessionLimiter(maxAttempts = 5) {
  return (req, res, next) => {
    const sessionId = req.session?.resetSessionId;
    if (!sessionId) return next();

    const attempts = sessionAttempts.get(sessionId) || 0;
    if (attempts >= maxAttempts) {
      return res.status(429).json({ error: 'Muitas tentativas nesta sessão. Inicie um novo processo.' });
    }
    sessionAttempts.set(sessionId, attempts + 1);

    // Clean up after 30 minutes
    setTimeout(() => sessionAttempts.delete(sessionId), 30 * 60 * 1000);
    next();
  };
}

module.exports = { globalLimiter, strictLimiter, sessionLimiter };
