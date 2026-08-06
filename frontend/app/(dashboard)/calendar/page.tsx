'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { CalendarCreatePostModal } from '@/components/dashboard/calendar-create-post-modal';
import { ViewPostModal } from '@/components/dashboard/view-post-modal';
import { SchedulePostModal } from '@/components/dashboard/schedule-post-modal';
import { EditPostModal } from '@/components/dashboard/edit-post-modal';
import { toast } from 'sonner';
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
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface Post {
  _id: string;
  title: string;
  content: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  mediaUrls: string[];
  scheduledAt?: string;
  errorReason?: string;
}

export default function CalendarPage() {
  const { user } = useAuthStore();
  const { activeWorkspaceId, workspaces } = useWorkspaceStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [isSidebarDragOver, setIsSidebarDragOver] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const queryClient = useQueryClient();

  // Real-time SSE connection for post updates
  useEffect(() => {
    if (!activeWorkspaceId) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const eventSource = new EventSource(`${apiUrl}/posts/events`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (['post_updated', 'post_created', 'post_deleted'].includes(payload.event)) {
          queryClient.invalidateQueries({ queryKey: ['posts', activeWorkspaceId] });
          if (payload.event === 'post_updated') {
            toast.info(`A post was updated by another user`);
          } else if (payload.event === 'post_created') {
            toast.info(`A new post was created`);
          } else if (payload.event === 'post_deleted') {
            toast.info(`A post was deleted`);
          }
        }
      } catch (err) {
        console.error('Error parsing SSE data', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [activeWorkspaceId, queryClient]);

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
  const userRole = activeWorkspace?.members.find((m) => m.userId === user?.id)?.role;
  const isViewer = userRole === 'viewer';

  const { data: posts = [], isLoading, refetch } = useQuery<Post[]>({
    queryKey: ['posts', activeWorkspaceId],
    queryFn: async () => {
      if (!activeWorkspaceId) return [];
      const res = await api.get(`/posts?workspaceId=${activeWorkspaceId}`);
      return res.data;
    },
    enabled: !!activeWorkspaceId,
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const today = () => setCurrentMonth(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const unscheduledPosts = posts.filter(p => p.status === 'draft' && !p.scheduledAt);

  const handleDayClick = (day: Date) => {
    if (isViewer) return;
    setSelectedDate(day);
    setCreateModalOpen(true);
  };

  const handlePostClick = (e: React.MouseEvent, post: Post) => {
    e.stopPropagation();
    setSelectedPost(post);
    setViewModalOpen(true);
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

  const handleDrop = async (e: React.DragEvent, targetDay: Date) => {
    e.preventDefault();
    setDragOverDay(null);
    const postId = e.dataTransfer.getData('postId');
    const isUnscheduled = e.dataTransfer.getData('isUnscheduled') === 'true';
    if (!postId) return;

    if (isBefore(targetDay, startOfDay(new Date()))) {
      toast.error('Cannot schedule post in the past');
      return;
    }

    const post = posts.find(p => p._id === postId);
    if (!post || post.status === 'published') return;

    if (isUnscheduled) {
      setSelectedDate(targetDay);
      setSelectedPost(post);
      setScheduleModalOpen(true);
      return;
    }

    if (!post.scheduledAt) return;

    const oldDate = new Date(post.scheduledAt);
    const newDate = new Date(targetDay);
    newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), 0, 0);

    if (isBefore(newDate, new Date())) {
      toast.error('Scheduled time cannot be in the past');
      return;
    }

    // Optimistically hide the dragover just in case
    setDragOverDay(null);
    
    try {
      await api.put(`/posts/${postId}`, { scheduledAt: newDate.toISOString() });
      if (post.status === 'scheduled' || post.status === 'failed' || post.status === 'draft') {
        await api.post(`/posts/${postId}/schedule`);
      }
      toast.success('Post rescheduled successfully');
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reschedule post');
    }
  };

  const handleSidebarDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsSidebarDragOver(false);
    const postId = e.dataTransfer.getData('postId');
    const isUnscheduled = e.dataTransfer.getData('isUnscheduled') === 'true';
    if (!postId || isUnscheduled) return;

    try {
      await api.post(`/posts/${postId}/cancel-schedule`);
      toast.success('Schedule cancelled, moved to drafts');
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to cancel schedule');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-500 hover:bg-green-600 text-white';
      case 'scheduled':
        return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 'failed':
        return 'bg-red-500 hover:bg-red-600 text-white';
      default:
        return 'bg-secondary hover:bg-secondary/80 text-secondary-foreground';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] w-full gap-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content Calendar</h1>
          <p className="text-muted-foreground">
            Schedule and manage your posts in a monthly view.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={showSidebar ? "secondary" : "outline"} 
            onClick={() => setShowSidebar(!showSidebar)}
            className="hidden lg:flex"
            title="Toggle Drafts Sidebar"
          >
            {showSidebar ? 'Hide Drafts' : 'Show Drafts'}
          </Button>
          <Button variant="outline" onClick={today}>
            Today
          </Button>
          <div className="flex items-center border rounded-md">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="rounded-r-none h-9 w-9">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-4 py-2 font-medium min-w-[140px] text-center text-sm">
              {format(currentMonth, 'MMMM yyyy')}
            </div>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-l-none h-9 w-9">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 flex flex-col min-h-0 border rounded-xl overflow-hidden bg-background shadow-sm">
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="py-3 text-center text-sm font-semibold text-muted-foreground">
                {day}
              </div>
            ))}
          </div>
          
          <div 
            className="flex-1 grid grid-cols-7 overflow-hidden"
          style={{ gridTemplateRows: `repeat(${calendarDays.length / 7}, minmax(0, 1fr))` }}
        >
          {calendarDays.map((day, i) => {
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isTodayDate = isToday(day);
            
            // Get posts for this day
            const dayPosts = posts.filter(p => {
              if (!p.scheduledAt) return false;
              return isSameDay(new Date(p.scheduledAt), day);
            }).sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());

            return (
              <div
                key={day.toString()}
                onClick={() => handleDayClick(day)}
                onDragOver={(e) => {
                  e.preventDefault();
                  // Only allow drop if it's not a viewer
                  if (!isViewer) {
                    e.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  if (!isViewer) setDragOverDay(day.toString());
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  if (dragOverDay === day.toString()) {
                    setDragOverDay(null);
                  }
                }}
                onDrop={(e) => {
                  if (!isViewer) handleDrop(e, day);
                }}
                className={cn(
                  "p-1 border-b border-r transition-colors flex flex-col gap-1 relative group overflow-hidden min-h-0",
                  !isCurrentMonth && "bg-muted/20 text-muted-foreground",
                  !isViewer && "hover:bg-accent/50 cursor-pointer",
                  i % 7 === 6 && "border-r-0",
                  dragOverDay === day.toString() && "bg-accent/40 ring-2 ring-primary ring-inset z-10"
                )}
              >
                <div className="flex items-center justify-between px-1 pt-1 shrink-0">
                  <span className={cn(
                    "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                    isTodayDate && "bg-primary text-primary-foreground"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {!isViewer && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Add post"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto flex flex-col gap-1 px-1 pb-1 mt-1 styled-scrollbar">
                  {isLoading ? (
                    isCurrentMonth && i % 5 === 0 && <Skeleton className="h-5 w-full rounded-sm" />
                  ) : (
                    dayPosts.map(post => (
                      <div
                        key={post._id}
                        onClick={(e) => handlePostClick(e, post)}
                        draggable={post.status !== 'published' && !isViewer}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData('postId', post._id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        className={cn(
                          "text-xs px-1.5 py-1 rounded-md truncate transition-opacity flex items-center gap-1 shrink-0",
                          getStatusColor(post.status),
                          post.status !== 'published' && !isViewer ? "cursor-grab active:cursor-grabbing" : "cursor-pointer hover:opacity-80",
                          post.status !== 'published' && !isViewer && "hover:opacity-90"
                        )}
                        title={`${format(new Date(post.scheduledAt!), 'HH:mm')} - ${post.title}`}
                      >
                        <span className="font-semibold opacity-80 shrink-0">
                          {format(new Date(post.scheduledAt!), 'HH:mm')}
                        </span>
                        <span className="truncate">
                          {post.title}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
            })}
          </div>
        </div>
        
        <div 
          className={cn(
            "w-64 flex-shrink-0 flex flex-col border rounded-xl bg-background overflow-hidden shadow-sm transition-colors",
            showSidebar ? "hidden lg:flex" : "hidden",
            isSidebarDragOver && "bg-accent/40 ring-2 ring-primary ring-inset z-10"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            if (!isViewer) e.dataTransfer.dropEffect = 'move';
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            if (!isViewer) setIsSidebarDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsSidebarDragOver(false);
          }}
          onDrop={(e) => {
            if (!isViewer) handleSidebarDrop(e);
          }}
        >
          <div className="p-4 border-b bg-muted/30 flex items-center justify-between pointer-events-auto">
            <div>
              <h2 className="font-semibold text-sm">Unscheduled Posts</h2>
              <p className="text-xs text-muted-foreground mt-1">Drag to calendar to schedule</p>
            </div>
            {!isViewer && (
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  setSelectedDate(null);
                  setCreateModalOpen(true);
                }}
                title="Create draft"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 styled-scrollbar">
            {isLoading ? (
               <Skeleton className="h-16 w-full rounded-md" />
            ) : unscheduledPosts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center mt-4">No unscheduled posts</p>
            ) : (
              unscheduledPosts.map(post => (
                <div
                  key={post._id}
                  draggable={!isViewer}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData('postId', post._id);
                    e.dataTransfer.setData('isUnscheduled', 'true');
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={(e) => handlePostClick(e, post)}
                  className={cn(
                    "p-2 rounded-md border text-sm transition-colors bg-card",
                    !isViewer ? "cursor-grab active:cursor-grabbing hover:border-primary" : "cursor-pointer",
                    post.status === 'failed' && "border-red-200 bg-red-50 dark:bg-red-950/20"
                  )}
                >
                  <div className="font-medium line-clamp-2">{post.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                    {post.status === 'failed' ? (
                      <span className="text-red-500 font-medium">Failed</span>
                    ) : (
                      <span>Draft</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <CalendarCreatePostModal 
        open={createModalOpen} 
        onOpenChange={setCreateModalOpen} 
        selectedDate={selectedDate}
        onSuccess={() => refetch()}
      />

      <SchedulePostModal
        post={selectedPost}
        open={scheduleModalOpen}
        onOpenChange={setScheduleModalOpen}
        onSuccess={() => refetch()}
        prefillDate={selectedDate}
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
        onEdit={openEditModal}
        onSchedule={openScheduleModal}
        onPublishNow={confirmPublishNow}
        onCancelSchedule={confirmCancelSchedule}
        onDuplicate={handleDuplicate}
        onDelete={confirmDelete}
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
      
      <style dangerouslySetInnerHTML={{__html: `
        .styled-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .styled-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .styled-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--muted-foreground) / 0.3);
          border-radius: 4px;
        }
      `}} />
    </div>
  );
}
