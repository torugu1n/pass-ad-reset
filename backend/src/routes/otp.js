const express = require('express');
const router = express.Router();
const { verifyOTPHandler } = require('../controllers/otpController');
const { strictLimiter } = require('../middlewares/rateLimiter');
const { otpRules, validate } = require('../middlewares/validation');
const { requireResetSession } = require('../middlewares/requireSession');

router.post('/verify', strictLimiter, requireResetSession, otpRules, validate, verifyOTPHandler);

module.exports = router;
