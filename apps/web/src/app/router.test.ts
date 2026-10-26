import { isValidElement, Suspense, type ReactElement, type ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { router } from './router.js';
import { authRoutes } from '@/features/auth';
import { boardRoutes } from '@/features/board';
import { profileRoutes } from '@/features/profile';
import { searchRoutes } from '@/features/search';
import { workspaceRoutes, workspacesRoutes } from '@/features/workspaces';

const ownedPageRoutes = [
  ...authRoutes,
  ...profileRoutes,
  ...workspacesRoutes,
  ...workspaceRoutes,
  ...boardRoutes,
  ...searchRoutes,
];

function isLazySuspenseElement(element: ReactNode | undefined) {
  if (!isValidElement<{ children?: ReactElement }>(element) || element.type !== Suspense) return false;
  const child = element.props.children;
  if (!child || !isValidElement(child) || typeof child.type !== 'object') return false;
  const lazyType = child.type as { $$typeof?: symbol };
  return lazyType.$$typeof === Symbol.for('react.lazy');
}

function collectLayoutRoutes(routes: RouteObject[]): RouteObject[] {
  return routes.flatMap((route) => {
    const children = 'children' in route ? route.children ?? [] : [];
    const current = children.length > 0 && isLazySuspenseElement(route.element) ? [route] : [];
    return [...current, ...collectLayoutRoutes(children)];
  });
}

describe('route-level code splitting', () => {
  it.each([
    '/login',
    '/register',
    '/profile',
    '/workspaces',
    '/join/:code',
    '/w/:workspaceId/settings',
    '/w/:workspaceId/board',
    '/search',
  ])('TC-NFR-03: loads the %s page through a lazy route component', (path) => {
    const route = ownedPageRoutes.find((candidate) => 'path' in candidate && candidate.path === path);

    expect(route).toBeDefined();
    expect(isLazySuspenseElement(route?.element)).toBe(true);
  });

  it('TC-NFR-03: code-splits app-owned route layouts', () => {
    expect(collectLayoutRoutes(router.routes)).toHaveLength(4);
  });
});

describe('route error recovery', () => {
  it('TC-UX-01: provides an error boundary for each top-level route tree', () => {
    expect(router.routes).toHaveLength(2);
    expect(router.routes.every((route) => route.hasErrorBoundary)).toBe(true);
  });
});
