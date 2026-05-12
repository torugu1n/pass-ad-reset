const { body, validationResult } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Dados inválidos. Verifique os campos e tente novamente.' });
  }
  next();
}

const identifierRules = [
  body('identifier')
    .trim()
    .notEmpty().withMessage('Identificador obrigatório.')
    .isLength({ min: 2, max: 100 }).withMessage('Identificador inválido.')
    .matches(/^[a-zA-Z0-9@._\-\u00C0-\u024F]+$/).withMessage('Identificador contém caracteres inválidos.'),
];

const otpRules = [
  body('otp')
    .trim()
    .notEmpty()
    .matches(/^\d{6}$/).withMessage('Código inválido.'),
];

const newPasswordRules = [
  body('password')
    .isLength({ min: 8, max: 128 }).withMessage('Senha deve ter no mínimo 8 caracteres.')
    .matches(/[A-Z]/).withMessage('Senha deve conter letra maiúscula.')
    .matches(/[a-z]/).withMessage('Senha deve conter letra minúscula.')
    .matches(/[0-9]/).withMessage('Senha deve conter número.')
    .matches(/[^a-zA-Z0-9]/).withMessage('Senha deve conter caractere especial.'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) throw new Error('As senhas não coincidem.');
      return true;
    }),
];

const factor2Rules = [
  body('factorType')
    .trim()
    .isIn(['security_questions', 'birth_date', 'employee_id']).withMessage('Tipo de fator inválido.'),
];

const registerFactorRules = [
  body('adUsername').trim().notEmpty().isLength({ min: 1, max: 64 }),
  body('personalEmail').optional().isEmail().normalizeEmail(),
  body('phone').optional().matches(/^\+?[\d\s\-()]{7,20}$/),
  body('securityQuestion1').optional().trim().isLength({ min: 5, max: 200 }),
  body('securityAnswer1').optional().trim().isLength({ min: 2, max: 200 }),
  body('securityQuestion2').optional().trim().isLength({ min: 5, max: 200 }),
  body('securityAnswer2').optional().trim().isLength({ min: 2, max: 200 }),
  body('birthDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
];

module.exports = {
  validate,
  identifierRules,
  otpRules,
  newPasswordRules,
  factor2Rules,
  registerFactorRules,
};
