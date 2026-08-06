'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Plus, Sparkles } from 'lucide-react';

const postSchema = z.object({
  title: z.string().min(1, 'Judul post wajib diisi').max(100, 'Maksimal 100 karakter'),
  content: z.string().optional(),
});

type PostFormValues = z.infer<typeof postSchema>;

interface CreatePostModalProps {
  onSuccess?: () => void;
}

export function CreatePostModal({ onSuccess }: CreatePostModalProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [uploadedMediaUrls, setUploadedMediaUrls] = useState<string[]>([]);
  
  const { activeWorkspaceId } = useWorkspaceStore();

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: '',
      content: '',
    },
  });

  const handleGenerateCaption = async () => {
    const title = form.getValues('title');
    if (!title) {
      toast.error('Please enter a title first to generate a caption');
      return;
    }

    setIsGeneratingAi(true);
    try {
      const response = await api.post('/posts/generate-caption', { prompt: title });
      if (response.data?.caption) {
        const currentContent = form.getValues('content') || '';
        form.setValue('content', currentContent ? `${currentContent}\n\n${response.data.caption}` : response.data.caption);
        toast.success('Caption generated successfully');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to generate caption');
    } finally {
      setIsGeneratingAi(false);
    }
  };

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

      // Assuming backend returns { url: '...' }
      setUploadedMediaUrls((prev) => [...prev, response.data.url]);
      toast.success('Media uploaded successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload media');
      console.error('Upload media error:', error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset input
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

    setIsLoading(true);
    try {
      await api.post('/posts', {
        workspaceId: activeWorkspaceId,
        title: data.title,
        content: data.content,
        mediaUrls: uploadedMediaUrls,
      });

      toast.success('Draft created successfully');
      setOpen(false);
      form.reset();
      setUploadedMediaUrls([]);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create post');
      console.error('Create post error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
        <Plus className="h-4 w-4" />
        Create Post
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Post</DialogTitle>
          <DialogDescription>
            Compose your post and upload media. It will be saved as a draft.
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
            <div className="flex items-center justify-between">
              <Label htmlFor="content">Content</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                onClick={handleGenerateCaption}
                disabled={isGeneratingAi}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                {isGeneratingAi ? 'Generating...' : 'AI Caption'}
              </Button>
            </div>
            <Textarea
              id="content"
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
                  <div key={i} className="relative h-20 w-20 rounded-md overflow-hidden border">
                    <img src={url.startsWith('http') ? url : `http://localhost:5000${url}`} alt="Uploaded media" className="object-cover w-full h-full" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={isLoading || isUploading || isGeneratingAi}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading || isUploading}>
              {isLoading ? 'Saving...' : 'Save Draft'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
