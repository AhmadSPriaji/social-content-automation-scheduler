'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Check, X, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace';

export default function InvitationDetailsPage() {
  const { workspaceId } = useParams();
  const router = useRouter();
  const [invitation, setInvitation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { fetchWorkspaces, fetchPendingInvites } = useWorkspaceStore();

  useEffect(() => {
    const loadInvitation = async () => {
      try {
        setIsLoading(true);
        const res = await api.get(`/workspaces/${workspaceId}/invitation`);
        setInvitation(res.data);
      } catch (error: any) {
        if (error.response?.status === 404) {
          toast.error('Invitation not found or has been revoked.');
        } else {
          toast.error(error.response?.data?.message || 'Failed to load invitation details');
        }
        router.push('/invitations');
      } finally {
        setIsLoading(false);
      }
    };
    if (workspaceId) loadInvitation();
  }, [workspaceId, router]);

  const handleAccept = async () => {
    if (isProcessing) return;
    try {
      setIsProcessing(true);
      await api.post(`/workspaces/${workspaceId}/invitations/accept`);
      toast.success('Invitation accepted');
      await fetchWorkspaces();
      await fetchPendingInvites();
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to accept invitation');
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (isProcessing) return;
    try {
      setIsProcessing(true);
      await api.post(`/workspaces/${workspaceId}/invitations/reject`);
      toast.success('Invitation declined');
      await fetchPendingInvites();
      router.push('/invitations');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to decline invitation');
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-xl mx-auto w-full mt-10">
        <p className="text-center text-muted-foreground animate-pulse">Loading invitation...</p>
      </div>
    );
  }

  if (!invitation) return null;

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto w-full mt-10">
      <Button variant="ghost" className="w-fit mb-4" onClick={() => router.push('/invitations')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to all invitations
      </Button>

      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 flex items-center justify-center rounded-full mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Workspace Invitation</CardTitle>
          <CardDescription>
            You have been invited to collaborate on AutoSocial
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4 pt-4">
          <div className="bg-muted/50 rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-1">Workspace Name</p>
            <p className="text-xl font-bold">{invitation.name}</p>
            
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-1">Role</p>
              <p className="font-medium capitalize">{invitation.role}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground px-4">
            By accepting this invitation, you will be able to collaborate with the team on their social media content.
          </p>
        </CardContent>
        <CardFooter className="flex gap-4 pt-4">
          <Button 
            className="flex-1" 
            onClick={handleAccept} 
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : (
              <><Check className="h-4 w-4 mr-2" /> Accept Invitation</>
            )}
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 text-destructive hover:bg-destructive/10" 
            onClick={handleReject}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : (
              <><X className="h-4 w-4 mr-2" /> Decline</>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
