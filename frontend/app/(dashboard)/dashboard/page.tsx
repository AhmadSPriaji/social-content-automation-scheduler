'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { CreatePostModal } from '@/components/dashboard/create-post-modal';
import { SchedulePostModal } from '@/components/dashboard/schedule-post-modal';
import { EditPostModal } from '@/components/dashboard/edit-post-modal';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Post {
  _id: string;
  content: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  mediaUrls: string[];
  scheduledAt?: string;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { activeWorkspaceId, workspaces } = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState('all');
  
  // Modal states
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const activeWorkspace = workspaces.find((w) => w._id === activeWorkspaceId);
  const userRole = activeWorkspace?.members.find((m) => m.userId === user?._id)?.role;
  const isViewer = userRole === 'viewer';

  const { data: posts = [], isLoading, isError, refetch } = useQuery<Post[]>({
    queryKey: ['posts', activeWorkspaceId],
    queryFn: async () => {
      if (!activeWorkspaceId) return [];
      const res = await api.get(`/posts?workspaceId=${activeWorkspaceId}`);
      return res.data;
    },
    enabled: !!activeWorkspaceId,
    refetchInterval: 3000, 
  });

  const filteredPosts = posts.filter((post) => {
    if (activeTab === 'all') return true;
    return post.status === activeTab;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-500 hover:bg-green-600">Published</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Scheduled</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      await api.delete(`/posts/${postId}`);
      toast.success('Post deleted successfully');
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete post');
      console.error('Failed to delete post', error);
    }
  };

  const openScheduleModal = (post: Post) => {
    setSelectedPost(post);
    setScheduleModalOpen(true);
  };

  const openEditModal = (post: Post) => {
    setSelectedPost(post);
    setEditModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Posts</h1>
          <p className="text-muted-foreground">
            Manage and schedule your social media content.
          </p>
        </div>
        {!isViewer && (
          <CreatePostModal onSuccess={() => refetch()} />
        )}
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Posts</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>

        <div className="mt-4 border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Content</TableHead>
                <TableHead>Media</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled Date</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    Loading posts...
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-destructive">
                    Failed to load posts. Please try refreshing the page.
                  </TableCell>
                </TableRow>
              ) : filteredPosts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    No posts found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPosts.map((post) => (
                  <TableRow key={post._id}>
                    <TableCell className="max-w-[300px] truncate">
                      {post.content || <span className="italic text-muted-foreground">No text content</span>}
                    </TableCell>
                    <TableCell>
                      {post.mediaUrls.length > 0 ? (
                        <span className="text-xs bg-muted px-2 py-1 rounded-md">
                          {post.mediaUrls.length} file(s)
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(post.status)}</TableCell>
                    <TableCell>
                      {post.scheduledAt
                        ? format(new Date(post.scheduledAt), 'MMM d, yyyy HH:mm')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {}}>View Details</DropdownMenuItem>
                          {!isViewer && (
                            <>
                              {post.status === 'draft' && (
                                <>
                                  <DropdownMenuItem onClick={() => openScheduleModal(post)}>
                                    Schedule Post
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openEditModal(post)}>
                                    Edit Post
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDelete(post._id)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Tabs>

      <SchedulePostModal 
        post={selectedPost} 
        open={scheduleModalOpen} 
        onOpenChange={setScheduleModalOpen}
        onSuccess={() => refetch()}
      />
      <EditPostModal 
        post={selectedPost} 
        open={editModalOpen} 
        onOpenChange={setEditModalOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
