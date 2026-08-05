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
}

export function ViewPostModal({ post, open, onOpenChange }: ViewPostModalProps) {
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
        <DialogHeader>
          <DialogTitle>Post Details</DialogTitle>
          <DialogDescription>
            Detailed view of your post and its performance.
          </DialogDescription>
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
