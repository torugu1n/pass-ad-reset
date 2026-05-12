import React, { useState } from 'react';

export default function SecondFactorPage({ sessionData, onSuccess }) {
  const options = sessionData?.factor2Options || {};
  const [factorType, setFactorType] = useState(
    options.securityQuestions ? 'security_questions'
    : options.birthDate ? 'birth_date'
    : 'employee_id'
  );
  const [answer, setAnswer] = useState('');
  const [answer2, setAnswer2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/password/factor2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ factorType, answer, answer2 }),
      });
      const data = await res.json();

      if (!res.ok || !data.verified) {
        setError(data.error || 'Resposta incorreta. Tente novamente.');
        return;
      }

      onSuccess();
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const tabs = [];
  if (options.securityQuestions) tabs.push({ key: 'security_questions', label: '❓ Perguntas de segurança' });
  if (options.birthDate) tabs.push({ key: 'birth_date', label: '🎂 Data de nascimento' });
  if (options.employeeId) tabs.push({ key: 'employee_id', label: '🪪 Matrícula (últimos 4 dígitos)' });

  return (
    <>
      <div className="brand">
        <span className="brand-icon">🛡️</span>
        <h1>Confirmação adicional</h1>
        <p>Para sua segurança, confirme mais uma informação antes de redefinir sua senha.</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {tabs.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              className={`btn btn-secondary${factorType === t.key ? '' : ''}`}
              style={{
                width: 'auto', flex: 1, fontSize: 13, padding: '8px 12px',
                background: factorType === t.key ? 'var(--primary-light)' : 'transparent',
                borderColor: factorType === t.key ? 'var(--primary)' : 'var(--border)',
                color: factorType === t.key ? 'var(--primary)' : 'var(--text-muted)',
              }}
              onClick={() => { setFactorType(t.key); setAnswer(''); setAnswer2(''); setError(''); }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {factorType === 'security_questions' && (
          <>
            <div className="form-group">
              <label>{sessionData?.securityQuestion1 || 'Pergunta de segurança 1'}</label>
              <input type="text" value={answer} onChange={e => setAnswer(e.target.value)} required autoComplete="off" />
            </div>
            {sessionData?.securityQuestion2 && (
              <div className="form-group">
                <label>{sessionData.securityQuestion2}</label>
                <input type="text" value={answer2} onChange={e => setAnswer2(e.target.value)} required autoComplete="off" />
              </div>
            )}
          </>
        )}

        {factorType === 'birth_date' && (
          <div className="form-group">
            <label>Data de nascimento</label>
            <input type="date" value={answer} onChange={e => setAnswer(e.target.value)} required />
          </div>
        )}

        {factorType === 'employee_id' && (
          <div className="form-group">
            <label>Últimos 4 dígitos da matrícula</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              value={answer}
              onChange={e => setAnswer(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>
        )}

        <button className="btn" type="submit" disabled={loading || !answer}>
          {loading ? <><span className="spinner" /> Verificando...</> : 'Confirmar identidade'}
        </button>
      </form>
    </>
  );
}
