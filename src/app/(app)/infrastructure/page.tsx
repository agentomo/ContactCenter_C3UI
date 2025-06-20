
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { getEdgesBasicInfo, getEdgeDetails } from '@/app/actions';
import type { EdgeBasic, EdgeOperationalStatus, EdgeDetail, ProcessedEdgeMetrics } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { 
  Network, RefreshCw, Server, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Info, Eye, 
  Cpu, MemoryStick, Gauge, Loader2, XCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';

const statusVisuals: Record<EdgeOperationalStatus, { icon: JSX.Element; colorClasses: string; text: string }> = {
  Online: { icon: <ShieldCheck className="h-5 w-5" />, colorClasses: 'text-green-600 border-green-500 bg-green-50', text: 'Online' },
  Offline: { icon: <ShieldX className="h-5 w-5" />, colorClasses: 'text-red-600 border-red-500 bg-red-50', text: 'Offline' },
  Degraded: { icon: <ShieldAlert className="h-5 w-5" />, colorClasses: 'text-amber-600 border-amber-500 bg-amber-50', text: 'Degraded' },
  Unknown: { icon: <AlertTriangle className="h-5 w-5" />, colorClasses: 'text-slate-600 border-slate-500 bg-slate-50', text: 'Unknown' },
};

const formatBytes = (bytes?: number, decimals = 2) => {
  if (bytes === undefined || bytes === 0) return 'N/A';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const MetricDisplayItem: React.FC<{ icon: React.ElementType, label: string, value?: string | number, unit?: string, timestamp?: string, className?: string }> = 
  ({ icon: Icon, label, value, unit, timestamp, className }) => (
  <div className={`flex items-start space-x-3 p-3 rounded-md bg-muted/50 ${className}`}>
    <Icon className="h-6 w-6 text-primary mt-0.5" />
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      {value !== undefined && value !== null ? (
        <p className="text-lg font-semibold">
          {value}
          {unit && <span className="text-xs font-normal ml-1">{unit}</span>}
        </p>
      ) : (
        <p className="text-lg font-semibold italic text-muted-foreground/70">N/A</p>
      )}
      {timestamp && (
        <p className="text-xs text-muted-foreground/80">
          Last updated: {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
        </p>
      )}
    </div>
  </div>
);


export default function InfrastructurePage() {
  const [edges, setEdges] = useState<EdgeBasic[]>([]);
  const [isLoadingEdges, startLoadingEdgesTransition] = useTransition();
  const { toast } = useToast();

  const [selectedEdgeForDetails, setSelectedEdgeForDetails] = useState<EdgeBasic | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [edgeDetails, setEdgeDetails] = useState<EdgeDetail | null>(null);
  const [isLoadingEdgeDetails, startLoadingEdgeDetailsTransition] = useTransition();


  const fetchEdgeData = () => {
    startLoadingEdgesTransition(async () => {
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

  const handleViewDetails = (edge: EdgeBasic) => {
    setSelectedEdgeForDetails(edge);
    setIsDetailsDialogOpen(true);
    setEdgeDetails(null); // Clear previous details
  };

  useEffect(() => {
    if (selectedEdgeForDetails && isDetailsDialogOpen) {
      startLoadingEdgeDetailsTransition(async () => {
        try {
          const details = await getEdgeDetails(selectedEdgeForDetails.id);
          setEdgeDetails(details);
        } catch (error: any) {
          console.error(`[InfrastructurePage] Failed to fetch details for Edge ${selectedEdgeForDetails.id}:`, error);
          toast({
            title: `Error Fetching Details for ${selectedEdgeForDetails.name}`,
            description: error.message || "Could not retrieve detailed information for this Edge.",
            variant: "destructive",
          });
          setEdgeDetails(null); // Keep it null on error to show error state in dialog
        }
      });
    }
  }, [selectedEdgeForDetails, isDetailsDialogOpen]);


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
          Monitor the status and performance of your Genesys Cloud Edges.
        </p>
      </header>

      <div className="w-full max-w-6xl mb-6 flex justify-end">
        <Button onClick={fetchEdgeData} disabled={isLoadingEdges} variant="default" size="lg">
          <RefreshCw className={`mr-2 h-5 w-5 ${isLoadingEdges ? 'animate-spin' : ''}`} />
          {isLoadingEdges ? 'Refreshing...' : 'Refresh Edge Status'}
        </Button>
      </div>

      {isLoadingEdges && edges.length === 0 ? (
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
                <Skeleton className="h-9 w-full mt-3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !isLoadingEdges && edges.length === 0 ? (
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
              <Card key={edge.id} className={`shadow-lg border-l-4 ${visual.colorClasses.split(' ')[1]} flex flex-col`}>
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
                <CardContent className="pt-2 space-y-2 text-sm flex-grow">
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
                </CardContent>
                <div className="p-4 pt-0 mt-auto">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-3"
                        onClick={() => handleViewDetails(edge)}
                        disabled={isLoadingEdgeDetails && selectedEdgeForDetails?.id === edge.id}
                    >
                        {isLoadingEdgeDetails && selectedEdgeForDetails?.id === edge.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Eye className="mr-2 h-4 w-4" />
                        )}
                        View Details
                    </Button>
                </div>
              </Card>
            );
          })}
        </main>
      )}

      {selectedEdgeForDetails && (
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-2xl">Details for {selectedEdgeForDetails.name}</DialogTitle>
                    <DialogDescription>
                        Status: <Badge variant="outline" className={`${(statusVisuals[edgeDetails?.status || selectedEdgeForDetails.status] || statusVisuals.Unknown).colorClasses} ml-1`}>
                             {React.cloneElement((statusVisuals[edgeDetails?.status || selectedEdgeForDetails.status] || statusVisuals.Unknown).icon, {className: "mr-1.5 h-4 w-4"})} 
                             {edgeDetails?.status || selectedEdgeForDetails.status}
                        </Badge>
                         {edgeDetails?.site && <span className="ml-2">Site: {edgeDetails.site.name}</span>}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="flex-grow overflow-y-auto pr-2 space-y-6 py-4">
                  {isLoadingEdgeDetails && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-primary mb-2">Hardware</h3>
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                      <Separator className="my-4" />
                      <h3 className="text-lg font-semibold text-primary mb-2">Performance Metrics</h3>
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  )}

                  {!isLoadingEdgeDetails && !edgeDetails && (
                     <div className="text-center py-10">
                        <XCircle className="mx-auto h-12 w-12 text-destructive mb-3" />
                        <p className="text-lg font-semibold text-destructive">Error Loading Details</p>
                        <p className="text-muted-foreground">Could not fetch detailed information for this Edge. Please try again later.</p>
                    </div>
                  )}
                  
                  {!isLoadingEdgeDetails && edgeDetails && (
                    <>
                        <div>
                            <h3 className="text-lg font-semibold text-primary mb-3">Hardware Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-3 rounded-md bg-muted/50">
                                    <p className="text-sm text-muted-foreground">Processors</p>
                                    {edgeDetails.processors && edgeDetails.processors.length > 0 ? (
                                      edgeDetails.processors.map((proc, idx) => (
                                        <p key={idx} className="text-md font-medium">
                                            {proc.activeCoreCount || 'N/A'} cores ({proc.type || 'Unknown Type'})
                                        </p>
                                      ))
                                    ) : <p className="text-md font-medium italic text-muted-foreground/70">N/A</p>}
                                </div>
                                <div className="p-3 rounded-md bg-muted/50">
                                    <p className="text-sm text-muted-foreground">Memory</p>
                                    {edgeDetails.memory && edgeDetails.memory.length > 0 ? (
                                       edgeDetails.memory.map((mem, idx) => (
                                        <p key={idx} className="text-md font-medium">
                                           {formatBytes(mem.totalMemoryBytes)} ({mem.type || 'Unknown Type'})
                                        </p>
                                       ))
                                    ) : <p className="text-md font-medium italic text-muted-foreground/70">N/A</p>}
                                </div>
                                <div className="p-3 rounded-md bg-muted/50">
                                    <p className="text-sm text-muted-foreground">Make / Model</p>
                                    <p className="text-md font-medium">{edgeDetails.make || 'N/A'} / {edgeDetails.model || 'N/A'}</p>
                                </div>
                                <div className="p-3 rounded-md bg-muted/50">
                                    <p className="text-sm text-muted-foreground">API Version</p>
                                    <p className="text-md font-medium">{edgeDetails.apiVersion || 'N/A'}</p>
                                </div>
                            </div>
                        </div>

                        <Separator className="my-6" />

                        <div>
                            <h3 className="text-lg font-semibold text-primary mb-3">Performance Metrics</h3>
                             {edgeDetails.processedMetrics ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <MetricDisplayItem 
                                        icon={Cpu} 
                                        label="CPU Usage" 
                                        value={edgeDetails.processedMetrics.latestCpuUsage?.value?.toFixed(1)} 
                                        unit="%" 
                                        timestamp={edgeDetails.processedMetrics.latestCpuUsage?.timestamp}
                                    />
                                    <MetricDisplayItem 
                                        icon={MemoryStick} 
                                        label="Memory Usage" 
                                        value={edgeDetails.processedMetrics.latestMemoryUsage?.value?.toFixed(1)} 
                                        unit="%" 
                                        timestamp={edgeDetails.processedMetrics.latestMemoryUsage?.timestamp}
                                    />
                                    <MetricDisplayItem 
                                        icon={Gauge} 
                                        label="Network RTT" 
                                        value={edgeDetails.processedMetrics.latestNetworkRtt?.value?.toFixed(1)} 
                                        unit="ms" 
                                        timestamp={edgeDetails.processedMetrics.latestNetworkRtt?.timestamp}
                                        className="md:col-span-2"
                                    />
                                     {Object.keys(edgeDetails.processedMetrics).length === 0 && (
                                        <p className="text-muted-foreground italic md:col-span-2 text-center py-4">No real-time performance metrics available for this Edge.</p>
                                     )}
                                </div>
                            ) : (
                                <p className="text-muted-foreground italic text-center py-4">Performance metrics data is not available.</p>
                            )}
                        </div>
                    </>
                  )}
                </div>

                <DialogFooter className="mt-auto pt-4 border-t">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Close</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
