'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { usePathname, useRouter } from 'next/navigation';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { user, setAuth } = useAuthStore();
  const { setWorkspaces, setActiveWorkspace, activeWorkspaceId, workspaces } = useWorkspaceStore();
  const [isInitializing, setIsInitializing] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  // Pages that don't require an active workspace to be viewed
  const isPublicOrSetupRoute = ['/login', '/register', '/workspaces/new'].some(route => pathname.startsWith(route));

  useEffect(() => {
    async function initSession() {
      // If we already have the user in memory, don't refetch on every render unless it's lost
      if (user) {
        setIsInitializing(false);
        return;
      }

      try {
        // Hydrate the user
        const { data: userData } = await api.get('/auth/me');
        setAuth(userData);

        // Fetch user's workspaces
        const { data: workspacesData } = await api.get('/workspaces');
        setWorkspaces(workspacesData);

        if (workspacesData.length > 0) {
          if (!activeWorkspaceId) {
            setActiveWorkspace(workspacesData[0]._id);
          }
        } else if (!isPublicOrSetupRoute) {
          // If logged in but no workspace, redirect to workspace creation
          router.push('/workspaces/new');
        }
      } catch (error) {
        // If /auth/me fails, it probably means token is missing or invalid.
        // The api interceptor might have attempted a refresh. If it still fails, user is not logged in.
        setAuth(null);
      } finally {
        setIsInitializing(false);
      }
    }

    initSession();
  }, [user, setAuth, setWorkspaces, setActiveWorkspace, activeWorkspaceId, router, isPublicOrSetupRoute]);

  // Optionally return a full page loader while hydrating session
  // But for better UX, we'll render children immediately and let middleware handle redirects.
  // The layout will just populate state quietly.
  
  return <>{children}</>;
}
