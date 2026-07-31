import { create } from 'zustand';

export interface WorkspaceMember {
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface Workspace {
  _id: string;
  name: string;
  members: WorkspaceMember[];
}

interface WorkspaceState {
  activeWorkspaceId: string | null;
  workspaces: Workspace[];
  setActiveWorkspace: (id: string | null) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeWorkspaceId: null,
  workspaces: [],
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  setWorkspaces: (workspaces) => set({ workspaces }),
}));
