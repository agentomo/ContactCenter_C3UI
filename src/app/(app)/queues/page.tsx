
'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { getActiveQueues } from '@/app/actions';
import type { QueueBasicData } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCw, Building, LayoutList, Filter } from 'lucide-react'; // Added Filter icon
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Added Select imports

interface Division {
  id: string;
  name: string;
}

export default function QueuesPage() {
  const [allQueueData, setAllQueueData] = useState<QueueBasicData[]>([]);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('all');
  const [isPending, startTransition] = useTransition();
  const { toast, dismiss } = useToast();

  const fetchQueueData = () => {
    startTransition(async () => {
      let toastId: string | undefined;
      try {
        const loadingToast = toast({
          title: "Fetching Queue Data",
          description: "Please wait...",
          duration: Infinity, 
        });
        toastId = loadingToast.id;
        console.log("[QueuesPage] Fetching queue list (all parameters removed)...");

        const data = await getActiveQueues();
        console.log("[QueuesPage] Data received from getActiveQueues:", JSON.stringify(data, null, 2));

        if (toastId) dismiss(toastId);

        if (data.length === 0) {
          console.warn("[QueuesPage] getActiveQueues returned an empty array. Displaying 'No Queue Data'.");
          toast({
            title: "No Queues Found",
            description: "The Genesys Cloud API returned no queues. This could be due to no queues being configured, or the application's OAuth client lacking necessary permissions or division access in Genesys Cloud.",
            variant: "default",
            duration: 10000,
          });
        } else {
          toast({
            title: "Queue List Refreshed",
            description: `Successfully fetched ${data.length} queues.`,
            duration: 3000,
          });
        }
        setAllQueueData(data);
      } catch (error: any) {
        console.error('[QueuesPage] Failed to fetch queue data:', error);
        if (toastId) dismiss(toastId);
        toast({
          title: "Queue Data Fetch Error",
          description: error.message || "Could not fetch queue data from Genesys Cloud. Please try again or check server logs.",
          variant: "destructive",
          duration: 10000,
        });
        setAllQueueData([]); 
      }
    });
  };

  useEffect(() => {
    fetchQueueData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const divisions = useMemo(() => {
    const allDivs: Division[] = [];
    const uniqueDivIds = new Set<string>();

    allQueueData.forEach(queue => {
      if (queue.divisionId && queue.divisionName && !uniqueDivIds.has(queue.divisionId)) {
        uniqueDivIds.add(queue.divisionId);
        allDivs.push({ id: queue.divisionId, name: queue.divisionName });
      } else if (!queue.divisionId && !uniqueDivIds.has('none')) { // Handle queues with no division
        // To avoid 'none' appearing multiple times if many queues have no division
      }
    });
    // Sort divisions alphabetically, ensuring "All Divisions" is always first.
    // "No Division Specified" can be sorted with others or placed specifically if needed.
    const sortedDivs = allDivs.sort((a, b) => a.name.localeCompare(b.name));
    
    const result = [{ id: 'all', name: 'All Divisions' }];
    if (allQueueData.some(q => !q.divisionId)) { // Add "No Division" option if relevant
        result.push({ id: 'no-division', name: 'No Division Assigned' });
    }
    result.push(...sortedDivs);
    return result;

  }, [allQueueData]);

  const filteredQueueData = useMemo(() => {
    if (selectedDivisionId === 'all') {
      return allQueueData;
    }
    if (selectedDivisionId === 'no-division') {
        return allQueueData.filter(queue => !queue.divisionId);
    }
    return allQueueData.filter(queue => queue.divisionId === selectedDivisionId);
  }, [allQueueData, selectedDivisionId]);


  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex flex-col items-center selection:bg-primary/30 selection:text-primary-foreground">
      <header className="w-full max-w-6xl mb-8 text-center">
        <div className="flex items-center justify-center mb-4" role="banner">
          <LayoutList className="w-12 h-12 mr-3 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary tracking-tight">
            Queues
          </h1>
        </div>
        <p className="text-md sm:text-lg text-muted-foreground font-body max-w-2xl mx-auto">
          View a list of queues in your Genesys Cloud organization. Filter by division.
        </p>
      </header>

      <div className="w-full max-w-6xl mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="w-full sm:w-auto sm:max-w-xs">
          <Select value={selectedDivisionId} onValueChange={setSelectedDivisionId} disabled={isPending || divisions.length <=1}>
            <SelectTrigger className="h-11" aria-label="Filter by division">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Filter by division..." />
            </SelectTrigger>
            <SelectContent>
              {divisions.map((division) => (
                <SelectItem key={division.id} value={division.id}>
                  {division.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={fetchQueueData} disabled={isPending} variant="default" size="lg" className="w-full sm:w-auto">
          <RefreshCw className={`mr-2 h-5 w-5 ${isPending ? 'animate-spin' : ''}`} />
          {isPending ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </div>

      {isPending && filteredQueueData.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
          {[...Array(6)].map((_, i) => (
            <Card key={`skel-queue-${i}`} className="shadow-lg">
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-1" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <Skeleton className="h-5 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !isPending && filteredQueueData.length === 0 ? (
        <Card className="w-full max-w-xl mx-auto mt-10 shadow-lg bg-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-primary">No Queues Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              {selectedDivisionId === 'all' 
                ? "No queues were found in your Genesys Cloud organization."
                : `No queues found for the selected division.`
              }
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Please ensure queues are configured and that the application's OAuth client has the necessary permissions (e.g., `routing:queue:view`) and division access in Genesys Cloud.
            </p>
             <p className="text-xs text-muted-foreground mt-4">
              Check client-side console (Developer Tools) and server-side logs for more details from the API.
            </p>
          </CardContent>
        </Card>
      ) : (
        <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
          {filteredQueueData.map((queue) => (
            <Card key={queue.id} className="shadow-lg flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl font-semibold text-primary truncate" title={queue.name}>
                  {queue.name}
                </CardTitle>
                {queue.divisionName && (
                  <CardDescription className="flex items-center text-xs pt-1">
                    <Building className="w-3 h-3 mr-1.5 text-muted-foreground/80" /> 
                    {queue.divisionName}
                  </CardDescription>
                )}
                 {!queue.divisionName && (
                     <CardDescription className="flex items-center text-xs pt-1 italic">
                        No division specified
                    </CardDescription>
                 )}
              </CardHeader>
              <CardContent className="pt-2">
                <p className="text-xs text-muted-foreground">Queue ID: {queue.id}</p>
              </CardContent>
            </Card>
          ))}
        </main>
      )}
    </div>
  );
}
