import React, { useState } from 'react';

export default function IdentificationPage({ onSuccess, onRegister }) {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!identifier.trim()) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao processar. Tente novamente.');
        return;
      }

      // Always show the generic message — no user enumeration
      if (!data.sessionCreated) {
        // Show success-looking message even if user not found
        onSuccess({
          message: data.message,
          maskedEmail: null,
          maskedPhone: null,
          noUser: true,
        });
        return;
      }

      onSuccess({
        message: data.message,
        maskedEmail: data.maskedEmail,
        maskedPhone: data.maskedPhone,
        displayName: data.displayName,
        availableFactors: data.availableFactors,
      });
    } catch {
      setError('Falha de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="brand">
        <span className="brand-icon">🔐</span>
        <h1>Recuperar minha senha</h1>
        <p>Informe seu login, e-mail ou matrícula para iniciar o processo de recuperação.</p>
      </div>

      <div className="alert alert-info">
        <span>ℹ️</span>
        <span>Sua identidade será validada antes da redefinição da senha.</span>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠️</span> {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="identifier">Login, e-mail ou matrícula</label>
          <input
            id="identifier"
            type="text"
            autoComplete="username"
            placeholder="ex: joao.silva ou joao@empresa.com"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            required
            maxLength={100}
          />
        </div>

        <button className="btn" type="submit" disabled={loading || !identifier.trim()}>
          {loading ? <><span className="spinner" /> Verificando...</> : <>Continuar →</>}
        </button>
      </form>

      <hr className="divider" />

      <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
        Primeira vez aqui?{' '}
        <a className="link" onClick={onRegister} style={{ cursor: 'pointer' }}>
          Cadastrar dados de recuperação
        </a>
      </p>
    </>
  );
}
