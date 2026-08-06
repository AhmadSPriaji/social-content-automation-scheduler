import { create } from 'zustand';
import { api } from '@/lib/api';

export interface WorkspaceMember {
  userId: string | { _id: string; email: string; name?: string };
  role: 'owner' | 'editor' | 'viewer';
}

export interface Workspace {
  _id: string;
  name: string;
  members: WorkspaceMember[];
  pendingInvitations?: any[];
  connectedAccounts?: any[];
}

interface WorkspaceState {
  activeWorkspaceId: string | null;
  workspaces: Workspace[];
  pendingInvitesCount: number;
  setActiveWorkspace: (id: string | null) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  fetchWorkspaces: () => Promise<void>;
  fetchPendingInvites: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeWorkspaceId: null,
  workspaces: [],
  pendingInvitesCount: 0,
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  fetchWorkspaces: async () => {
    try {
      const { data } = await api.get('/workspaces');
      set({ workspaces: data });
    } catch (error) {
      console.error('Failed to fetch workspaces', error);
    }
  },
  fetchPendingInvites: async () => {
    try {
      const res = await api.get('/workspaces/invitations/pending');
      set({ pendingInvitesCount: res.data.length });
    } catch (e) {
      console.error('Failed to fetch invites', e);
    }
  },
}));
