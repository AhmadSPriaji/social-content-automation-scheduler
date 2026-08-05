'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { toast } from 'sonner';

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

const editPostSchema = z.object({
  title: z.string().min(1, 'Judul post wajib diisi').max(100, 'Maksimal 100 karakter'),
  content: z.string().optional(),
});

type EditPostFormValues = z.infer<typeof editPostSchema>;

interface EditPostModalProps {
  post: { _id: string; title?: string; content?: string; mediaUrls: string[] } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditPostModal({ post, open, onOpenChange, onSuccess }: EditPostModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedMediaUrls, setUploadedMediaUrls] = useState<string[]>([]);

  const form = useForm<EditPostFormValues>({
    resolver: zodResolver(editPostSchema),
    defaultValues: {
      title: '',
      content: '',
    },
  });

  // Populate form when modal opens with a valid post
  useEffect(() => {
    if (post && open) {
      form.reset({ title: post.title || '', content: post.content || '' });
      setUploadedMediaUrls(post.mediaUrls || []);
    }
  }, [post, open, form]);

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

  const removeMedia = (indexToRemove: number) => {
    setUploadedMediaUrls(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  async function onSubmit(data: EditPostFormValues) {
    if (!post) return;
    if (!data.content && uploadedMediaUrls.length === 0) {
      toast.error('Post must have content or media');
      return;
    }

    setIsLoading(true);
    try {
      await api.put(`/posts/${post._id}`, {
        title: data.title,
        content: data.content,
        mediaUrls: uploadedMediaUrls,
      });

      toast.success('Post updated successfully');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update post');
      console.error('Update post error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Post</DialogTitle>
          <DialogDescription>
            Make changes to your draft before scheduling.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              placeholder="Post Title"
              {...form.register('title')}
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-content">Content</Label>
            <Textarea
              id="edit-content"
              placeholder="What do you want to share?"
              className="min-h-[120px] resize-none"
              {...form.register('content')}
            />
          </div>

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
                  <div key={i} className="relative h-20 w-20 rounded-md overflow-hidden border group">
                    <img src={url.startsWith('http') ? url : `http://localhost:5000${url}`} alt="media" className="object-cover w-full h-full" />
                    <button 
                      type="button"
                      onClick={() => removeMedia(i)}
                      className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs"
                    >
                      Remove
                    </button>
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
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
