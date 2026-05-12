import React, { useState, useEffect } from 'react';
import { OtpInput } from '../components/OtpInput';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds

export default function OtpVerificationPage({ sessionData, onSuccess }) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  // If no actual session (user not found path), still render but disable submit
  const noUser = sessionData?.noUser;

  async function handleSubmit(e) {
    e.preventDefault();
    if (otp.length !== OTP_LENGTH || noUser) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();

      if (!res.ok || !data.verified) {
        setError(data.error || 'Código incorreto. Verifique e tente novamente.');
        setOtp('');
        return;
      }

      onSuccess({
        factor2Options: data.factor2Options,
        securityQuestion1: data.securityQuestion1,
        securityQuestion2: data.securityQuestion2,
      });
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCountdown > 0 || resending) return;
    setResending(true);
    try {
      await fetch('/api/auth/resend-otp', { method: 'POST', credentials: 'include' });
      setResendCountdown(RESEND_COOLDOWN);
      setOtp('');
      setError('');
    } catch { /* ignore */ } finally {
      setResending(false);
    }
  }

  const deliveryInfo = [];
  if (sessionData?.maskedEmail) deliveryInfo.push(`e-mail (${sessionData.maskedEmail})`);
  if (sessionData?.maskedPhone) deliveryInfo.push(`WhatsApp (${sessionData.maskedPhone})`);

  return (
    <>
      <div className="brand">
        <span className="brand-icon">📨</span>
        <h1>Digite o código</h1>
        <p>
          {sessionData?.message || 'Se os dados estiverem corretos, enviamos um código de verificação.'}
          {deliveryInfo.length > 0 && (
            <> Verifique seu {deliveryInfo.join(' e ')}.</>
          )}
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠️</span> {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <OtpInput value={otp} onChange={setOtp} length={OTP_LENGTH} />

        <button
          className="btn"
          type="submit"
          disabled={loading || otp.length !== OTP_LENGTH || noUser}
        >
          {loading ? <><span className="spinner" /> Validando...</> : 'Validar código'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14 }}>
        {resendCountdown > 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>
            Reenviar em {resendCountdown}s
          </span>
        ) : (
          <a className="link" onClick={handleResend} style={{ cursor: 'pointer' }}>
            {resending ? 'Reenviando...' : '↩ Reenviar código'}
          </a>
        )}
      </div>

      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        O código expira em {process.env.REACT_APP_OTP_EXPIRATION || 5} minutos.
      </p>
    </>
  );
}
