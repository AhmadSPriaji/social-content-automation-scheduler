'use client';

import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  
  const activeWorkspace = workspaces.find(w => w._id === activeWorkspaceId);

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-2">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and workspace preferences.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              Your personal account details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input value={user?.email || ''} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Account ID</Label>
              <Input value={user?._id || ''} readOnly className="bg-muted text-xs font-mono" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Workspace</CardTitle>
            <CardDescription>
              Details about your currently selected workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Workspace Name</Label>
              <Input value={activeWorkspace?.name || 'No workspace selected'} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Workspace ID</Label>
              <Input value={activeWorkspace?._id || ''} readOnly className="bg-muted text-xs font-mono" />
            </div>
            <div className="pt-4 flex gap-2">
              <Button variant="outline" disabled>Invite Members (Coming Soon)</Button>
              <Button variant="destructive" disabled>Delete Workspace (Coming Soon)</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
