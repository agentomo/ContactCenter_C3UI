
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { getEdgesBasicInfo } from '@/app/actions';
import type { EdgeBasic, EdgeOperationalStatus } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { Network, RefreshCw, Server, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const statusVisuals: Record<EdgeOperationalStatus, { icon: JSX.Element; colorClasses: string; text: string }> = {
  Online: { icon: <ShieldCheck className="h-5 w-5" />, colorClasses: 'text-green-600 border-green-500 bg-green-50', text: 'Online' },
  Offline: { icon: <ShieldX className="h-5 w-5" />, colorClasses: 'text-red-600 border-red-500 bg-red-50', text: 'Offline' },
  Degraded: { icon: <ShieldAlert className="h-5 w-5" />, colorClasses: 'text-amber-600 border-amber-500 bg-amber-50', text: 'Degraded' },
  Unknown: { icon: <AlertTriangle className="h-5 w-5" />, colorClasses: 'text-slate-600 border-slate-500 bg-slate-50', text: 'Unknown' },
};

export default function InfrastructurePage() {
  const [edges, setEdges] = useState<EdgeBasic[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const { toast } = useToast();

  const fetchEdgeData = () => {
    startLoadingTransition(async () => {
      try {
        const edgeData = await getEdgesBasicInfo();
        setEdges(edgeData);
        if (edgeData.length === 0) {
            toast({
                title: "No Edges Found",
                description: "No Genesys Cloud Edges were found or the application lacks permissions.",
                variant: "default",
                duration: 7000,
            });
        } else {
             toast({
                title: "Edges Refreshed",
                description: `Successfully fetched status for ${edgeData.length} Edges.`,
                duration: 3000,
            });
        }
      } catch (error: any) {
        console.error('[InfrastructurePage] Failed to fetch Edge data:', error);
        toast({
          title: "Error Fetching Edge Data",
          description: error.message || "Could not retrieve Edge information from Genesys Cloud.",
          variant: "destructive",
        });
        setEdges([]);
      }
    });
  };

  useEffect(() => {
    fetchEdgeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex flex-col items-center selection:bg-primary/30 selection:text-primary-foreground">
      <header className="w-full max-w-6xl mb-8 text-center">
        <div className="flex items-center justify-center mb-4" role="banner">
          <Network className="w-12 h-12 mr-3 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary tracking-tight">
            Telephony Infrastructure Health
          </h1>
        </div>
        <p className="text-md sm:text-lg text-muted-foreground font-body max-w-2xl mx-auto">
          Monitor the status of your Genesys Cloud Edges.
        </p>
      </header>

      <div className="w-full max-w-6xl mb-6 flex justify-end">
        <Button onClick={fetchEdgeData} disabled={isLoading} variant="default" size="lg">
          <RefreshCw className={`mr-2 h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Refreshing...' : 'Refresh Edge Status'}
        </Button>
      </div>

      {isLoading && edges.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
          {[...Array(3)].map((_, i) => (
            <Card key={`skel-edge-${i}`} className="shadow-lg">
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-8 w-1/3 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !isLoading && edges.length === 0 ? (
         <Card className="w-full max-w-xl mx-auto mt-10 shadow-lg bg-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-primary flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 mr-2 text-amber-500" /> No Edges Found
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              No Edge devices were returned by the API. This could be due to:
            </p>
            <ul className="list-disc list-inside text-left text-sm text-muted-foreground mt-2 space-y-1">
                <li>No Edges configured in your Genesys Cloud organization.</li>
                <li>The application's OAuth client lacking the necessary permissions (e.g., `telephony:providers:edge:view`).</li>
                <li>A temporary API issue.</li>
            </ul>
             <p className="text-xs text-muted-foreground mt-4">
              Check client-side console (Developer Tools) and server-side logs for more details.
            </p>
          </CardContent>
        </Card>
      ) : (
        <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
          {edges.map((edge) => {
            const visual = statusVisuals[edge.status] || statusVisuals.Unknown;
            return (
              <Card key={edge.id} className={`shadow-lg border-l-4 ${visual.colorClasses.split(' ')[1]}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-semibold text-primary truncate flex items-center" title={edge.name}>
                      <Server className="w-5 h-5 mr-2 text-muted-foreground/80" />
                      {edge.name}
                    </CardTitle>
                     <Badge variant="outline" className={`px-2.5 py-1 text-xs ${visual.colorClasses}`}>
                        {React.cloneElement(visual.icon, { className: `mr-1.5 ${visual.icon.props.className}`})}
                        {visual.text}
                    </Badge>
                  </div>
                  {edge.description && (
                    <CardDescription className="text-xs pt-1 truncate" title={edge.description}>
                        {edge.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-2 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Edge Group:</span>
                    <span className="font-medium">{edge.edgeGroup?.name || <span className="italic text-muted-foreground/80">N/A</span>}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Make/Model:</span>
                    <span className="font-medium">
                        {edge.make || 'N/A'} / {edge.model || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">API Version:</span>
                    <span className="font-medium">{edge.apiVersion || <span className="italic text-muted-foreground/80">N/A</span>}</span>
                  </div>
                   <p className="text-xs text-muted-foreground/70 pt-2">ID: {edge.id}</p>
                   {/* Placeholder for future "View Details" button */}
                   {/* <Button variant="outline" size="sm" className="mt-3 w-full">View Details</Button> */}
                </CardContent>
              </Card>
            );
          })}
        </main>
      )}
    </div>
  );
}

