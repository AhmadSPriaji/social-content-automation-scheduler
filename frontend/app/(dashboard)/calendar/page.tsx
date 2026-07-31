import { Calendar as CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CalendarPage() {
  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <Card className="w-full max-w-2xl text-center border-dashed shadow-sm">
        <CardHeader>
          <div className="mx-auto bg-muted h-16 w-16 rounded-full flex items-center justify-center mb-4">
            <CalendarIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">Content Calendar</CardTitle>
          <CardDescription className="text-base mt-2">
            A beautiful bird's-eye view of your scheduled social media content is coming soon!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            We are working hard to bring you a drag-and-drop calendar interface to easily manage your posting schedule across all your connected platforms.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
