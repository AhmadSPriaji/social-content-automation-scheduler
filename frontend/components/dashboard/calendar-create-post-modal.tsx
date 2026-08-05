'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace';
import { toast } from 'sonner';
import { format } from 'date-fns';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';

const postSchema = z.object({
  title: z.string().min(1, 'Judul post wajib diisi').max(100, 'Maksimal 100 karakter'),
  content: z.string().optional(),
  time: z.string().optional(),
});

type PostFormValues = z.infer<typeof postSchema>;

interface CalendarCreatePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  onSuccess?: () => void;
}

export function CalendarCreatePostModal({ open, onOpenChange, selectedDate, onSuccess }: CalendarCreatePostModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedMediaUrls, setUploadedMediaUrls] = useState<string[]>([]);
  
  const { activeWorkspaceId } = useWorkspaceStore();

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: '',
      content: '',
      time: '12:00',
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/posts/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
          setUploadProgress(percentCompleted);
        },
      });

      setUploadedMediaUrls((prev) => [...prev, response.data.url]);
      toast.success('Media uploaded successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload media');
      console.error('Upload media error:', error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      event.target.value = '';
    }
  };

  async function onSubmit(data: PostFormValues) {
    if (!activeWorkspaceId) {
      toast.error('No active workspace selected');
      return;
    }

    if (!data.content && uploadedMediaUrls.length === 0) {
      toast.error('Post must have content or media');
      return;
    }
    
    let scheduledAtDate: Date | null = null;
    if (selectedDate && data.time) {
      const [hours, minutes] = data.time.split(':').map(Number);
      scheduledAtDate = new Date(selectedDate);
      scheduledAtDate.setHours(hours, minutes, 0, 0);

      if (scheduledAtDate <= new Date()) {
        toast.error('Scheduled time must be in the future.');
        return;
      }
    }

    setIsLoading(true);
    try {
      // 1. Create Post
      const payload: any = {
        workspaceId: activeWorkspaceId,
        title: data.title,
        content: data.content,
        mediaUrls: uploadedMediaUrls,
      };
      
      if (scheduledAtDate) {
        payload.scheduledAt = scheduledAtDate.toISOString();
      }

      const res = await api.post('/posts', payload);
      const postId = res.data._id || res.data.id;

      if (postId && scheduledAtDate) {
        // 2. Schedule Post
        await api.post(`/posts/${postId}/schedule`);
        toast.success('Post created and scheduled successfully');
      } else {
         toast.success('Draft created successfully');
      }

      onOpenChange(false);
      form.reset();
      setUploadedMediaUrls([]);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create and schedule post');
      console.error('Create post error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) {
        form.reset();
        setUploadedMediaUrls([]);
      }
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{selectedDate ? `Schedule Post for ${format(selectedDate, 'MMM d, yyyy')}` : 'Create Draft'}</DialogTitle>
          <DialogDescription>
            {selectedDate ? 'Compose your post, upload media, and set the time. It will be scheduled immediately.' : 'Compose your post and save it as a draft.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Post Title"
              {...form.register('title')}
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              placeholder="What do you want to share?"
              className="min-h-[120px] resize-none"
              {...form.register('content')}
            />
          </div>
          
          {selectedDate && (
            <div className="space-y-2">
              <Label htmlFor="time">Time (HH:mm)</Label>
              <Input
                id="time"
                type="time"
                {...form.register('time')}
              />
              {form.formState.errors.time && (
                 <p className="text-sm text-destructive">{form.formState.errors.time.message}</p>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="media">Media (Images)</Label>
              <Input
                id="media"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
            </div>
            
            {isUploading && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {uploadedMediaUrls.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {uploadedMediaUrls.map((url, i) => (
                  <div key={i} className="relative h-20 w-20 rounded-md overflow-hidden border">
                    <img src={url.startsWith('http') ? url : `http://localhost:5000${url}`} alt="Uploaded media" className="object-cover w-full h-full" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isLoading || isUploading}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading || isUploading}>
              {isLoading ? 'Saving...' : (selectedDate ? 'Schedule Post' : 'Save Draft')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
