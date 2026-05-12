import React from 'react';

export default function SuccessPage() {
  return (
    <div className="success-page">
      <span className="success-icon">🎉</span>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Senha redefinida!</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
        Sua senha foi atualizada com sucesso no Active Directory.
        <br /><br />
        Aguarde alguns segundos e tente fazer login novamente no seu computador ou sistema.
      </p>
      <div className="alert alert-success">
        <span>✅</span>
        <span>Se a conta estava bloqueada, ela foi desbloqueada automaticamente.</span>
      </div>
      <div className="alert alert-info" style={{ marginTop: 12 }}>
        <span>ℹ️</span>
        <span>
          Lembre-se de atualizar a senha salva em todos os seus dispositivos e aplicativos.
        </span>
      </div>
      <p style={{ marginTop: 24, fontSize: 13, color: 'var(--text-muted)' }}>
        Em caso de dúvidas, entre em contato com o suporte de TI.
      </p>
    </div>
  );
}
