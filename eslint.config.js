import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.tsbuild/**', '**/node_modules/**', 'prisma/migrations/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/web/src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@/features/*/*', '@/features/*/**'], message: 'Import another feature through its index.ts only.' },
          { group: ['../*/**', '../../*/**'], message: 'Feature imports must use shared modules or a feature public index.' }
        ]
      }]
    }
  },
  {
    files: ['apps/web/src/shared/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['@/features/**'], message: 'Shared modules cannot import features.' }] }] }
  },
  { languageOptions: { globals: { process: 'readonly', console: 'readonly', fetch: 'readonly', window: 'readonly', document: 'readonly' } } },
);
