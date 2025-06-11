'use client';

import { useState, useEffect, useTransition } from 'react';
import type { UserStatus } from './actions';
import { getGenesysUsers } from './actions';
import { Button } from '@/components/ui/button';
import { GenesysUserTable } from '@/components/genesys-user-table';
import { RefreshCw } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"

export default function HomePage() {
  const [users, setUsers] = useState<UserStatus[]>([]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const fetchUsers = () => {
    startTransition(async () => {
      try {
        const fetchedUsers = await getGenesysUsers();
        setUsers(fetchedUsers);
        if (document.hidden) return; // Don't toast if page is not visible
        toast({
          title: "Data Refreshed",
          description: `Successfully updated status for ${fetchedUsers.length} users.`,
          duration: 3000,
        });
      } catch (error) {
        console.error('Failed to fetch users:', error);
        if (document.hidden) return;
        toast({
          title: "Refresh Error",
          description: "Could not fetch user statuses. Please try again.",
          variant: "destructive",
        });
        // Optionally clear users or keep stale data:
        // setUsers([]); 
      }
    });
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Fetch on initial load

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex flex-col items-center selection:bg-primary/30 selection:text-primary-foreground">
      <header className="w-full max-w-4xl mb-8 text-center">
        <div className="flex items-center justify-center mb-4" role="banner">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mr-3 text-primary">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-3.5-9.5c0 .83.67 1.5 1.5 1.5h4c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5h-4c-.83 0-1.5.67-1.5 1.5zm1 4c0 .83.67 1.5 1.5 1.5h2c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5h-2c-.83 0-1.5.67-1.5 1.5z"/>
          </svg>
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary tracking-tight">
            Genesys Status Board
          </h1>
        </div>
        <p className="text-md sm:text-lg text-muted-foreground font-body max-w-2xl mx-auto">
          Monitor the real-time presence of your Genesys Cloud agents. Data is mocked for this demonstration.
        </p>
      </header>

      <main className="w-full max-w-4xl bg-card p-4 sm:p-6 rounded-xl shadow-2xl">
        <div className="mb-6 flex justify-end">
          <Button onClick={fetchUsers} disabled={isPending} variant="default" size="lg">
            <RefreshCw className={`mr-2 h-5 w-5 ${isPending ? 'animate-spin' : ''}`} />
            {isPending ? 'Refreshing...' : 'Refresh Status'}
          </Button>
        </div>
        <GenesysUserTable users={users} isLoading={isPending && users.length === 0} />
      </main>
      
      <footer className="w-full max-w-4xl mt-12 text-center text-xs text-muted-foreground font-body">
        <p>&copy; {new Date().getFullYear()} Genesys Status Board. All rights reserved (conceptually).</p>
        <p className="mt-1">This application demonstrates API authentication and data retrieval (simulated) using OAuth 2.0 Client Credentials Grant.</p>
      </footer>
    </div>
  );
}
