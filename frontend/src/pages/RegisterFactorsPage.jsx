import React, { useState } from 'react';

const SECURITY_QUESTIONS = [
  'Qual o nome do seu primeiro animal de estimação?',
  'Qual o nome da cidade onde você nasceu?',
  'Qual o nome de solteiro(a) da sua mãe?',
  'Qual era o nome da sua escola primária?',
  'Qual o modelo do seu primeiro carro?',
  'Qual é o nome do seu melhor amigo de infância?',
];

export default function RegisterFactorsPage({ onBack }) {
  const [step, setStep] = useState('login'); // login | factors | success
  const [adUsername, setAdUsername] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [q1, setQ1] = useState(SECURITY_QUESTIONS[0]);
  const [a1, setA1] = useState('');
  const [q2, setQ2] = useState(SECURITY_QUESTIONS[1]);
  const [a2, setA2] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/password/register-factors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          adUsername,
          personalEmail: personalEmail || undefined,
          phone: phone || undefined,
          securityQuestion1: q1,
          securityAnswer1: a1,
          securityQuestion2: q2,
          securityAnswer2: a2,
          birthDate: birthDate || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Não foi possível salvar. Tente novamente.');
        return;
      }

      setStep('success');
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'success') {
    return (
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <span style={{ fontSize: 56, display: 'block', marginBottom: 16 }}>✅</span>
        <h2 style={{ marginBottom: 12 }}>Dados salvos com sucesso!</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
          Seus dados de recuperação foram cadastrados. Você já pode usar o portal para redefinir sua senha caso precise.
        </p>
        <button className="btn" onClick={onBack}>Voltar ao início</button>
      </div>
    );
  }

  return (
    <>
      <div className="brand">
        <span className="brand-icon">📋</span>
        <h1>Cadastrar recuperação</h1>
        <p>Registre seus dados para poder redefinir sua senha no futuro sem precisar do suporte.</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="alert alert-info">
        <span>🔒</span>
        <span>Seus dados são criptografados e usados apenas para verificação de identidade.</span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Login do Active Directory *</label>
          <input type="text" value={adUsername} onChange={e => setAdUsername(e.target.value)} required maxLength={64} />
        </div>

        <div className="form-group">
          <label>E-mail pessoal (não corporativo)</label>
          <input type="email" value={personalEmail} onChange={e => setPersonalEmail(e.target.value)} placeholder="seu@gmail.com" />
        </div>

        <div className="form-group">
          <label>Telefone / WhatsApp</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+55 11 99999-9999" />
        </div>

        <div className="form-group">
          <label>Data de nascimento</label>
          <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
        </div>

        <hr className="divider" />
        <p style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Perguntas de segurança</p>

        <div className="form-group">
          <label>Pergunta 1</label>
          <select value={q1} onChange={e => setQ1(e.target.value)}>
            {SECURITY_QUESTIONS.map(q => <option key={q}>{q}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Resposta 1</label>
          <input type="text" value={a1} onChange={e => setA1(e.target.value)} autoComplete="off" required />
        </div>

        <div className="form-group">
          <label>Pergunta 2</label>
          <select value={q2} onChange={e => setQ2(e.target.value)}>
            {SECURITY_QUESTIONS.map(q => <option key={q}>{q}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Resposta 2</label>
          <input type="text" value={a2} onChange={e => setA2(e.target.value)} autoComplete="off" required />
        </div>

        <button className="btn" type="submit" disabled={loading || !adUsername || !a1 || !a2}>
          {loading ? <><span className="spinner" /> Salvando...</> : 'Salvar dados de recuperação'}
        </button>
        <button type="button" className="btn btn-secondary" style={{ marginTop: 10 }} onClick={onBack}>
          ← Voltar
        </button>
      </form>
    </>
  );
}
