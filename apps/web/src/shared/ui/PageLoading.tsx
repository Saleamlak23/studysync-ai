import { Spinner } from './Spinner.js';

export function PageLoading() {
  return (
    <div className="flex min-h-48 items-center justify-center p-4">
      <Spinner label="Loading page" />
    </div>
  );
}
