
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
// Badge removed as skills are no longer displayed
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GenesysUserTableProps {
  users: UserStatus[];
  isLoading: boolean;
}

type SortableColumn = 'name' | 'email' | 'divisionName' | 'status' | 'extension';
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
        } else if (sortConfig.key === 'extension') {
            aValue = a.extension?.toLowerCase() || '';
            bValue = b.extension?.toLowerCase() || '';
        } else if (sortConfig.key === 'email') {
            aValue = a.email?.toLowerCase() || '';
            bValue = b.email?.toLowerCase() || '';
        }
         else {
          // Handles 'name' and 'divisionName'
          aValue = (a[sortConfig.key as keyof Omit<UserStatus, 'divisionId' | 'id'>] as string)?.toLowerCase() || '';
          bValue = (b[sortConfig.key as keyof Omit<UserStatus, 'divisionId' | 'id'>] as string)?.toLowerCase() || '';
        }


        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        // Secondary sort by name if primary sort values are equal
        if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
        if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
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
      return <Minus className="h-3 w-3 ml-1 opacity-30" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="h-3 w-3 ml-1" />;
    }
    return <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const renderHeader = (label: string, columnKey?: SortableColumn, fixedWidth?: string) => (
    <TableHead
        className={cn(
            "font-semibold text-sm", 
            columnKey && "cursor-pointer hover:bg-muted/50 transition-colors",
            fixedWidth && `w-[${fixedWidth}]`
        )}
        onClick={columnKey ? () => requestSort(columnKey) : undefined}
        style={fixedWidth ? { width: fixedWidth } : {}}
    >
      <div className="flex items-center">
        {label}
        {columnKey && getSortIcon(columnKey)}
      </div>
    </TableHead>
  );


  if (isLoading && users.length === 0) {
    return (
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {renderHeader('Name', 'name', '25%')}
              {renderHeader('Email / Login', 'email', '30%')}
              {renderHeader('Division', 'divisionName', '20%')}
              {renderHeader('Status', 'status', '15%')}
              {renderHeader('Extension', 'extension', '10%')}
              {/* Skills column removed */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i} className="hover:bg-muted/50">
                <TableCell><Skeleton className="h-5 w-3/4 rounded" /></TableCell>
                <TableCell><Skeleton className="h-5 w-full rounded" /></TableCell>
                <TableCell><Skeleton className="h-5 w-3/4 rounded" /></TableCell>
                <TableCell><Skeleton className="h-5 w-1/2 rounded" /></TableCell>
                <TableCell><Skeleton className="h-5 w-1/2 rounded" /></TableCell>
                {/* Skills cell removed */}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!isLoading && users.length === 0) {
    return (
      <div className="rounded-lg border bg-card shadow-sm p-8 text-center">
        <p className="text-md text-muted-foreground">No users found for the selected criteria.</p>
        <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or refreshing the data.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
      <Table className="min-w-full">
        <TableHeader>
          <TableRow>
            {renderHeader('Name', 'name', '25%')}
            {renderHeader('Email / Login', 'email', '30%')}
            {renderHeader('Division', 'divisionName', '20%')}
            {renderHeader('Status', 'status', '15%')}
            {renderHeader('Extension', 'extension', '10%')}
            {/* Skills column removed */}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedUsers.map((user) => (
            <TableRow key={user.id} className="hover:bg-muted/50 transition-colors text-sm">
              <TableCell className="font-medium py-2.5">{user.name}</TableCell>
              <TableCell className="py-2.5 text-xs">{user.email || <span className="text-xs text-muted-foreground italic">N/A</span>}</TableCell>
              <TableCell className="py-2.5">{user.divisionName}</TableCell>
              <TableCell className="py-2.5">
                <StatusIndicator status={user.status} />
              </TableCell>
              <TableCell className="py-2.5">{user.extension || <span className="text-xs text-muted-foreground italic">N/A</span>}</TableCell>
              {/* Skills cell removed */}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

