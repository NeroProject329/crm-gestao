'use client';

import {
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

import {
  ArrowRight,
  LoaderCircle,
  Orbit,
} from 'lucide-react';

import type {
  AuthSessionResponse,
} from '@crm/contracts';

import {
  apiRequest,
  ApiError,
} from '@/lib/api';

export function LoginForm() {
  const router =
    useRouter();

  const [
    companySlug,
    setCompanySlug,
  ] =
    useState(
      'crm-gestao',
    );

  const [
    email,
    setEmail,
  ] =
    useState('');

  const [
    password,
    setPassword,
  ] =
    useState('');

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  async function submit(
    event:
      React.FormEvent<
        HTMLFormElement
      >,
  ): Promise<void> {
    event.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const session =
        await apiRequest<
          AuthSessionResponse
        >(
          '/auth/login',

          {
            method:
              'POST',

            allowRefresh:
              false,

            body:
              JSON.stringify({
                companySlug,
                email,
                password,
              }),
          },
        );

        if (
          session.user.role ===
          'ADMIN'
        ) {
          router.replace(
            '/admin/dashboard',
          );

          return;
        }

        if (
          session.user.role ===
          'EMPLOYEE'
        ) {
          router.replace(
            '/app/dashboard',
          );

          return;
        }

        setError(
          'Perfil de acesso inválido.',
        );
    } catch (
      currentError
    ) {
      if (
        currentError
        instanceof ApiError
      ) {
        setError(
          currentError
            .status === 401
            ? 'Empresa, e-mail ou senha inválidos.'
            : currentError
                .message,
        );
      } else {
        setError(
          'Não foi possível entrar agora.',
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-card">
      <div className="login-brand">
        <div className="login-brand-mark">
          <Orbit
            size={22}
          />
        </div>

        <span className="login-brand-name">
          CRM Gestão
        </span>
      </div>

      <h1 className="login-heading">
        Bem-vindo.
      </h1>

      <p className="login-subtitle">
        Acesse sua visão
        financeira e acompanhe
        sua operação em tempo
        real.
      </p>

      <form
        onSubmit={
          submit
        }
      >
        <div className="form-field">
          <label
            htmlFor="companySlug"
          >
            Empresa
          </label>

          <input
            id="companySlug"

            className="form-control"

            value={
              companySlug
            }

            onChange={
              (
                event,
              ) =>
                setCompanySlug(
                  event
                    .target
                    .value,
                )
            }

            autoComplete="organization"

            required
          />
        </div>

        <div className="form-field">
          <label
            htmlFor="email"
          >
            E-mail
          </label>

          <input
            id="email"

            type="email"

            className="form-control"

            value={
              email
            }

            onChange={
              (
                event,
              ) =>
                setEmail(
                  event
                    .target
                    .value,
                )
            }

            autoComplete="email"

            required
          />
        </div>

        <div className="form-field">
          <label
            htmlFor="password"
          >
            Senha
          </label>

          <input
            id="password"

            type="password"

            className="form-control"

            value={
              password
            }

            onChange={
              (
                event,
              ) =>
                setPassword(
                  event
                    .target
                    .value,
                )
            }

            autoComplete="current-password"

            required
          />
        </div>

        <button
          type="submit"

          className="primary-button"

          disabled={
            loading
          }
        >
          {
            loading
              ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                  />

                  Entrando
                </>
              )
              : (
                <>
                  Entrar

                  <ArrowRight
                    size={18}
                  />
                </>
              )
          }
        </button>

        {
          error
            ? (
              <div className="form-error">
                {error}
              </div>
            )
            : null
        }
      </form>
    </div>
  );
}