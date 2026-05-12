import React, { useState } from 'react';
import { ProgressBar } from './components/ProgressBar';
import IdentificationPage from './pages/IdentificationPage';
import OtpVerificationPage from './pages/OtpVerificationPage';
import SecondFactorPage from './pages/SecondFactorPage';
import NewPasswordPage from './pages/NewPasswordPage';
import SuccessPage from './pages/SuccessPage';
import RegisterFactorsPage from './pages/RegisterFactorsPage';

const STEPS = ['Identificação', 'Verificação', 'Confirmação', 'Nova Senha'];

export default function App() {
  const [step, setStep] = useState('identify'); // identify | otp | factor2 | newpassword | success | register
  const [sessionData, setSessionData] = useState({});

  const stepIndex = {
    identify: 0,
    otp: 1,
    factor2: 2,
    newpassword: 3,
    success: 4,
  }[step] ?? 0;

  if (step === 'register') {
    return (
      <div className="card">
        <RegisterFactorsPage onBack={() => setStep('identify')} />
      </div>
    );
  }

  return (
    <div className="card">
      {step !== 'success' && (
        <ProgressBar steps={STEPS} current={stepIndex} />
      )}

      {step === 'identify' && (
        <IdentificationPage
          onSuccess={(data) => { setSessionData(data); setStep('otp'); }}
          onRegister={() => setStep('register')}
        />
      )}
      {step === 'otp' && (
        <OtpVerificationPage
          sessionData={sessionData}
          onSuccess={(factor2Data) => { setSessionData(d => ({ ...d, ...factor2Data })); setStep('factor2'); }}
        />
      )}
      {step === 'factor2' && (
        <SecondFactorPage
          sessionData={sessionData}
          onSuccess={() => setStep('newpassword')}
        />
      )}
      {step === 'newpassword' && (
        <NewPasswordPage
          onSuccess={() => setStep('success')}
        />
      )}
      {step === 'success' && <SuccessPage />}
    </div>
  );
}
