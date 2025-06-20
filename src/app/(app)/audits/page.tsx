
'use client';

import React, { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Filter, History, Loader2, Search as SearchIcon, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { queryAuditLogs } from '@/app/actions';
import type { AuditLogEntry, AuditLogQueryFilters } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const MAX_DATE_RANGE_DAYS = 31; // Genesys Cloud audit query typically limited

export default function AuditLogsPage() {
  const [filters, setFilters] = useState<Partial<AuditLogQueryFilters>>({
    pageNumber: 1,
    pageSize: 25,
  });
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, startSearchTransition] = useTransition();
  const { toast } = useToast();

  const handleDateChange = (newDateRange: { from?: Date; to?: Date }) => {
    if (newDateRange.from && newDateRange.to) {
      const diffTime = Math.abs(newDateRange.to.getTime() - newDateRange.from.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > MAX_DATE_RANGE_DAYS) {
        toast({
          title: 'Invalid Date Range',
          description: `The date range cannot exceed ${MAX_DATE_RANGE_DAYS} days. Please select a shorter period.`,
          variant: 'destructive',
        });
        return;
      }
    }
    setDateRange(newDateRange);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSearch = () => {
    if (!dateRange.from || !dateRange.to) {
      toast({
        title: 'Date Range Required',
        description: 'Please select a start and end date for the audit log query.',
        variant: 'destructive',
      });
      return;
    }

    const intervalFrom = dateRange.from.toISOString();
    const intervalTo = new Date(dateRange.to.getTime() + (24 * 60 * 60 * 1000 - 1000)).toISOString(); // End of selected day
    
    const query: AuditLogQueryFilters = {
      ...filters,
      interval: `${intervalFrom}/${intervalTo}`,
      pageNumber: 1, // Reset to page 1 for new search
    };
    
    setAuditLogs([]); // Clear previous results
    startSearchTransition(async () => {
      try {
        const results = await queryAuditLogs(query);
        setAuditLogs(results);
        if (results.length === 0) {
          toast({
            title: 'No Audit Logs Found',
            description: 'No audit logs matched your criteria for the selected period.',
          });
        } else {
            toast({
                title: 'Search Complete',
                description: `Found ${results.length} audit log entries.`,
            });
        }
      } catch (error: any) {
        toast({
          title: 'Error Fetching Audit Logs',
          description: error.message || 'An unexpected error occurred.',
          variant: 'destructive',
        });
      }
    });
  };
  
  const renderChangeDetails = (entry: AuditLogEntry) => {
    const changes = entry.propertyChanges || entry.changes;
    if (!changes || changes.length === 0) return <span className="text-muted-foreground italic">N/A</span>;
    
    return (
      <ul className="list-disc list-inside text-xs space-y-1">
        {changes.map((change, index) => (
          <li key={index}>
            <strong>{change.property}:</strong>
            <div className="pl-2">
              {change.oldValues && change.oldValues.length > 0 && (
                <p><span className="text-red-600">Old:</span> {change.oldValues.join(', ')}</p>
              )}
              {change.newValues && change.newValues.length > 0 && (
                <p><span className="text-green-600">New:</span> {change.newValues.join(', ')}</p>
              )}
               {change.entity && (
                <p><span className="text-blue-600">Entity:</span> {change.entity.name || change.entity.id} ({change.entity.type})</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  };


  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex flex-col items-center selection:bg-primary/30 selection:text-primary-foreground">
      <header className="w-full max-w-7xl mb-8 text-center">
        <div className="flex items-center justify-center mb-4" role="banner">
          <History className="w-12 h-12 mr-3 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary tracking-tight">
            Audit Log Viewer
          </h1>
        </div>
        <p className="text-md sm:text-lg text-muted-foreground font-body max-w-3xl mx-auto">
          Query and view audit logs from Genesys Cloud to track changes and events.
        </p>
      </header>

      <Card className="w-full max-w-7xl mb-6 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2 h-5 w-5 text-accent" />
            Filter Audit Logs
          </CardTitle>
          <CardDescription>Specify criteria to search for audit logs. Date range is required.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <Label htmlFor="date-from">Date From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date-from"
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal h-10', !dateRange.from && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? format(dateRange.from, 'PPP') : <span>Pick a start date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dateRange.from} onSelect={(d) => handleDateChange({ ...dateRange, from: d })} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="date-to">Date To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date-to"
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal h-10', !dateRange.to && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.to ? format(dateRange.to, 'PPP') : <span>Pick an end date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dateRange.to} onSelect={(d) => handleDateChange({ ...dateRange, to: d })} initialFocus disabled={(date) => dateRange.from ? date < dateRange.from : false} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="serviceName">Service Name</Label>
              <Input id="serviceName" name="serviceName" placeholder="e.g., Architect, Users" value={filters.serviceName || ''} onChange={handleFilterChange} className="h-10" />
            </div>
             <div>
              <Label htmlFor="userId">User ID or Name</Label>
              <Input id="userId" name="userId" placeholder="User ID or partial name" value={filters.userId || ''} onChange={handleFilterChange} className="h-10" />
            </div>
            <div>
              <Label htmlFor="action">Action</Label>
              <Input id="action" name="action" placeholder="e.g., CREATE, UPDATE, LOGIN" value={filters.action || ''} onChange={handleFilterChange} className="h-10" />
            </div>
            <div>
              <Label htmlFor="entityType">Entity Type</Label>
              <Input id="entityType" name="entityType" placeholder="e.g., User, Queue, Flow" value={filters.entityType || ''} onChange={handleFilterChange} className="h-10" />
            </div>
            <div className="lg:col-span-2 flex justify-end">
              <Button onClick={handleSearch} disabled={isLoading} size="lg" className="w-full md:w-auto">
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <SearchIcon className="mr-2 h-5 w-5" />}
                Search Audit Logs
              </Button>
            </div>
          </div>
           <p className="text-xs text-muted-foreground text-center mt-2">
              Date range is limited to {MAX_DATE_RANGE_DAYS} days. User ID/Name filter searches by User ID, exact name matches may require specific API capabilities not used here.
            </p>
        </CardContent>
      </Card>

      <main className="w-full max-w-7xl">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Audit Log Results</CardTitle>
            <CardDescription>
                {isLoading ? "Loading audit logs..." : auditLogs.length > 0 ? `Displaying ${auditLogs.length} entries.` : "No audit logs to display. Refine your search or try a different date range."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[150px]">User</TableHead>
                    <TableHead className="w-[120px]">Service</TableHead>
                    <TableHead className="w-[100px]">Action</TableHead>
                    <TableHead className="w-[150px]">Entity</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead>Changes / Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={`skel-${i}`}>
                        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground h-24">
                        No audit logs found for the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">{format(new Date(log.eventDate), 'PPpp')}</TableCell>
                        <TableCell className="text-xs">{log.user?.name || log.user?.id || 'System'}</TableCell>
                        <TableCell className="text-xs">{log.serviceName}</TableCell>
                        <TableCell className="text-xs">{log.action}</TableCell>
                        <TableCell className="text-xs">
                          {log.entity?.name || log.entity?.id || <span className="text-muted-foreground italic">N/A</span>}
                          {log.entity?.type && <span className="block text-muted-foreground">({log.entity.type})</span>}
                        </TableCell>
                        <TableCell className="text-xs">
                           <span className={cn(log.status === 'SUCCESS' ? 'text-green-600' : log.status === 'FAILURE' ? 'text-red-600' : 'text-muted-foreground')}>
                            {log.status || <span className="italic">N/A</span>}
                           </span>
                        </TableCell>
                        <TableCell>{renderChangeDetails(log)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
             {/* Basic Pagination (Placeholder) - API supports cursor or pageNumber/pageSize */}
            {auditLogs.length > 0 && (filters.pageSize && auditLogs.length >= filters.pageSize) && (
              <div className="flex justify-center mt-4">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                        const nextPage = (filters.pageNumber || 1) + 1;
                        setFilters(prev => ({...prev, pageNumber: nextPage }));
                        // Trigger search with new page number - this will be part of handleSearch
                        // For now, just log to ensure it works
                        console.log("Requesting page: ", nextPage);
                        // TODO: Re-trigger handleSearch with new page number
                        toast({title: "Next Page Clicked", description: "Full pagination requires re-triggering search. Current view is first page of new filter set."})
                    }}
                    disabled={isLoading}
                >
                    Load More (Next Page)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
         {!isLoading && auditLogs.length === 0 && !dateRange.from && (
            <Card className="mt-8 bg-blue-50 border-blue-200">
                <CardHeader className="flex-row items-center gap-3">
                    <AlertTriangle className="w-8 h-8 text-blue-600" />
                    <div>
                        <CardTitle className="text-blue-800">Getting Started</CardTitle>
                        <CardDescription className="text-blue-700">Select a date range and apply filters to begin your audit log search.</CardDescription>
                    </div>
                </CardHeader>
            </Card>
        )}
      </main>
    </div>
  );
}

