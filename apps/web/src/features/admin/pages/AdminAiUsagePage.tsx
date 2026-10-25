import { AiLimitsForm, AiUsagePanel } from '@/features/admin';

export function AdminAiUsagePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">AI usage and limits</h1>
      <AiUsagePanel />
      <AiLimitsForm />
    </div>
  );
}
