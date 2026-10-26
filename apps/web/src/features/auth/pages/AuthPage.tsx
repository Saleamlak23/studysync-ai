import { Sparkles } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loginBody, registerBody } from '@studysync/shared';
import { api, ApiError } from '@/shared/lib/api.js';
import { acceptAuthResponse } from '@/shared/lib/session.js';
import { Button, Card, Input } from '@/shared/ui/index.js';

type AuthMode = 'login' | 'register';
type FormErrors = Partial<Record<'name' | 'email' | 'password', string>>;

function getFieldError(
  key: 'name' | 'email' | 'password',
  message: string,
  currentMode: AuthMode,
  values: { name: string; email: string; password: string },
): string {
  if (key === 'email') return 'Enter a valid email address.';
  if (key === 'password') {
    if (!values.password.trim()) return 'Password is required.';
    if (currentMode === 'register' && values.password.length < 8) return 'Password must be at least 8 characters.';
    return message.includes('at least') ? message : 'Password is required.';
  }
  return 'Name is required.';
}

export function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentMode: AuthMode = location.pathname === '/register' ? 'register' : 'login';

  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fromPath = useMemo(() => {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from;
    return from?.pathname && from.pathname.startsWith('/join/') ? from.pathname : null;
  }, [location.state]);

  const validate = () => {
    const schema = currentMode === 'register' ? registerBody : loginBody;
    const parsed = schema.safeParse(
      currentMode === 'register'
        ? {
            name: values.name,
            email: values.email,
            password: values.password,
          }
        : {
            email: values.email,
            password: values.password,
          },
    );

    if (parsed.success) {
      setFieldErrors({});
      return parsed.data;
    }

    const nextErrors: FormErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === 'name' || key === 'email' || key === 'password') {
        nextErrors[key] ??= getFieldError(key, issue.message, currentMode, values);
      }
    }

    setFieldErrors(nextErrors);
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    const parsed = validate();
    if (!parsed) return;

    try {
      setIsSubmitting(true);
      const response = await api<{ user: { id: string; name: string; email: string; avatarUrl: string | null; bio: string | null; systemRole: 'USER' | 'ADMIN' }; accessToken: string }>(
        currentMode === 'register' ? '/auth/register' : '/auth/login',
        {
          method: 'POST',
          body: parsed,
        },
      );

      acceptAuthResponse(response);
      navigate(fromPath ?? '/');
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const setFieldValue = (field: 'name' | 'email' | 'password', value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
    setSubmitError(null);
  };

  const title = currentMode === 'login' ? 'Welcome back' : 'Create your account';
  const subtitle =
    currentMode === 'login'
      ? 'Sign in to continue your workspace.'
      : 'Start organising your study projects with AI support.';

  return (
    <main className="bg-canvas p-4 text-fg md:p-6">
      <Card className="mx-auto w-full max-w-md border border-line bg-surface p-5 shadow-md">
        <div className="mb-5 flex items-center justify-center gap-2 text-primary">
          <div className="flex size-10 items-center justify-center rounded-full bg-ai-soft text-ai">
            <Sparkles className="size-5" strokeWidth={1.75} />
          </div>
          <div className="text-left">
            <p className="text-lg font-bold tracking-tight">StudySync AI</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-md border border-line bg-surface-muted p-1">
          <button
            type="button"
            onClick={() => navigate('/login', { state: location.state })}
            aria-label="Select email sign in form"
            className={[
              'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
              currentMode === 'login' ? 'bg-primary text-white shadow-sm' : 'text-fg-muted',
            ].join(' ')}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => navigate('/register', { state: location.state })}
            aria-label="Select account creation form"
            className={[
              'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
              currentMode === 'register' ? 'bg-primary text-white shadow-sm' : 'text-fg-muted',
            ].join(' ')}
          >
            Account
          </button>
        </div>

        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-fg">{title}</h1>
          <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>
          <p className="mt-2 text-xs text-fg-muted">
            {fromPath
              ? 'You are joining a workspace. Sign in or create an account to continue.'
              : 'Joining a workspace? Open its invite link to continue here.'}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          {currentMode === 'register' && (
            <Input
              id="name"
              label="Name"
              name="name"
              type="text"
              autoComplete="name"
              value={values.name}
              onChange={(event) => setFieldValue('name', event.target.value)}
              error={fieldErrors.name}
              placeholder="Ada Lovelace"
            />
          )}

          <Input
            id="email"
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => setFieldValue('email', event.target.value)}
            error={fieldErrors.email}
            placeholder="you@example.com"
          />

          <Input
            id="password"
            label="Password"
            name="password"
            type="password"
            autoComplete={currentMode === 'login' ? 'current-password' : 'new-password'}
            value={values.password}
            onChange={(event) => setFieldValue('password', event.target.value)}
            error={fieldErrors.password}
            placeholder={currentMode === 'login' ? '••••••••' : 'At least 8 characters'}
          />

          {submitError && (
            <p role="alert" className="rounded-md border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger">
              {submitError}
            </p>
          )}

          <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>
            {currentMode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-fg-muted">
          {currentMode === 'login' ? 'New here? ' : 'Already have an account? '}
          <button
            type="button"
            className="font-semibold text-primary underline decoration-from-font underline-offset-2"
            onClick={() =>
              navigate(currentMode === 'login' ? '/register' : '/login', { state: location.state })
            }
          >
            {currentMode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </Card>
    </main>
  );
}
