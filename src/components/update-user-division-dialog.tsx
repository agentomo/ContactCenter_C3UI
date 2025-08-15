
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import type { UserStatus, Division } from '@/app/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Loader2, Save, Building } from 'lucide-react';

interface UpdateUserDivisionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  user: UserStatus | null;
  allDivisions: Division[];
  onSave: (userId: string, newDivisionId: string) => Promise<boolean>;
}

export function UpdateUserDivisionDialog({
  isOpen,
  onOpenChange,
  user,
  allDivisions,
  onSave,
}: UpdateUserDivisionDialogProps) {
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | undefined>(undefined);
  const [isSaving, startSavingTransition] = useTransition();

  useEffect(() => {
    if (user) {
      setSelectedDivisionId(user.divisionId);
    }
  }, [user]);

  const handleSave = () => {
    if (!user || !selectedDivisionId) return;

    startSavingTransition(async () => {
      const success = await onSave(user.id, selectedDivisionId);
      if (success) {
        onOpenChange(false); // Close dialog on successful save
      }
    });
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update User Division</DialogTitle>
          <DialogDescription>
            Change the assigned division for <span className="font-semibold text-primary">{user.name}</span>.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
            <div className="space-y-1">
                <Label>Current Division</Label>
                <p className="text-sm p-2 bg-muted rounded-md text-muted-foreground">{user.divisionName}</p>
            </div>
            <div className="space-y-1">
                <Label htmlFor="division-select">New Division</Label>
                 <Select 
                    value={selectedDivisionId} 
                    onValueChange={setSelectedDivisionId}
                    disabled={isSaving}
                >
                    <SelectTrigger id="division-select" className="w-full">
                        <SelectValue placeholder="Select a new division..." />
                    </SelectTrigger>
                    <SelectContent>
                        {allDivisions.map(div => (
                            <SelectItem key={div.id} value={div.id}>
                                {div.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSaving}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !selectedDivisionId || selectedDivisionId === user.divisionId}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
