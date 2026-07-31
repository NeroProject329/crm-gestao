import {
  LoginForm,
} from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="auth-grid" />

        <div className="auth-orb" />

        <div className="auth-copy">
          <p className="auth-kicker">
            Gestão financeira
            inteligente
          </p>

          <h2 className="auth-title">
            Clareza para
            sua operação.
          </h2>

          <p className="auth-description">
            Faturamento,
            custos, ADS e
            resultados em uma
            experiência simples,
            rápida e precisa.
          </p>
        </div>
      </section>

      <section className="auth-panel">
        <LoginForm />
      </section>
    </main>
  );
}