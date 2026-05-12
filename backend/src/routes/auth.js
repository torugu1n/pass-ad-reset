const express = require('express');
const router = express.Router();
const { identify, resendOTP } = require('../controllers/authController');
const { strictLimiter } = require('../middlewares/rateLimiter');
const { identifierRules, validate } = require('../middlewares/validation');
const { requireResetSession } = require('../middlewares/requireSession');

router.post('/identify', strictLimiter, identifierRules, validate, identify);
router.post('/resend-otp', strictLimiter, requireResetSession, resendOTP);

module.exports = router;
