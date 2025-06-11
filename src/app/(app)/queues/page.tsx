
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { getQueueObservations } from '@/app/actions';
import type { QueueObservationData } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCw, Loader2, Users, MessageCircle, Clock3, Building, LayoutList } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';

export default function QueuesPage() {
  const [queueData, setQueueData] = useState<QueueObservationData[]>([]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const fetchQueueData = () => {
    startTransition(async () => {
      try {
        const data = await getQueueObservations();
        setQueueData(data);
        if (document.hidden) return;
        toast({
          title: "Queue Data Refreshed",
          description: `Successfully updated ${data.length} queues.`,
          duration: 3000,
        });
      } catch (error: any) {
        console.error('Failed to fetch queue data:', error);
        if (document.hidden) return;
        toast({
          title: "Queue Data Refresh Error",
          description: error.message || "Could not fetch queue data. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  useEffect(() => {
    fetchQueueData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderMetric = (label: string, value: number, Icon: React.ElementType, iconColorClass: string = 'text-muted-foreground') => (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-b-0">
      <div className="flex items-center">
        <Icon className={`w-5 h-5 mr-3 ${iconColorClass}`} />
        <span className="text-sm font-medium text-foreground/90">{label}</span>
      </div>
      <span className="text-lg font-semibold text-primary">{value}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex flex-col items-center selection:bg-primary/30 selection:text-primary-foreground">
      <header className="w-full max-w-6xl mb-8 text-center">
        <div className="flex items-center justify-center mb-4" role="banner">
          <LayoutList className="w-12 h-12 mr-3 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary tracking-tight">
            Queue Dashboard
          </h1>
        </div>
        <p className="text-md sm:text-lg text-muted-foreground font-body max-w-2xl mx-auto">
          Monitor real-time activity for your Genesys Cloud queues.
        </p>
      </header>

      <div className="w-full max-w-6xl mb-6 flex justify-end">
        <Button onClick={fetchQueueData} disabled={isPending} variant="default" size="lg">
          <RefreshCw className={`mr-2 h-5 w-5 ${isPending ? 'animate-spin' : ''}`} />
          {isPending ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </div>

      {isPending && queueData.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
          {[...Array(6)].map((_, i) => (
            <Card key={`skel-queue-${i}`} className="shadow-lg">
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-1" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !isPending && queueData.length === 0 ? (
        <Card className="w-full max-w-xl mx-auto mt-10 shadow-lg bg-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-primary">No Queue Data Available</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              No active queues with observation data were found in your Genesys Cloud organization.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Please ensure there are active queues configured, that they have recent activity (if expecting non-zero metrics),
              and that the application has the necessary permissions to view queue data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
          {queueData.map((queue) => (
            <Card key={queue.id} className="shadow-lg flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl font-semibold text-primary truncate" title={queue.name}>
                  {queue.name}
                </CardTitle>
                {queue.divisionName && (
                  <CardDescription className="flex items-center text-xs pt-1">
                    <Building className="w-3 h-3 mr-1.5 text-muted-foreground/80" /> 
                    {queue.divisionName} (ID: {queue.divisionId || 'N/A'})
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-2 space-y-1 flex-grow">
                {renderMetric('Agents On Queue', queue.onQueueUserCount, Users, 'text-blue-500')}
                {renderMetric('Interacting', queue.interactingCount, MessageCircle, 'text-green-500')}
                {renderMetric('Waiting', queue.waitingCount, Clock3, 'text-orange-500')}
              </CardContent>
            </Card>
          ))}
        </main>
      )}
    </div>
  );
}
