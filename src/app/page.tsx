
'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import type { UserStatus } from './actions';
import { getGenesysUsers } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GenesysUserTable } from '@/components/genesys-user-table';
import { RefreshCw, Search } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { STATUS_ORDER, statusVisuals } from '@/components/status-indicator';

export default function HomePage() {
  const [users, setUsers] = useState<UserStatus[]>([]);
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const fetchUsers = () => {
    startTransition(async () => {
      try {
        const fetchedUsers = await getGenesysUsers();
        setUsers(fetchedUsers);
        if (document.hidden) return; 
        toast({
          title: "Data Refreshed",
          description: `Successfully updated status for ${fetchedUsers.length} users.`,
          duration: 3000,
        });
      } catch (error: any) {
        console.error('Failed to fetch users:', error);
        if (document.hidden) return;
        toast({
          title: "Refresh Error",
          description: error.message || "Could not fetch user statuses. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const statusCounts = useMemo(() => {
    const counts = STATUS_ORDER.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as Record<UserStatus['status'], number>);

    users.forEach(user => {
      if (counts[user.status] !== undefined) {
        counts[user.status]++;
      }
    });
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    return users.filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );
  }, [users, searchTerm]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex flex-col items-center selection:bg-primary/30 selection:text-primary-foreground">
      <header className="w-full max-w-6xl mb-8 text-center">
        <div className="flex items-center justify-center mb-4" role="banner">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mr-3 text-primary">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-3.5-9.5c0 .83.67 1.5 1.5 1.5h4c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5h-4c-.83 0-1.5.67-1.5 1.5zm1 4c0 .83.67 1.5 1.5 1.5h2c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5h-2c-.83 0-1.5.67-1.5 1.5z"/>
          </svg>
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary tracking-tight">
            Genesys Status Board
          </h1>
        </div>
        <p className="text-md sm:text-lg text-muted-foreground font-body max-w-2xl mx-auto">
          Monitor the real-time presence of your Genesys Cloud agents.
        </p>
      </header>

      <section className="w-full max-w-6xl mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {STATUS_ORDER.map((status) => (
            <Card key={status} className="shadow-md border-l-4" style={{ borderLeftColor: statusVisuals[status].colorHex }}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium">{status}</CardTitle>
                {React.cloneElement(statusVisuals[status].icon, { className: "h-4 w-4" })}
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <div className="text-2xl font-bold">{statusCounts[status]}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <main className="w-full max-w-6xl bg-card p-4 sm:p-6 rounded-xl shadow-2xl">
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Filter by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full sm:w-[250px] md:w-[300px] h-11"
              aria-label="Filter users by name"
            />
          </div>
          <Button onClick={fetchUsers} disabled={isPending} variant="default" size="lg" className="w-full sm:w-auto">
            <RefreshCw className={`mr-2 h-5 w-5 ${isPending ? 'animate-spin' : ''}`} />
            {isPending ? 'Refreshing...' : 'Refresh Status'}
          </Button>
        </div>
        <GenesysUserTable users={filteredUsers} isLoading={isPending && users.length === 0} />
      </main>
      
      <footer className="w-full max-w-6xl mt-12 text-center text-xs text-muted-foreground font-body">
        <p>&copy; {new Date().getFullYear()} Genesys Status Board. All rights reserved (conceptually).</p>
        <p className="mt-1">This application demonstrates API authentication and data retrieval using OAuth 2.0 Client Credentials Grant.</p>
      </footer>
    </div>
  );
}

