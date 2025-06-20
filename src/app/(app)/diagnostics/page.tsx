
'use client';

import React, { useState, useTransition } from 'react';
import { format, formatDistanceStrict } from 'date-fns';
import { CalendarIcon, Filter, Search as SearchIcon, Loader2, AlertTriangle, MessageSquareText, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { searchConversations } from '@/app/actions';
import type { ConversationSearchFilters, ConversationSearchResult } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ConversationDetailDialog } from '@/components/conversation-detail-dialog';

const MAX_DATE_RANGE_DAYS_CONV = 7; // Analytics conversation query often limited for performance

export default function ConversationDiagnosticsPage() {
  const [filters, setFilters] = useState<Partial<ConversationSearchFilters>>({
    pageNumber: 1,
    pageSize: 25,
  });
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [conversationIdInput, setConversationIdInput] = useState<string>('');
  
  const [searchResults, setSearchResults] = useState<ConversationSearchResult[]>([]);
  const [isLoading, startSearchTransition] = useTransition();
  const { toast } = useToast();

  const [selectedConversation, setSelectedConversation] = useState<ConversationSearchResult | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const handleDateChange = (newDateRange: { from?: Date; to?: Date }) => {
    if (newDateRange.from && newDateRange.to) {
      const diffTime = Math.abs(newDateRange.to.getTime() - newDateRange.from.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > MAX_DATE_RANGE_DAYS_CONV) {
        toast({
          title: 'Invalid Date Range',
          description: `The date range for conversation search cannot exceed ${MAX_DATE_RANGE_DAYS_CONV} days. Please select a shorter period.`,
          variant: 'destructive',
        });
        return;
      }
    }
    setDateRange(newDateRange);
  };

  const handleSearch = () => {
    if (!dateRange.from || !dateRange.to) {
      toast({
        title: 'Date Range Required',
        description: 'Please select a start and end date for the conversation search.',
        variant: 'destructive',
      });
      return;
    }

    const intervalFrom = dateRange.from.toISOString();
    const intervalTo = new Date(dateRange.to.getTime() + (24 * 60 * 60 * 1000 - 1000)).toISOString(); // End of selected day
    
    const query: ConversationSearchFilters = {
      ...filters,
      interval: `${intervalFrom}/${intervalTo}`,
      conversationId: conversationIdInput.trim() || undefined,
      pageNumber: 1, 
    };
    
    setSearchResults([]); 
    startSearchTransition(async () => {
      try {
        const results = await searchConversations(query);
        setSearchResults(results);
        if (results.length === 0) {
          toast({
            title: 'No Conversations Found',
            description: 'No conversations matched your criteria for the selected period.',
          });
        } else {
            toast({
                title: 'Search Complete',
                description: `Found ${results.length} conversation(s).`,
            });
        }
      } catch (error: any) {
        toast({
          title: 'Error Searching Conversations',
          description: error.message || 'An unexpected error occurred.',
          variant: 'destructive',
        });
      }
    });
  };

  const formatDuration = (ms?: number): string => {
    if (ms === undefined || ms === null) return 'N/A';
    if (ms === 0) return '0s';
    return formatDistanceStrict(0, ms, { unit: 'second' });
  };

  const renderParticipantsSummary = (participants: ConversationSearchResult['participants']) => {
    if (!participants || participants.length === 0) return <span className="text-muted-foreground italic">None</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {participants.slice(0, 3).map(p => ( 
          <Badge key={p.participantId} variant="secondary" className="text-xs">
            {p.participantName || p.purpose || p.participantId.substring(0,8)}
          </Badge>
        ))}
        {participants.length > 3 && <Badge variant="outline" className="text-xs">+{participants.length - 3} more</Badge>}
      </div>
    );
  };

  const handleViewDetails = (conversation: ConversationSearchResult) => {
    setSelectedConversation(conversation);
    setIsDetailDialogOpen(true);
  };
  
  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex flex-col items-center selection:bg-primary/30 selection:text-primary-foreground">
      <header className="w-full max-w-7xl mb-8 text-center">
        <div className="flex items-center justify-center mb-4" role="banner">
          <MessageSquareText className="w-12 h-12 mr-3 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary tracking-tight">
            Conversation Diagnostics
          </h1>
        </div>
        <p className="text-md sm:text-lg text-muted-foreground font-body max-w-3xl mx-auto">
          Search for specific Genesys Cloud conversations to troubleshoot and analyze interactions.
        </p>
      </header>

      <Card className="w-full max-w-5xl mb-6 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2 h-5 w-5 text-accent" />
            Search Filters
          </CardTitle>
          <CardDescription>Specify criteria to find conversations. Date range is required.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
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
              <Label htmlFor="conversationId">Conversation ID (Optional)</Label>
              <Input id="conversationId" name="conversationId" placeholder="Enter full Conversation ID" value={conversationIdInput} onChange={(e) => setConversationIdInput(e.target.value)} className="h-10" />
            </div>
            <div className="lg:col-span-3 flex justify-end">
              <Button onClick={handleSearch} disabled={isLoading} size="lg" className="w-full md:w-auto">
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <SearchIcon className="mr-2 h-5 w-5" />}
                Search Conversations
              </Button>
            </div>
          </div>
           <p className="text-xs text-muted-foreground text-center mt-2">
              Date range for conversation search is limited to ${MAX_DATE_RANGE_DAYS_CONV} days.
            </p>
        </CardContent>
      </Card>

      <main className="w-full max-w-7xl">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
                {isLoading ? "Loading conversations..." : searchResults.length > 0 ? `Displaying ${searchResults.length} conversation(s).` : "No conversations to display. Refine your search or try a different date range."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Conversation ID</TableHead>
                    <TableHead className="w-[180px]">Start Time</TableHead>
                    <TableHead className="w-[180px]">End Time</TableHead>
                    <TableHead className="w-[100px]">Duration</TableHead>
                    <TableHead className="w-[120px]">Media Type</TableHead>
                    <TableHead>Participants</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(3)].map((_, i) => (
                      <TableRow key={`skel-${i}`}>
                        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-20 inline-block" /></TableCell>
                      </TableRow>
                    ))
                  ) : searchResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground h-24">
                        No conversations found for the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    searchResults.map((conv) => (
                      <TableRow key={conv.conversationId}>
                        <TableCell className="text-xs font-mono">{conv.conversationId}</TableCell>
                        <TableCell className="text-xs">{format(new Date(conv.conversationStart), 'PPpp')}</TableCell>
                        <TableCell className="text-xs">{conv.conversationEnd ? format(new Date(conv.conversationEnd), 'PPpp') : <span className="italic text-muted-foreground">Ongoing</span>}</TableCell>
                        <TableCell className="text-xs">{formatDuration(conv.durationMillis)}</TableCell>
                        <TableCell className="text-xs">{conv.primaryMediaType || <span className="italic text-muted-foreground">N/A</span>}</TableCell>
                        <TableCell className="text-xs">{renderParticipantsSummary(conv.participants)}</TableCell>
                        <TableCell className="text-right">
                           <Button 
                             variant="outline" 
                             size="sm"
                             onClick={() => handleViewDetails(conv)}
                           >
                               <Eye className="mr-1.5 h-4 w-4" /> Details
                           </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
         {!isLoading && searchResults.length === 0 && !dateRange.from && (
            <Card className="mt-8 bg-blue-50 border-blue-200">
                <CardHeader className="flex-row items-center gap-3">
                    <AlertTriangle className="w-8 h-8 text-blue-600" />
                    <div>
                        <CardTitle className="text-blue-800">Getting Started</CardTitle>
                        <CardDescription className="text-blue-700">Select a date range (max ${MAX_DATE_RANGE_DAYS_CONV} days) and optionally provide a Conversation ID to begin your search.</CardDescription>
                    </div>
                </CardHeader>
            </Card>
        )}
      </main>
      {selectedConversation && (
        <ConversationDetailDialog
          isOpen={isDetailDialogOpen}
          onOpenChange={setIsDetailDialogOpen}
          conversation={selectedConversation}
        />
      )}
    </div>
  );
}

