
'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import type { UserStatus, Division } from '../actions';
import { getGenesysUsers, getAllDivisions, updateUserDivision } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GenesysUserTable } from '@/components/genesys-user-table';
import { RefreshCw, Search, Users } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { STATUS_ORDER, statusVisuals } from '@/components/status-indicator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UpdateUserDivisionDialog } from '@/components/update-user-division-dialog';


export default function HomePage() {
  const [users, setUsers] = useState<UserStatus[]>([]);
  const [allDivisions, setAllDivisions] = useState<Division[]>([]);
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDivisionFilter, setSelectedDivisionFilter] = useState<string>('all');
  const { toast } = useToast();

  const [isUpdateDivisionDialogOpen, setIsUpdateDivisionDialogOpen] = useState(false);
  const [selectedUserForUpdate, setSelectedUserForUpdate] = useState<UserStatus | null>(null);

  const fetchUsersAndDivisions = () => {
    startTransition(async () => {
      try {
        const [fetchedUsers, fetchedDivisions] = await Promise.all([
          getGenesysUsers(),
          getAllDivisions()
        ]);
        setUsers(fetchedUsers);
        setAllDivisions(fetchedDivisions);

        if (document.hidden) return;
        toast({
          title: "Data Refreshed",
          description: `Successfully updated status for ${fetchedUsers.length} users and fetched ${fetchedDivisions.length} divisions.`,
          duration: 3000,
        });
      } catch (error: any) {
        console.error('Failed to fetch data:', error);
        if (document.hidden) return;
        toast({
          title: "Refresh Error",
          description: error.message || "Could not fetch user statuses or divisions. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  useEffect(() => {
    fetchUsersAndDivisions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const divisionsForFilter = useMemo(() => {
    const uniqueDivsMap = new Map<string, Division>();
    users.forEach(user => {
      if (user.divisionId && user.divisionId !== 'N/A' && !uniqueDivsMap.has(user.divisionId)) {
        uniqueDivsMap.set(user.divisionId, { id: user.divisionId, name: user.divisionName });
      }
    });
    return [{ id: 'all', name: 'All Divisions' }, ...Array.from(uniqueDivsMap.values()).sort((a, b) => a.name.localeCompare(b.name))];
  }, [users]);

  const filteredUsers = useMemo(() => {
    let tempUsers = users;
    if (selectedDivisionFilter !== 'all') {
      tempUsers = tempUsers.filter(user => user.divisionId === selectedDivisionFilter);
    }
    if (!searchTerm.trim()) return tempUsers;
    return tempUsers.filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );
  }, [users, searchTerm, selectedDivisionFilter]);

  const statusCounts = useMemo(() => {
    const counts = STATUS_ORDER.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as Record<UserStatus['status'], number>);

    filteredUsers.forEach(user => {
      if (counts[user.status] !== undefined) {
        counts[user.status]++;
      }
    });
    return counts;
  }, [filteredUsers]);

  const handleOpenUpdateDialog = (user: UserStatus) => {
    setSelectedUserForUpdate(user);
    setIsUpdateDivisionDialogOpen(true);
  };
  
  const handleDivisionUpdate = async (userId: string, newDivisionId: string) => {
    try {
      await updateUserDivision(userId, newDivisionId);
      toast({
        title: "Division Updated",
        description: `Successfully updated division for user.`,
      });
      fetchUsersAndDivisions(); // Refresh data after update
      return true; // Indicate success
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Could not update user's division.",
        variant: "destructive",
      });
      return false; // Indicate failure
    }
  };


  return (
    <>
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex flex-col items-center selection:bg-primary/30 selection:text-primary-foreground">
        <header className="w-full max-w-6xl mb-8 text-center">
          <div className="flex items-center justify-center mb-4" role="banner">
            <Users className="w-10 h-10 md:w-12 md:h-12 mr-3 text-primary" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline font-bold text-primary tracking-tight">
              User Presence Dashboard
            </h1>
          </div>
          <p className="text-sm sm:text-md md:text-lg text-muted-foreground font-body max-w-3xl mx-auto">
            Monitor the real-time presence, division, skills, and extension of your Genesys Cloud agents. Utilize filters to refine your view.
          </p>
        </header>

        <section className="w-full max-w-6xl mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {STATUS_ORDER.map((status) => {
              const visual = statusVisuals[status];
              return (
                <Card key={status} className="shadow-md border-l-4" style={{ borderLeftColor: visual.colorHex }}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-medium">{status}</CardTitle>
                    {React.cloneElement(visual.icon, { className: "h-4 w-4 text-muted-foreground" })}
                  </CardHeader>
                  <CardContent className="pb-4 px-4">
                    <div className="text-2xl font-bold">{statusCounts[status]}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <main className="w-full max-w-6xl bg-card p-4 sm:p-6 rounded-xl shadow-xl border">
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 flex-wrap">
            <div className="flex-grow flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <div className="relative w-full sm:flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Filter by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full h-10 text-sm"
                  aria-label="Filter users by name"
                />
              </div>
              <div className="w-full sm:flex-1 min-w-[180px]">
                <Select value={selectedDivisionFilter} onValueChange={setSelectedDivisionFilter}>
                  <SelectTrigger className="w-full h-10 text-sm" aria-label="Filter by division">
                    <SelectValue placeholder="Filter by division" />
                  </SelectTrigger>
                  <SelectContent>
                    {divisionsForFilter.map((division) => (
                      <SelectItem key={division.id} value={division.id}>
                        {division.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={fetchUsersAndDivisions} disabled={isPending} variant="default" size="default" className="w-full sm:w-auto h-10">
              <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
              {isPending ? 'Refreshing...' : 'Refresh Status'}
            </Button>
          </div>
          <GenesysUserTable 
            users={filteredUsers} 
            isLoading={isPending && users.length === 0}
            onEditUser={handleOpenUpdateDialog}
          />
        </main>

        <footer className="w-full max-w-6xl mt-12 text-center text-xs text-muted-foreground font-body">
          <p>&copy; {new Date().getFullYear()} CapitalGroup Genesys Configurator. All rights reserved.</p>
          <p className="mt-1">This application interfaces with Genesys Cloud APIs for demonstration and operational purposes.</p>
        </footer>
      </div>
      
      <UpdateUserDivisionDialog
        isOpen={isUpdateDivisionDialogOpen}
        onOpenChange={setIsUpdateDivisionDialogOpen}
        user={selectedUserForUpdate}
        allDivisions={allDivisions}
        onSave={handleDivisionUpdate}
      />
    </>
  );
}
