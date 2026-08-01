'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Bell, Check, CheckCheck, KeyRound, Laptop, LoaderCircle, LockKeyhole, LogOut, Mail, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';

import type {
  AccountSessionActionResponse,
  AccountSessionView,
  AuthenticatedUserView,
  NotificationInboxView,
  NotificationView,
} from '@crm/contracts';

import { ApiError, apiRequest } from '@/lib/api';
import { FinanceScene } from '@/components/three/finance-scene';

interface Props { area: 'admin' | 'employee' }
interface Toast { type: 'success' | 'error'; message: string }

function dateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Não foi possível concluir a operação.';
}

export function AccountSecurityClient({ area }: Props) {
  const [user, setUser] = useState<AuthenticatedUserView | null>(null);
  const [sessions, setSessions] = useState<AccountSessionView[]>([]);
  const [inbox, setInbox] = useState<NotificationInboxView>({ items: [], unreadCount: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [currentUser, activeSessions, notifications] = await Promise.all([
        apiRequest<AuthenticatedUserView>('/auth/me'),
        apiRequest<AccountSessionView[]>('/auth/sessions'),
        apiRequest<NotificationInboxView>('/notifications'),
      ]);
      const allowed = area === 'admin'
        ? currentUser.role === 'ADMIN'
        : currentUser.role === 'EMPLOYEE' && Boolean(currentUser.employeeId);
      if (!allowed) { window.location.assign('/login'); return; }
      setUser(currentUser);
      setSessions(activeSessions);
      setInbox(notifications);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        window.location.assign('/login');
        return;
      }
      setToast({ type: 'error', message: message(error) });
    } finally { setLoading(false); }
  }, [area]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const passwordReady = useMemo(() => (
    currentPassword.length > 0 &&
    newPassword.length >= 12 &&
    newPassword !== currentPassword &&
    newPassword === confirmPassword
  ), [confirmPassword, currentPassword, newPassword]);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordReady || busy) return;
    setBusy(true);
    try {
      await apiRequest<void>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      window.location.assign('/login?passwordChanged=1');
    } catch (error) {
      setToast({ type: 'error', message: message(error) });
      setBusy(false);
    }
  }

  async function revokeOthers() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await apiRequest<AccountSessionActionResponse>('/auth/sessions/revoke-others', { method: 'POST' });
      setToast({ type: 'success', message: `${result.revokedSessions} sessão(ões) encerrada(s).` });
      setSessions(await apiRequest<AccountSessionView[]>('/auth/sessions'));
    } catch (error) { setToast({ type: 'error', message: message(error) }); }
    finally { setBusy(false); }
  }

  async function revokeAll() {
    if (busy || !window.confirm('Encerrar todas as sessões, incluindo esta?')) return;
    setBusy(true);
    try {
      await apiRequest<AccountSessionActionResponse>('/auth/sessions/revoke-all', { method: 'POST' });
      window.location.assign('/login?sessionsRevoked=1');
    } catch (error) {
      setToast({ type: 'error', message: message(error) });
      setBusy(false);
    }
  }

  async function markRead(notification: NotificationView) {
    if (notification.readAt || busy) return;
    setBusy(true);
    try {
      const result = await apiRequest<{ unreadCount: number }>(`/notifications/${notification.id}/read`, { method: 'POST' });
      const now = new Date().toISOString();
      setInbox((value) => ({
        unreadCount: result.unreadCount,
        items: value.items.map((item) => item.id === notification.id ? { ...item, readAt: now } : item),
      }));
    } catch (error) { setToast({ type: 'error', message: message(error) }); }
    finally { setBusy(false); }
  }

  async function markAllRead() {
    if (!inbox.unreadCount || busy) return;
    setBusy(true);
    try {
      await apiRequest('/notifications/read-all', { method: 'POST' });
      const now = new Date().toISOString();
      setInbox((value) => ({ unreadCount: 0, items: value.items.map((item) => ({ ...item, readAt: item.readAt ?? now })) }));
      setToast({ type: 'success', message: 'Todas as notificações foram marcadas como lidas.' });
    } catch (error) { setToast({ type: 'error', message: message(error) }); }
    finally { setBusy(false); }
  }

  if (loading) return <main className="account-page account-loading"><LoaderCircle className="account-spin" /><strong>Carregando sua conta...</strong></main>;
  if (!user) return <main className="account-page"><div className="account-empty"><ShieldCheck /><h2>Não foi possível carregar sua conta</h2><button onClick={() => void load()}><RefreshCw size={16} />Tentar novamente</button></div></main>;

  return (
    <main className="account-page">
      <section className="account-hero">
        <div className="account-hero-copy"><span><ShieldCheck size={15} /> CONTA PROTEGIDA</span><h1>Perfil, segurança e notificações.</h1><p>Controle seus acessos, sua senha e os alertas da operação.</p></div>
        <div className="account-scene"><FinanceScene /></div>
        <div className="account-hero-stats"><div><LockKeyhole /><span>Sessões</span><strong>{sessions.length}</strong></div><div><Bell /><span>Não lidas</span><strong>{inbox.unreadCount}</strong></div></div>
      </section>

      <section className="account-grid">
        <article className="account-card">
          <header><div><span>PERFIL</span><h2>Dados da conta</h2></div><UserRound /></header>
          <div className="account-profile"><div>{user.name.trim().charAt(0).toUpperCase()}</div><p><strong>{user.name}</strong><span>{user.role === 'ADMIN' ? 'Administrador' : 'Funcionário'}</span></p></div>
          <dl><div><dt><Mail size={15} /> E-mail</dt><dd>{user.email}</dd></div><div><dt><ShieldCheck size={15} /> Acesso</dt><dd>{user.role}</dd></div></dl>
        </article>

        <article className="account-card">
          <header><div><span>SEGURANÇA</span><h2>Alterar senha</h2></div><KeyRound /></header>
          <form className="account-form" onSubmit={(event) => void changePassword(event)}>
            <label>Senha atual<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
            <label>Nova senha<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
            <label>Confirmar nova senha<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            <div className="account-checks"><span className={newPassword.length >= 12 ? 'ok' : ''}><Check />12 caracteres</span><span className={newPassword === confirmPassword && Boolean(confirmPassword) ? 'ok' : ''}><Check />Senhas iguais</span></div>
            <button className="account-primary" disabled={!passwordReady || busy}>{busy ? <LoaderCircle className="account-spin" /> : <KeyRound />}Atualizar senha</button>
            <small>A alteração encerra todas as sessões e exige um novo login.</small>
          </form>
        </article>
      </section>

      <section className="account-panel">
        <header><div><span>ACESSOS</span><h2>Sessões ativas</h2><p>Revogue dispositivos que não devem continuar conectados.</p></div><div><button disabled={busy || sessions.length <= 1} onClick={() => void revokeOthers()}><Laptop size={16} />Encerrar outras</button><button className="danger" disabled={busy} onClick={() => void revokeAll()}><LogOut size={16} />Encerrar todas</button></div></header>
        <div className="account-list">{sessions.map((session) => <article key={session.id} className={session.current ? 'current' : ''}><Laptop /><div><strong>{session.current ? 'Sessão atual' : 'Sessão autenticada'}</strong><span>Iniciada em {dateTime(session.createdAt)}</span></div><small>Expira em {dateTime(session.expiresAt)}</small></article>)}</div>
      </section>

      <section className="account-panel" id="notificacoes">
        <header><div><span>CENTRAL DE ALERTAS</span><h2>Notificações</h2><p>Últimos avisos destinados à sua conta.</p></div><button disabled={busy || inbox.unreadCount === 0} onClick={() => void markAllRead()}><CheckCheck size={16} />Marcar todas como lidas</button></header>
        {inbox.items.length === 0 ? <div className="account-empty"><Bell /><strong>Nenhuma notificação</strong><span>Os alertas aparecerão aqui.</span></div> : <div className="account-list notifications">{inbox.items.map((item) => <article key={item.id} className={item.readAt ? '' : 'unread'}><Bell /><div><strong>{item.title}</strong><p>{item.message}</p><span>{dateTime(item.createdAt)}</span></div>{!item.readAt && <button disabled={busy} onClick={() => void markRead(item)}><Check size={15} />Marcar como lida</button>}</article>)}</div>}
      </section>

      {toast && <div className={`account-toast ${toast.type}`} role="status">{toast.message}</div>}
    </main>
  );
}