'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings, Trash2, Pencil } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InviteMemberModal } from '@/components/settings/invite-member-modal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  // Renaming state
  const [isRenaming, setIsRenaming] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isSubmittingRename, setIsSubmittingRename] = useState(false);

  const activeWorkspace = workspaces.find(w => w._id === activeWorkspaceId);

  const getMemberId = (m: any) => typeof m.userId === 'string' ? m.userId : m.userId._id;
  const getMemberEmail = (m: any) => typeof m.userId === 'object' && m.userId.email ? m.userId.email : 'Unknown email';

  const userRole = activeWorkspace?.members.find((m) => getMemberId(m) === user?.id)?.role;
  const isOwner = userRole === 'owner';

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    if (!activeWorkspaceId) return;
    setUpdatingMemberId(memberId);
    try {
      await api.patch(`/workspaces/${activeWorkspaceId}/members/${memberId}`, { role: newRole });
      toast.success('Member role updated successfully');
      // The layout handles fetching workspaces on mount, but we should refetch or reload
      window.location.reload();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update member role');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!activeWorkspaceId) return;
    if (!confirm('Are you sure you want to remove this member?')) return;
    setUpdatingMemberId(memberId);
    try {
      await api.delete(`/workspaces/${activeWorkspaceId}/members/${memberId}`);
      toast.success('Member removed successfully');
      window.location.reload();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to remove member');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRenameWorkspace = async () => {
    if (!activeWorkspaceId || !newWorkspaceName.trim()) return;
    setIsSubmittingRename(true);
    try {
      await api.patch(`/workspaces/${activeWorkspaceId}`, { name: newWorkspaceName.trim() });
      toast.success('Workspace renamed successfully');
      window.location.reload();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to rename workspace');
    } finally {
      setIsSubmittingRename(false);
    }
  };

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
              <Input value={user?.id || ''} readOnly className="bg-muted text-xs font-mono" />
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
              <div className="flex items-center gap-2">
                <Input value={activeWorkspace?.name || 'No workspace selected'} readOnly className="bg-muted" />
                {isOwner && activeWorkspaceId && (
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => {
                      setNewWorkspaceName(activeWorkspace?.name || '');
                      setIsRenaming(true);
                    }}
                    title="Rename Workspace"
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Workspace ID</Label>
              <Input value={activeWorkspace?._id || ''} readOnly className="bg-muted text-xs font-mono" />
            </div>
            <div className="pt-4 flex gap-2">
              <Button 
                variant="outline" 
                disabled={!isOwner || !activeWorkspaceId}
                onClick={() => setInviteModalOpen(true)}
              >
                Invite Members
              </Button>
              <Button 
                variant="destructive" 
                disabled={!isOwner || !activeWorkspaceId}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                Delete Workspace
              </Button>
            </div>
            {!isOwner && activeWorkspaceId && (
              <p className="text-xs text-muted-foreground mt-2">Only the workspace owner can invite members or delete the workspace.</p>
            )}

            {activeWorkspace?.members && activeWorkspace.members.length > 0 && (
              <div className="pt-6 border-t mt-6">
                <h3 className="font-semibold mb-4 text-sm">Workspace Members</h3>
                <div className="space-y-3">
                  {activeWorkspace.members.map((member: any) => {
                    const memberId = getMemberId(member);
                    const email = getMemberEmail(member);
                    return (
                      <div key={memberId} className="flex items-center justify-between bg-muted/30 p-3 rounded-md border">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{email}</span>
                          <span className="text-xs text-muted-foreground font-mono">ID: {memberId}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isOwner && memberId !== user?.id ? (
                            <Select 
                              disabled={updatingMemberId === memberId} 
                              value={member.role}
                              onValueChange={(val) => handleUpdateRole(memberId, val)}
                            >
                              <SelectTrigger className="w-[110px] h-8 text-xs">
                                <SelectValue placeholder="Role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="owner">Owner</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs px-2 py-1 bg-secondary rounded-md capitalize font-medium">{member.role}</span>
                          )}

                          {isOwner && memberId !== user?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              disabled={updatingMemberId === memberId}
                              onClick={() => handleRemoveMember(memberId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {activeWorkspaceId && (
        <InviteMemberModal 
          open={inviteModalOpen} 
          onOpenChange={setInviteModalOpen} 
          workspaceId={activeWorkspaceId} 
          onSuccess={() => window.location.reload()}
        />
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the workspace
              <strong className="mx-1">{activeWorkspace?.name}</strong> 
              and all of its associated posts, media, and audit logs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={async (e) => {
                e.preventDefault();
                if (!activeWorkspaceId) return;
                setIsDeleting(true);
                try {
                  await api.delete(`/workspaces/${activeWorkspaceId}`);
                  toast.success('Workspace deleted successfully');
                  setDeleteConfirmOpen(false);
                  
                  // Reload page to re-fetch workspaces and reset activeWorkspaceId correctly via layout
                  window.location.href = '/dashboard';
                } catch (error: any) {
                  toast.error(error.response?.data?.message || 'Failed to delete workspace');
                } finally {
                  setIsDeleting(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Workspace'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isRenaming} onOpenChange={setIsRenaming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a new name for your workspace. Workspace names must be unique.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="workspace-name" className="mb-2 block">New Name</Label>
            <Input 
              id="workspace-name"
              value={newWorkspaceName} 
              onChange={(e) => setNewWorkspaceName(e.target.value)} 
              placeholder="E.g., Marketing Team"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmittingRename}>Cancel</AlertDialogCancel>
            <Button 
              onClick={handleRenameWorkspace}
              disabled={!newWorkspaceName.trim() || isSubmittingRename || newWorkspaceName === activeWorkspace?.name}
            >
              {isSubmittingRename ? 'Saving...' : 'Save Changes'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
