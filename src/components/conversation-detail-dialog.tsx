
'use client';

import React from 'react';
import { format, formatDistanceStrict } from 'date-fns';
import { X, Clock, Users, Hash, CalendarDays, Tv, Building, FileText } from 'lucide-react';
import type { ConversationSearchResult, ConversationParticipantSummary } from '@/app/actions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ConversationDetailDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  conversation: ConversationSearchResult | null;
}

const DetailItem: React.FC<{ icon: React.ElementType; label: string; value?: string | React.ReactNode; className?: string }> = 
  ({ icon: Icon, label, value, className }) => (
  <div className={`flex items-start space-x-3 py-2 ${className}`}>
    <Icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      {value !== undefined && value !== null ? (
        typeof value === 'string' ? <p className="text-md font-medium break-all">{value}</p> : <div className="text-md font-medium">{value}</div>
      ) : (
        <p className="text-md font-medium italic text-muted-foreground/70">N/A</p>
      )}
    </div>
  </div>
);

const formatDuration = (ms?: number): string => {
  if (ms === undefined || ms === null) return 'N/A';
  if (ms === 0) return '0s';
  return formatDistanceStrict(0, ms, { unit: 'second' });
};

export function ConversationDetailDialog({ isOpen, onOpenChange, conversation }: ConversationDetailDialogProps) {
  if (!conversation) return null;

  const renderParticipantDetails = (participant: ConversationParticipantSummary) => {
    return (
      <div key={participant.participantId} className="p-3 border rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
        <p className="font-semibold text-primary">{participant.participantName || 'Unnamed Participant'}</p>
        <p className="text-xs text-muted-foreground">ID: {participant.participantId}</p>
        {participant.purpose && <Badge variant="outline" className="mt-1 mr-1 text-xs">Purpose: {participant.purpose}</Badge>}
        {participant.mediaType && <Badge variant="secondary" className="mt-1 text-xs">Media: {participant.mediaType}</Badge>}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center">
            <FileText className="mr-3 h-7 w-7 text-primary" />
            Conversation Details
          </DialogTitle>
          <DialogDescription>
            Detailed information for conversation ID: {conversation.conversationId}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-grow overflow-y-auto pr-2 -mr-2 py-4">
          <div className="space-y-4">
            <section>
              <h3 className="text-lg font-semibold text-primary mb-2">Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                <DetailItem icon={Hash} label="Conversation ID" value={conversation.conversationId} />
                <DetailItem 
                  icon={CalendarDays} 
                  label="Start Time" 
                  value={conversation.conversationStart ? format(new Date(conversation.conversationStart), 'PPpp') : 'N/A'} 
                />
                <DetailItem 
                  icon={CalendarDays} 
                  label="End Time" 
                  value={conversation.conversationEnd ? format(new Date(conversation.conversationEnd), 'PPpp') : 'Ongoing'} 
                />
                <DetailItem icon={Clock} label="Duration" value={formatDuration(conversation.durationMillis)} />
                <DetailItem icon={Tv} label="Primary Media Type" value={conversation.primaryMediaType || 'N/A'} />
                 <DetailItem 
                  icon={Building} 
                  label="Division IDs" 
                  value={conversation.divisionIds && conversation.divisionIds.length > 0 
                          ? conversation.divisionIds.map(id => <Badge key={id} variant="outline" className="mr-1 mb-1">{id}</Badge>) 
                          : 'N/A'} 
                />
              </div>
            </section>

            <Separator className="my-4" />

            <section>
              <h3 className="text-lg font-semibold text-primary mb-2 flex items-center">
                <Users className="mr-2 h-5 w-5" /> Participants ({conversation.participants.length})
              </h3>
              {conversation.participants && conversation.participants.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {conversation.participants.map(renderParticipantDetails)}
                </div>
              ) : (
                <p className="text-muted-foreground italic">No participant information available.</p>
              )}
            </section>
            {/* Add more sections here for segments, wrap-up codes, etc. if data becomes available */}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-auto pt-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

