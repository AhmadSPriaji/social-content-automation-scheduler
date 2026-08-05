'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { CreatePostModal } from '@/components/dashboard/create-post-modal';
import { SchedulePostModal } from '@/components/dashboard/schedule-post-modal';
import { EditPostModal } from '@/components/dashboard/edit-post-modal';
import { ViewPostModal } from '@/components/dashboard/view-post-modal';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button';
import { 
  MoreHorizontal, 
  AlertCircle, 
  Eye, 
  Pencil, 
  Calendar, 
  Send, 
  Copy, 
  XCircle, 
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Post {
  _id: string;
  title: string;
  content: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  mediaUrls: string[];
  scheduledAt?: string;
  errorReason?: string;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { activeWorkspaceId, workspaces } = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: 'title' | 'scheduledAt' | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
  const queryClient = useQueryClient();

  // Real-time SSE connection for post updates
  useEffect(() => {
    if (!activeWorkspaceId) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const eventSource = new EventSource(`${apiUrl}/posts/events`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'post_updated') {
          queryClient.invalidateQueries({ queryKey: ['posts', activeWorkspaceId] });
          toast.info(`A post was updated to ${payload.data.status}`);
        }
      } catch (err) {
        console.error('Error parsing SSE data', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [activeWorkspaceId, queryClient]);

  // Modal states
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel: string;
    actionVariant: 'default' | 'destructive';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    actionLabel: '',
    actionVariant: 'default',
    onConfirm: () => {},
  });

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
  });

  const filteredPosts = posts.filter((post) => {
    if (activeTab === 'all') return true;
    return post.status === activeTab;
  }).sort((a, b) => {
    if (!sortConfig.key) return 0;
    
    if (sortConfig.key === 'title') {
      const titleA = a.title?.toLowerCase() || '';
      const titleB = b.title?.toLowerCase() || '';
      if (titleA < titleB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (titleA > titleB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    }
    
    if (sortConfig.key === 'scheduledAt') {
      const dateA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const dateB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
    }
    
    return 0;
  });

  const requestSort = (key: 'title' | 'scheduledAt') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: 'title' | 'scheduledAt') => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4" /> 
      : <ArrowDown className="ml-2 h-4 w-4" />;
  };

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

  const confirmDelete = (postId: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Post',
      description: 'Are you sure you want to delete this post? This action cannot be undone.',
      actionLabel: 'Delete',
      actionVariant: 'destructive',
      onConfirm: async () => {
        try {
          await api.delete(`/posts/${postId}`);
          toast.success('Post deleted successfully');
          refetch();
        } catch (error: any) {
          toast.error(error.response?.data?.message || 'Failed to delete post');
        }
      },
    });
  };

  const confirmCancelSchedule = (postId: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Cancel Schedule',
      description: 'Are you sure you want to cancel the schedule for this post? It will revert to a draft.',
      actionLabel: 'Confirm',
      actionVariant: 'default',
      onConfirm: async () => {
        try {
          await api.post(`/posts/${postId}/cancel-schedule`);
          toast.success('Schedule cancelled successfully');
          refetch();
        } catch (error: any) {
          toast.error(error.response?.data?.message || 'Failed to cancel schedule');
        }
      },
    });
  };

  const confirmPublishNow = (postId: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Publish Now',
      description: 'Are you sure you want to publish this post immediately?',
      actionLabel: 'Publish',
      actionVariant: 'default',
      onConfirm: async () => {
        try {
          await api.post(`/posts/${postId}/publish-now`);
          toast.success('Post submitted for immediate publication');
          refetch();
        } catch (error: any) {
          toast.error(error.response?.data?.message || 'Failed to publish post');
        }
      },
    });
  };

  const handleDuplicate = async (postId: string) => {
    try {
      await api.post(`/posts/${postId}/duplicate`);
      toast.success('Post duplicated successfully');
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to duplicate post');
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

  const openViewModal = (post: Post) => {
    setSelectedPost(post);
    setViewModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full overflow-hidden">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto py-2 px-1">
          <TabsTrigger value="all" className="whitespace-nowrap">All Posts</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>

        <div className="mt-4 border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => requestSort('title')} className="-ml-3 h-8 data-[state=open]:bg-accent">
                    Title {getSortIcon('title')}
                  </Button>
                </TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Media</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => requestSort('scheduledAt')} className="-ml-3 h-8 data-[state=open]:bg-accent">
                    Scheduled Date {getSortIcon('scheduledAt')}
                  </Button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-full max-w-[250px]" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[80px] rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-destructive">
                    Failed to load posts. Please try refreshing the page.
                  </TableCell>
                </TableRow>
              ) : filteredPosts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2">
                      <span className="text-sm">No posts found for this status.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPosts.map((post) => (
                  <TableRow key={post._id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {post.title}
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate text-muted-foreground">
                      {post.content || <span className="italic">No text content</span>}
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
                    <TableCell>
                      {post.status === 'failed' && post.errorReason ? (
                        <div className="flex items-center gap-2">
                          {getStatusBadge(post.status)}
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex items-center justify-center h-5 cursor-help text-muted-foreground hover:text-destructive transition-colors">
                                <AlertCircle className="h-4 w-4" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              align="center"
                              className="max-w-[250px]"
                            >
                              <p className="text-sm">{post.errorReason}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      ) : (
                        getStatusBadge(post.status)
                      )}
                    </TableCell>
                    <TableCell>
                      {post.scheduledAt
                        ? format(new Date(post.scheduledAt), 'MMM d, yyyy HH:mm')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger 
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8" 
                            onClick={() => openViewModal(post)}
                          >
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <span className="sr-only">View Details</span>
                          </TooltipTrigger>
                          <TooltipContent>View Details</TooltipContent>
                        </Tooltip>

                        {!isViewer && (
                          <>
                            {(post.status === 'draft' || post.status === 'failed') && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger 
                                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8" 
                                    onClick={() => openEditModal(post)}
                                  >
                                    <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                    <span className="sr-only">Edit Post</span>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit Post</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger 
                                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8" 
                                    onClick={() => openScheduleModal(post)}
                                  >
                                    <Calendar className="h-4 w-4 text-muted-foreground hover:text-blue-500" />
                                    <span className="sr-only">Schedule Post</span>
                                  </TooltipTrigger>
                                  <TooltipContent>Schedule Post</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger 
                                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8" 
                                    onClick={() => confirmPublishNow(post._id)}
                                  >
                                    <Send className="h-4 w-4 text-muted-foreground hover:text-green-500" />
                                    <span className="sr-only">Publish Now</span>
                                  </TooltipTrigger>
                                  <TooltipContent>Publish Now</TooltipContent>
                                </Tooltip>
                              </>
                            )}

                            {post.status === 'scheduled' && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger 
                                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8" 
                                    onClick={() => openScheduleModal(post)}
                                  >
                                    <Calendar className="h-4 w-4 text-muted-foreground hover:text-blue-500" />
                                    <span className="sr-only">Reschedule Post</span>
                                  </TooltipTrigger>
                                  <TooltipContent>Reschedule Post</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger 
                                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8" 
                                    onClick={() => confirmCancelSchedule(post._id)}
                                  >
                                    <XCircle className="h-4 w-4 text-muted-foreground hover:text-orange-500" />
                                    <span className="sr-only">Cancel Schedule</span>
                                  </TooltipTrigger>
                                  <TooltipContent>Cancel Schedule</TooltipContent>
                                </Tooltip>
                              </>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'h-8 w-8' })}>
                                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                <span className="sr-only">More Options</span>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleDuplicate(post._id)}>
                                  <Copy className="h-4 w-4 mr-2 text-muted-foreground" />
                                  Duplicate Post
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => confirmDelete(post._id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        )}
                      </div>
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
      <ViewPostModal
        post={selectedPost}
        open={viewModalOpen}
        onOpenChange={setViewModalOpen}
      />

      <AlertDialog 
        open={confirmState.isOpen} 
        onOpenChange={(isOpen) => setConfirmState(prev => ({ ...prev, isOpen }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                confirmState.onConfirm();
                setConfirmState(prev => ({ ...prev, isOpen: false }));
              }}
              className={confirmState.actionVariant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {confirmState.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
