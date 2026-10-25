import { updateAiLimitsBody } from '@studysync/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '@/shared/lib/api.js';
import { Button, Card, Input, Skeleton, useToast } from '@/shared/ui';
import { useAdminAiLimits, useUpdateAdminAiLimits } from '@/features/admin';

type LimitFields = {
  userDailyLimit: string;
  workspaceDailyLimit: string;
};

type LimitErrors = Partial<Record<keyof LimitFields, string>>;

export function AiLimitsForm() {
  const limits = useAdminAiLimits();
  const updateLimits = useUpdateAdminAiLimits();
  const { toast } = useToast();
  const [values, setValues] = useState<LimitFields>({ userDailyLimit: '', workspaceDailyLimit: '' });
  const [errors, setErrors] = useState<LimitErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!limits.data) return;
    setValues({
      userDailyLimit: String(limits.data.userDailyLimit),
      workspaceDailyLimit: String(limits.data.workspaceDailyLimit),
    });
  }, [limits.data]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsed = updateAiLimitsBody.safeParse({
      userDailyLimit: Number(values.userDailyLimit),
      workspaceDailyLimit: Number(values.workspaceDailyLimit),
    });

    if (!parsed.success) {
      const nextErrors: LimitErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if ((field === 'userDailyLimit' || field === 'workspaceDailyLimit') && !nextErrors[field]) {
          nextErrors[field] = issue.message;
        }
      }
      setErrors(nextErrors);
      setFormError('Enter a positive whole number for each daily limit.');
      return;
    }

    setErrors({});
    updateLimits.mutate(parsed.data, {
      onSuccess: () => toast('AI limits saved.', { variant: 'success' }),
      onError: (error) =>
        setFormError(error instanceof ApiError ? error.message : 'We could not save the AI limits. Try again.'),
    });
  }

  return (
    <section aria-labelledby="ai-limits-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="ai-limits-heading" className="text-lg font-semibold">
          AI limits
        </h2>
        <p className="text-sm text-fg-muted">Set the daily request limit for each user and workspace.</p>
      </div>
      <Card className="flex flex-col gap-4">
        {limits.isPending ? (
          <div role="status" aria-label="Loading AI limits" className="flex flex-col gap-3">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-10 w-36" />
          </div>
        ) : limits.isError ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="text-sm text-danger">
              {limits.error instanceof ApiError ? limits.error.message : 'We could not load AI limits. Try again.'}
            </p>
            <Button onClick={() => void limits.refetch()}>Try again</Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-fg-muted">
              {limits.data.updatedAt
                ? `Last updated ${new Date(limits.data.updatedAt).toLocaleString()}`
                : 'Using the configured default limits.'}
            </p>
            {formError && <p role="alert" className="text-sm text-danger">{formError}</p>}
            <form aria-label="AI limits" onSubmit={submit} className="flex flex-col gap-4">
              <Input
                id="user-daily-limit"
                label="Daily limit per user"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                required
                value={values.userDailyLimit}
                error={errors.userDailyLimit}
                onChange={(event) => setValues((current) => ({ ...current, userDailyLimit: event.target.value }))}
              />
              <Input
                id="workspace-daily-limit"
                label="Daily limit per workspace"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                required
                value={values.workspaceDailyLimit}
                error={errors.workspaceDailyLimit}
                onChange={(event) =>
                  setValues((current) => ({ ...current, workspaceDailyLimit: event.target.value }))
                }
              />
              <div>
                <Button type="submit" variant="primary" loading={updateLimits.isPending}>
                  Save limits
                </Button>
              </div>
            </form>
          </>
        )}
      </Card>
    </section>
  );
}
