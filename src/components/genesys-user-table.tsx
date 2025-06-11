
'use client';

import React, { useState, useMemo } from 'react';
import type { UserStatus } from '@/app/actions';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { StatusIndicator, STATUS_ORDER } from './status-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'; // Minus for unsorted or as a placeholder

interface GenesysUserTableProps {
  users: UserStatus[];
  isLoading: boolean;
}

type SortableColumn = 'name' | 'divisionName' | 'status';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortableColumn;
  direction: SortDirection;
}

export function GenesysUserTable({ users, isLoading }: GenesysUserTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'name', direction: 'asc' });

  const sortedUsers = useMemo(() => {
    let sortableUsers = [...users];
    if (sortConfig !== null) {
      sortableUsers.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        if (sortConfig.key === 'status') {
          aValue = STATUS_ORDER.indexOf(a.status);
          bValue = STATUS_ORDER.indexOf(b.status);
        } else {
          aValue = a[sortConfig.key].toLowerCase();
          bValue = b[sortConfig.key].toLowerCase();
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableUsers;
  }, [users, sortConfig]);

  const requestSort = (key: SortableColumn) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: SortableColumn) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return <Minus className="h-4 w-4 ml-1 opacity-40" />; // Or some other neutral icon
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="h-4 w-4 ml-1" />;
    }
    return <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const renderHeader = (label: string, columnKey: SortableColumn) => (
    <TableHead className="font-headline text-base cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => requestSort(columnKey)}>
      <div className="flex items-center">
        {label}
        {getSortIcon(columnKey)}
      </div>
    </TableHead>
  );


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
            {renderHeader('Name', 'name')}
            {renderHeader('Division', 'divisionName')}
            {renderHeader('Status', 'status')}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedUsers.map((user) => (
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
