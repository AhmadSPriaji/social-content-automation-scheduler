'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreHorizontal, 
  Pencil, 
  Calendar, 
  Send, 
  Copy, 
  XCircle, 
  Trash2
} from 'lucide-react';

interface Post {
  _id: string;
  title: string;
  content: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  mediaUrls: string[];
  scheduledAt?: string;
  errorReason?: string;
}

interface ViewPostModalProps {
  post: Post | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (post: Post) => void;
  onSchedule?: (post: Post) => void;
  onDelete?: (postId: string) => void;
  onCancelSchedule?: (postId: string) => void;
  onPublishNow?: (postId: string) => void;
  onDuplicate?: (postId: string) => void;
}

export function ViewPostModal({ 
  post, 
  open, 
  onOpenChange,
  onEdit,
  onSchedule,
  onDelete,
  onCancelSchedule,
  onPublishNow,
  onDuplicate
}: ViewPostModalProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    if (open && post && post.status === 'published') {
      const fetchAnalytics = async () => {
        setLoadingAnalytics(true);
        try {
          const res = await api.get(`/posts/${post._id}/analytics`);
          setAnalytics(res.data);
        } catch (error) {
          console.error('Failed to fetch analytics', error);
        } finally {
          setLoadingAnalytics(false);
        }
      };
      fetchAnalytics();
    } else {
      setAnalytics(null);
    }
  }, [open, post]);

  if (!post) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-500">Published</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500">Scheduled</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="flex flex-row items-start justify-between pr-6">
          <div>
            <DialogTitle>Post Details</DialogTitle>
            <DialogDescription>
              Detailed view of your post and its performance.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className={buttonVariants({ variant: 'outline', size: 'icon', className: 'h-8 w-8 shrink-0' })}>
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More Options</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(post.status === 'draft' || post.status === 'failed') && onEdit && (
                  <DropdownMenuItem onClick={() => { onOpenChange(false); onEdit(post); }}>
                    <Pencil className="h-4 w-4 mr-2" /> Edit Post
                  </DropdownMenuItem>
                )}
                {(post.status === 'draft' || post.status === 'failed' || post.status === 'scheduled') && onSchedule && (
                  <DropdownMenuItem onClick={() => { onOpenChange(false); onSchedule(post); }}>
                    <Calendar className="h-4 w-4 mr-2" /> 
                    {post.status === 'scheduled' ? 'Reschedule' : 'Schedule Post'}
                  </DropdownMenuItem>
                )}
                {(post.status === 'draft' || post.status === 'failed') && onPublishNow && (
                  <DropdownMenuItem onClick={() => { onOpenChange(false); onPublishNow(post._id); }}>
                    <Send className="h-4 w-4 mr-2" /> Publish Now
                  </DropdownMenuItem>
                )}
                {post.status === 'scheduled' && onCancelSchedule && (
                  <DropdownMenuItem onClick={() => { onOpenChange(false); onCancelSchedule(post._id); }}>
                    <XCircle className="h-4 w-4 mr-2 text-orange-500" /> Cancel Schedule
                  </DropdownMenuItem>
                )}
                {onDuplicate && (
                  <DropdownMenuItem onClick={() => { onOpenChange(false); onDuplicate(post._id); }}>
                    <Copy className="h-4 w-4 mr-2" /> Duplicate Post
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem onClick={() => { onOpenChange(false); onDelete(post._id); }} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] mt-4 pr-4">
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold">{post.title}</h3>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                {getStatusBadge(post.status)}
              </div>
              {post.scheduledAt && (
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {post.status === 'published' ? 'Published At' : 'Scheduled For'}
                  </p>
                  <p className="text-sm font-medium">
                    {format(new Date(post.scheduledAt), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
              )}
            </div>

            {post.status === 'failed' && post.errorReason && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                <span className="font-semibold">Error:</span> {post.errorReason}
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Content</p>
              <div className="bg-muted p-4 rounded-md whitespace-pre-wrap text-sm">
                {post.content || <span className="italic text-muted-foreground">No text content</span>}
              </div>
            </div>

            {post.mediaUrls.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Media</p>
                <div className="grid grid-cols-2 gap-2">
                  {post.mediaUrls.map((url, i) => (
                    // Using img tag since we don't know dimensions, it's just a preview
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      key={i} 
                      src={url.startsWith('http') ? url : `http://localhost:5000${url}`} 
                      alt="Post media" 
                      className="w-full h-32 object-cover rounded-md border"
                    />
                  ))}
                </div>
              </div>
            )}

            {post.status === 'published' && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Analytics</p>
                {loadingAnalytics ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="border p-3 rounded-md">
                        <Skeleton className="h-4 w-12 mb-2" />
                        <Skeleton className="h-6 w-16" />
                      </div>
                    ))}
                  </div>
                ) : analytics ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="border p-3 rounded-md bg-background">
                      <p className="text-xs text-muted-foreground mb-1">Views</p>
                      <p className="text-lg font-bold">{analytics.views}</p>
                    </div>
                    <div className="border p-3 rounded-md bg-background">
                      <p className="text-xs text-muted-foreground mb-1">Likes</p>
                      <p className="text-lg font-bold">{analytics.likes}</p>
                    </div>
                    <div className="border p-3 rounded-md bg-background">
                      <p className="text-xs text-muted-foreground mb-1">Comments</p>
                      <p className="text-lg font-bold">{analytics.comments}</p>
                    </div>
                    <div className="border p-3 rounded-md bg-background">
                      <p className="text-xs text-muted-foreground mb-1">Shares</p>
                      <p className="text-lg font-bold">{analytics.shares}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No analytics available yet.</p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
