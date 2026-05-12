const { get } = require('../database');

async function requireResetSession(req, res, next) {
  const sessionId = req.session?.resetSessionId;
  if (!sessionId) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Reinicie o processo.' });
  }

  const now = Math.floor(Date.now() / 1000);
  const session = await get(
    `SELECT * FROM reset_sessions WHERE id=? AND expires_at>?`,
    [sessionId, now]
  );

  if (!session) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Sessão expirada. Reinicie o processo.' });
  }

  req.resetSession = session;
  next();
}

async function requireOTPVerified(req, res, next) {
  if (!req.resetSession?.otp_verified) {
    return res.status(403).json({ error: 'Verificação de identidade incompleta.' });
  }
  next();
}

async function requireFactor2Verified(req, res, next) {
  if (!req.resetSession?.factor2_verified) {
    return res.status(403).json({ error: 'Segunda verificação não concluída.' });
  }
  next();
}

module.exports = { requireResetSession, requireOTPVerified, requireFactor2Verified };
