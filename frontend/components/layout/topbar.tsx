'use client';

import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Menu, LogOut, Settings, User } from 'lucide-react';
import { Sidebar } from './sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState, useEffect } from 'react';

export function Topbar() {
  const { user, setAuth } = useAuthStore();
  const { workspaces, activeWorkspaceId, setActiveWorkspace, pendingInvitesCount, fetchPendingInvites } = useWorkspaceStore();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPendingInvites();
    }
  }, [user, fetchPendingInvites]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Logout failed');
      console.error('Logout failed', error);
    } finally {
      setAuth(null);
      router.push('/login');
    }
  };

  const activeWorkspace = workspaces.find((w) => w._id === activeWorkspaceId);

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-4">
        {/* Mobile menu trigger */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger className="md:hidden inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Sidebar</span>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <Sidebar className="block w-full border-r-0" />
          </SheetContent>
        </Sheet>
        
        <div className="hidden md:flex font-bold text-lg tracking-tight">AutoSocial</div>
      </div>

      <div className="flex items-center gap-4">
        {/* Workspace Selector */}
        {workspaces.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 max-w-[150px] sm:max-w-[200px]">
                <span className="truncate">{activeWorkspace?.name || 'Select Workspace'}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {workspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws._id}
                    onClick={() => setActiveWorkspace(ws._id)}
                    className={ws._id === activeWorkspaceId ? 'bg-accent' : ''}
                  >
                    {ws.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/workspaces/new')}>
                + Create Workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="outline" size="sm" onClick={() => router.push('/workspaces/new')}>
            + Create Workspace
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 w-10 rounded-full ml-2 relative">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{user?.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            {pendingInvitesCount > 0 && (
              <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-red-500 border-2 border-background" />
            )}
            <span className="sr-only">Toggle user menu</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">My Account</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email || 'user@example.com'}
                  </p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/invitations')} className="flex items-center justify-between">
              <div className="flex items-center">
                <User className="mr-2 h-4 w-4" />
                <span>Invitations</span>
              </div>
              {pendingInvitesCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                  {pendingInvitesCount}
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
