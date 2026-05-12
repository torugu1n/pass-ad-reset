const nodemailer = require('nodemailer');
const axios = require('axios');

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

async function sendOTPByEmail(toEmail, otp, displayName) {
  const transport = createTransport();
  const expMin = process.env.OTP_EXPIRATION_MINUTES || '5';

  await transport.sendMail({
    from: `"Portal de Senha" <${process.env.SMTP_FROM}>`,
    to: toEmail,
    subject: 'Código de verificação — Recuperação de Senha',
    text: `Olá${displayName ? ', ' + displayName : ''},\n\nSeu código de verificação é: ${otp}\n\nEste código expira em ${expMin} minutos.\nNão compartilhe este código com ninguém.\n\nSe você não solicitou a recuperação de senha, ignore este e-mail.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8f9fa;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:48px;">🔐</div>
          <h2 style="color:#1a1a2e;margin:0;">Código de Verificação</h2>
        </div>
        <p style="color:#555;">Olá${displayName ? ', <strong>' + displayName + '</strong>' : ''},</p>
        <p style="color:#555;">Use o código abaixo para continuar a recuperação de senha:</p>
        <div style="background:#fff;border:2px solid #6c63ff;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
          <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#6c63ff;">${otp}</span>
        </div>
        <p style="color:#888;font-size:14px;">⏱ Este código expira em <strong>${expMin} minutos</strong>.</p>
        <p style="color:#888;font-size:14px;">🚫 Não compartilhe este código com ninguém.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#aaa;font-size:12px;text-align:center;">Se você não solicitou a recuperação de senha, ignore este e-mail.</p>
      </div>
    `,
  });
}

async function sendOTPByWhatsApp(phone, otp, displayName) {
  if (!process.env.WHATSAPP_WEBHOOK_URL) return;

  const expMin = process.env.OTP_EXPIRATION_MINUTES || '5';
  const message = `🔐 *Código de verificação*\n\nOlá${displayName ? ', ' + displayName : ''}!\n\nSeu código: *${otp}*\n\n⏱ Válido por ${expMin} minutos.\n🚫 Não compartilhe.`;

  await axios.post(process.env.WHATSAPP_WEBHOOK_URL, {
    phone,
    message,
    apiKey: process.env.WHATSAPP_API_KEY,
  }, { timeout: 10000 });
}

module.exports = { sendOTPByEmail, sendOTPByWhatsApp };
