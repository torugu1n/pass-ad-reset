const express = require('express');
const router = express.Router();
const { verifyFactor2, doPasswordReset, registerFactors } = require('../controllers/passwordController');
const { strictLimiter } = require('../middlewares/rateLimiter');
const { newPasswordRules, factor2Rules, registerFactorRules, validate } = require('../middlewares/validation');
const { requireResetSession, requireOTPVerified, requireFactor2Verified } = require('../middlewares/requireSession');

router.post(
  '/factor2',
  strictLimiter,
  requireResetSession,
  requireOTPVerified,
  factor2Rules,
  validate,
  verifyFactor2
);

router.post(
  '/reset',
  strictLimiter,
  requireResetSession,
  requireOTPVerified,
  requireFactor2Verified,
  newPasswordRules,
  validate,
  doPasswordReset
);

router.post(
  '/register-factors',
  strictLimiter,
  registerFactorRules,
  validate,
  registerFactors
);

module.exports = router;
