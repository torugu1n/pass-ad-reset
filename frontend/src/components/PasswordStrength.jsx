import React from 'react';

const REQUIREMENTS = [
  { key: 'length',    label: 'Mínimo 8 caracteres',     test: p => p.length >= 8 },
  { key: 'upper',     label: 'Letra maiúscula',          test: p => /[A-Z]/.test(p) },
  { key: 'lower',     label: 'Letra minúscula',          test: p => /[a-z]/.test(p) },
  { key: 'number',    label: 'Número',                   test: p => /[0-9]/.test(p) },
  { key: 'special',   label: 'Caractere especial',       test: p => /[^a-zA-Z0-9]/.test(p) },
];

const LEVELS = [
  { label: 'Fraca',    color: '#ef4444', width: '20%' },
  { label: 'Razoável', color: '#f59e0b', width: '40%' },
  { label: 'Boa',      color: '#eab308', width: '60%' },
  { label: 'Forte',    color: '#22c55e', width: '80%' },
  { label: 'Excelente',color: '#16a34a', width: '100%' },
];

export function PasswordStrength({ password }) {
  if (!password) return null;

  const metCount = REQUIREMENTS.filter(r => r.test(password)).length;
  const level = LEVELS[Math.min(metCount - 1, 4)] || LEVELS[0];

  return (
    <div className="pw-strength">
      <div className="pw-bar-track">
        <div
          className="pw-bar-fill"
          style={{ width: level.width, background: level.color }}
        />
      </div>
      <div className="pw-label" style={{ color: level.color }}>{level.label}</div>
      <div className="pw-requirements">
        {REQUIREMENTS.map(r => (
          <div key={r.key} className={`pw-req ${r.test(password) ? 'met' : 'unmet'}`}>
            <span>{r.test(password) ? '✓' : '○'}</span>
            {r.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function isPasswordValid(password) {
  return REQUIREMENTS.every(r => r.test(password));
}
