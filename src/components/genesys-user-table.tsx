
'use client';

import type { UserStatus } from '@/app/actions';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { StatusIndicator } from './status-indicator';
import { Skeleton } from '@/components/ui/skeleton';

interface GenesysUserTableProps {
  users: UserStatus[];
  isLoading: boolean;
}

export function GenesysUserTable({ users, isLoading }: GenesysUserTableProps) {
  if (isLoading && users.length === 0) {
    return (
      <div className="rounded-lg border bg-card shadow-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[35%] font-headline text-base">Name</TableHead>
              <TableHead className="w-[35%] font-headline text-base">Division</TableHead>
              <TableHead className="w-[30%] font-headline text-base">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i} className="hover:bg-muted/50">
                <TableCell><Skeleton className="h-6 w-3/4 rounded-md" /></TableCell>
                <TableCell><Skeleton className="h-6 w-3/4 rounded-md" /></TableCell>
                <TableCell><Skeleton className="h-6 w-1/2 rounded-md" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!isLoading && users.length === 0) {
    return (
      <div className="rounded-lg border bg-card shadow-md p-8 text-center">
        <p className="text-lg text-muted-foreground">No users found for the selected criteria.</p>
        <p className="text-sm text-muted-foreground mt-2">Try adjusting your filters or refreshing.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%] font-headline text-base">Name</TableHead>
            <TableHead className="w-[35%] font-headline text-base">Division</TableHead>
            <TableHead className="w-[30%] font-headline text-base">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} className="hover:bg-muted/50 transition-colors">
              <TableCell className="font-medium font-body py-3">{user.name}</TableCell>
              <TableCell className="font-body py-3">{user.divisionName}</TableCell>
              <TableCell className="py-3">
                <StatusIndicator status={user.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
