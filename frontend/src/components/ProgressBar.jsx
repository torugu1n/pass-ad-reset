import React from 'react';

export function ProgressBar({ steps, current }) {
  return (
    <div className="progress-steps">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className={`step-item${done ? ' done' : ''}${active ? ' active' : ''}`}>
            <div className="step-dot">
              {done ? '✓' : i + 1}
            </div>
            <span className="step-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
