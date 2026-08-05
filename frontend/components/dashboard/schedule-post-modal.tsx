'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { format } from 'date-fns';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SchedulePostModalProps {
  post: { _id: string; content?: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  prefillDate?: Date | null;
}

export function SchedulePostModal({ post, open, onOpenChange, onSuccess, prefillDate }: SchedulePostModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');

  useEffect(() => {
    if (open) {
      if (prefillDate) {
        // Set time to 12:00 by default for pre-filled dates
        const prefill = new Date(prefillDate);
        prefill.setHours(12, 0, 0, 0);
        setScheduledDate(format(prefill, "yyyy-MM-dd'T'HH:mm"));
      } else {
        setScheduledDate('');
      }
    }
  }, [open, prefillDate]);

  if (!post) return null;

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!post) return;
    if (!scheduledDate) {
      toast.error('Please select a valid date and time.');
      return;
    }

    const selectedDate = new Date(scheduledDate);
    if (selectedDate <= new Date()) {
      toast.error('Scheduled time must be in the future.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Update the post with the scheduled time
      await api.put(`/posts/${post._id}`, {
        scheduledAt: selectedDate.toISOString(),
      });

      // 2. Trigger the scheduling engine job
      await api.post(`/posts/${post._id}/schedule`);

      toast.success('Post scheduled successfully');
      onOpenChange(false);
      setScheduledDate('');
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to schedule post');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule Post</DialogTitle>
          <DialogDescription>
            Choose a date and time to publish this post.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSchedule} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="scheduledAt">Date & Time</Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {isLoading ? 'Scheduling...' : 'Schedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
