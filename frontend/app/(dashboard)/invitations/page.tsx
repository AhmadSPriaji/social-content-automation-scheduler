'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace';

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { fetchWorkspaces, fetchPendingInvites } = useWorkspaceStore();

  const loadInvitations = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/workspaces/invitations/pending');
      setInvitations(res.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load invitations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations();
  }, []);

  const handleAccept = async (workspaceId: string) => {
    if (processingId) return;
    try {
      setProcessingId(workspaceId);
      await api.post(`/workspaces/${workspaceId}/invitations/accept`);
      toast.success('Invitation accepted');
      await fetchWorkspaces(); // Refresh global workspace list
      await fetchPendingInvites(); // Refresh notification badge
      loadInvitations(); // Reload pending invites
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to accept invitation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (workspaceId: string) => {
    if (processingId) return;
    try {
      setProcessingId(workspaceId);
      await api.post(`/workspaces/${workspaceId}/invitations/reject`);
      toast.success('Invitation declined');
      await fetchPendingInvites(); // Refresh notification badge
      loadInvitations();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to decline invitation');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-2">
        <Mail className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pending Invitations</h1>
          <p className="text-muted-foreground">
            Manage your workspace invitations.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Invitations</CardTitle>
            <CardDescription>
              Workspaces that you have been invited to join.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground">You have no pending invitations.</p>
            ) : (
              <div className="space-y-3">
                {invitations.map((workspace) => (
                  <div key={workspace._id} className="flex items-center justify-between bg-muted/30 p-4 rounded-md border group">
                    <a href={`/invitations/${workspace._id}`} className="flex flex-col flex-1 cursor-pointer">
                      <span className="text-sm font-semibold group-hover:text-primary transition-colors">{workspace.name}</span>
                      <span className="text-xs text-muted-foreground mt-1">
                        Invited to join this workspace
                      </span>
                    </a>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        disabled={processingId === workspace._id}
                        onClick={() => handleAccept(workspace._id)}
                      >
                        <Check className="h-4 w-4 mr-1" /> {processingId === workspace._id ? 'Loading...' : 'Accept'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={processingId === workspace._id}
                        onClick={() => handleReject(workspace._id)}
                      >
                        <X className="h-4 w-4 mr-1" /> {processingId === workspace._id ? 'Loading...' : 'Decline'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
