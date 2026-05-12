import React, { useState } from 'react';
import { PasswordStrength, isPasswordValid } from '../components/PasswordStrength';

export default function NewPasswordPage({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordsMatch = password === confirm && confirm.length > 0;
  const valid = isPasswordValid(password) && passwordsMatch;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password, confirmPassword: confirm }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Não foi possível redefinir a senha. Tente novamente.');
        return;
      }

      onSuccess();
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="brand">
        <span className="brand-icon">🔑</span>
        <h1>Nova senha</h1>
        <p>Crie uma senha segura que só você conhece.</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠️</span> {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="password">Nova senha</label>
          <div style={{ position: 'relative' }}>
            <input
              id="password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              maxLength={128}
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)',
              }}
              tabIndex={-1}
            >
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>
          <PasswordStrength password={password} />
        </div>

        <div className="form-group">
          <label htmlFor="confirm">Confirmar nova senha</label>
          <input
            id="confirm"
            type={showPw ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            maxLength={128}
            className={confirm && !passwordsMatch ? 'error' : ''}
          />
          {confirm && !passwordsMatch && (
            <div className="field-error">As senhas não coincidem.</div>
          )}
          {passwordsMatch && (
            <div style={{ color: 'var(--success)', fontSize: 12, marginTop: 4 }}>✓ Senhas coincidem</div>
          )}
        </div>

        <button className="btn" type="submit" disabled={loading || !valid}>
          {loading ? <><span className="spinner" /> Redefinindo...</> : '✓ Redefinir senha'}
        </button>
      </form>
    </>
  );
}
