
'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import {
  getDataTableDetails,
  getDataTableRows,
  getDataTables,
  updateDataTableRow,
} from '@/app/actions';
import type { DataTable, DataTableDetails, DataTableRow } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from "@/hooks/use-toast";
import { Database, RefreshCw, Loader2, AlertTriangle, Edit3, Save, XCircle, ListFilter } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function DataTablesPage() {
  const [availableDataTables, setAvailableDataTables] = useState<DataTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | undefined>(undefined);
  
  const [dataTableDetails, setDataTableDetails] = useState<DataTableDetails | null>(null);
  const [dataTableRows, setDataTableRows] = useState<DataTableRow[]>([]);

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editedRowData, setEditedRowData] = useState<DataTableRow | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [isLoadingTablesList, startLoadingTablesList] = useTransition();
  const [isLoadingDetails, startLoadingDetails] = useTransition();
  const [isLoadingRows, startLoadingRows] = useTransition();
  const [isSubmitting, startSubmitting] = useTransition();

  useEffect(() => {
    startLoadingTablesList(async () => {
      try {
        const allTables = await getDataTables();
        setAvailableDataTables(allTables.sort((a,b) => a.name.localeCompare(b.name)));
        if (allTables.length === 0) {
            toast({
                title: "No DataTables Found",
                description: "No DataTables were found in your Genesys Cloud organization, or the application lacks permissions to view them.",
                variant: "default",
                duration: 7000,
            })
        }
      } catch (error: any) {
        toast({
          title: "Error Fetching DataTable List",
          description: error.message || "Could not retrieve list of DataTables.",
          variant: "destructive",
        });
        setAvailableDataTables([]);
      }
    });
  }, []);

  const fetchDataForTable = (tableId: string) => {
    startLoadingDetails(async () => {
      try {
        setDataTableDetails(null); 
        setDataTableRows([]); 
        const details = await getDataTableDetails(tableId);
        setDataTableDetails(details);
      } catch (error: any) {
        toast({
          title: `Error Fetching Details for selected table`,
          description: error.message,
          variant: "destructive",
        });
        setDataTableDetails(null);
      }
    });

    startLoadingRows(async () => {
      try {
        const rows = await getDataTableRows(tableId, true); 
        setDataTableRows(rows);
      } catch (error: any) {
        toast({
          title: `Error Fetching Rows for selected table`,
          description: error.message,
          variant: "destructive",
        });
        setDataTableRows([]);
      }
    });
  };

  useEffect(() => {
    if (selectedTableId) {
      fetchDataForTable(selectedTableId);
    } else {
      setDataTableDetails(null);
      setDataTableRows([]);
    }
  }, [selectedTableId]);

  const handleRefresh = () => {
    if (!selectedTableId) {
      toast({ title: "Cannot Refresh", description: "No DataTable selected.", variant: "default"});
      return;
    };
    fetchDataForTable(selectedTableId);
    const selectedTableName = availableDataTables.find(t => t.id === selectedTableId)?.name || "selected table";
    toast({ title: "Data Refreshed", description: `Data for ${selectedTableName} is being updated.` });
  };

  const orderedColumnNames = useMemo(() => {
    if (!dataTableDetails?.schema?.properties) return [];
    const pkField = dataTableDetails.primaryKeyField;
    const allColumnNames = Object.keys(dataTableDetails.schema.properties);
  
    const sortedAllColumnNames = [...allColumnNames].sort((a, b) => a.localeCompare(b));
  
    if (pkField && sortedAllColumnNames.includes(pkField)) {
      const index = sortedAllColumnNames.indexOf(pkField);
      sortedAllColumnNames.splice(index, 1); 
      return [pkField, ...sortedAllColumnNames]; 
    }
    return sortedAllColumnNames;
  }, [dataTableDetails]);
  

  const handleEdit = (row: DataTableRow) => {
    if (!dataTableDetails?.primaryKeyField) {
      toast({ title: "Error", description: "Primary key field not defined for this table. Editing is disabled.", variant: "destructive" });
      return;
    }
    const pkValue = String(row[dataTableDetails.primaryKeyField]); 
    setEditingRowId(pkValue); 
    setEditedRowData({ ...row }); 
    setIsEditDialogOpen(true);
  };

  const handleCancelEdit = () => {
    setIsEditDialogOpen(false);
    setEditedRowData(null);
    setEditingRowId(null);
  };

  const handleDialogOpeChange = (open: boolean) => {
    if (!open) {
      handleCancelEdit();
    } else {
      setIsEditDialogOpen(true);
    }
  }

  const handleInputChange = (fieldName: string, value: string | number | boolean | null) => {
    setEditedRowData(prev => prev ? { ...prev, [fieldName]: value } : null);
  };

  const handleSaveEdit = () => {
    if (!selectedTableId || !editingRowId || !editedRowData || !dataTableDetails?.primaryKeyField) {
      toast({ title: "Error", description: "Cannot save, missing critical data (e.g., table ID, primary key).", variant: "destructive" });
      return;
    }
    
    const rowDataPayload: Partial<DataTableRow> = { ...editedRowData };

    for (const key in rowDataPayload) {
      if (Object.prototype.hasOwnProperty.call(rowDataPayload, key)) {
        if (typeof rowDataPayload[key] === 'number' && Number.isNaN(rowDataPayload[key])) {
          rowDataPayload[key] = null;
        }
      }
    }
        
    rowDataPayload[dataTableDetails.primaryKeyField] = editingRowId;


    startSubmitting(async () => {
      try {
        await updateDataTableRow(selectedTableId, editingRowId, rowDataPayload as DataTableRow);
        toast({ title: "Row Updated", description: "Successfully updated the row." });
        fetchDataForTable(selectedTableId); 
        handleCancelEdit(); 
      } catch (error: any)
      {
        toast({
          title: "Error Updating Row",
          description: error.message || "Could not update the row.",
          variant: "destructive",
        });
      }
    });
  };

  const isLoadingCurrentTableData = isLoadingDetails || isLoadingRows;
  const currentTableName = dataTableDetails?.name || "the selected table";

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex flex-col items-center selection:bg-primary/30 selection:text-primary-foreground">
      <header className="w-full max-w-6xl mb-8 text-center">
        <div className="flex items-center justify-center mb-4" role="banner">
          <Database className="w-12 h-12 mr-3 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary tracking-tight">
            DataTable Management
          </h1>
        </div>
        <p className="text-md sm:text-lg text-muted-foreground font-body max-w-2xl mx-auto">
          Select a Genesys Cloud DataTable to view and manage its rows.
        </p>
      </header>

      <div className="w-full max-w-2xl mb-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center">
              <ListFilter className="mr-2 h-5 w-5 text-accent" />
              Select DataTable
            </CardTitle>
            <CardDescription>Choose a DataTable from the list below.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTablesList ? (
              <Skeleton className="h-10 w-full" />
            ) : availableDataTables.length === 0 ? (
                <p className="text-muted-foreground text-center py-3">
                    No DataTables found or an error occurred fetching them. Check permissions.
                </p>
            ) : (
              <Select onValueChange={setSelectedTableId} value={selectedTableId} disabled={isLoadingTablesList}>
                <SelectTrigger aria-label="Select a DataTable">
                  <SelectValue placeholder="Select a DataTable..." />
                </SelectTrigger>
                <SelectContent>
                  {availableDataTables.map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      {table.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedTableId && (
        <main className="w-full max-w-6xl space-y-6">
          <Card className="shadow-lg">
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <CardTitle className="flex items-center">
                  {isLoadingDetails && !dataTableDetails ? <Skeleton className="h-7 w-48" /> : dataTableDetails?.name || "Loading..." }
                  {isLoadingDetails && <Loader2 className="h-5 w-5 animate-spin text-primary ml-3" />}
                </CardTitle>
                <CardDescription className="mt-1">
                  {isLoadingDetails && !dataTableDetails ? <Skeleton className="h-4 w-64" /> : dataTableDetails?.description || "No description provided."}
                </CardDescription>
                 {dataTableDetails?.primaryKeyField && (
                    <p className="text-xs text-muted-foreground mt-1">Primary Key: <strong className="text-primary/90">{dataTableDetails.primaryKeyField}</strong></p>
                  )}
                {!dataTableDetails?.primaryKeyField && !isLoadingDetails && dataTableDetails && (
                  <p className="text-xs text-destructive mt-1 font-semibold">
                    Warning: Primary key not identified by the API for this table. Editing will be disabled. 
                    (Ensure a primary key is set in Genesys Cloud for "{currentTableName}".)
                  </p>
                )}
              </div>
              <div className="flex gap-2 mt-2 sm:mt-0">
                <Button onClick={handleRefresh} disabled={isLoadingCurrentTableData || isSubmitting || isEditDialogOpen || !selectedTableId} variant="default" size="sm">
                  <RefreshCw className={`mr-2 h-4 w-4 ${(isLoadingCurrentTableData) ? 'animate-spin' : ''}`} />
                  {(isLoadingCurrentTableData) ? 'Refreshing...' : 'Refresh Data'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingDetails && !dataTableDetails ? (
                <>
                  <Skeleton className="h-10 w-full mb-1" />
                  <Skeleton className="h-10 w-full mb-1" />
                  <Skeleton className="h-10 w-full" />
                </>
              ) : !dataTableDetails && !isLoadingDetails ? (
                <p className="text-center text-muted-foreground py-8">Could not load DataTable details for "{currentTableName}".</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {orderedColumnNames.map(colName => (
                          <TableHead 
                            key={colName} 
                            className={colName === dataTableDetails?.primaryKeyField ? 'font-bold text-primary/90' : ''}
                          >
                            {colName}
                            <span className="block text-xs text-muted-foreground font-normal">
                              ({dataTableDetails?.schema.properties[colName]?.type || 'unknown'})
                            </span>
                          </TableHead>
                        ))}
                        <TableHead className="w-[80px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingRows ? (
                        [...Array(3)].map((_, i) => (
                          <TableRow key={`skel-${i}`}>
                            {orderedColumnNames.map(colName => (
                              <TableCell key={`skel-cell-${i}-${colName}`}><Skeleton className="h-5 w-full" /></TableCell>
                            ))}
                            <TableCell className="text-right"><Skeleton className="h-8 w-[60px] ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : dataTableRows.length === 0 ? (
                         <TableRow>
                            <TableCell colSpan={orderedColumnNames.length + 1} className="text-center text-muted-foreground h-24">
                                No rows found in this DataTable.
                            </TableCell>
                        </TableRow>
                      ) : (
                        dataTableRows.map((row, rowIndex) => {
                          const currentPkValue = dataTableDetails?.primaryKeyField ? String(row[dataTableDetails.primaryKeyField]) : `row-${rowIndex}`;
                          return (
                            <TableRow key={currentPkValue}>
                              {orderedColumnNames.map(colName => (
                                <TableCell key={`cell-${rowIndex}-${colName}`} className={colName === dataTableDetails?.primaryKeyField ? 'font-semibold text-primary/80' : ''}>
                                  {dataTableDetails?.schema.properties[colName]?.type === 'boolean' ? (
                                    <Checkbox checked={!!row[colName]} disabled aria-label={String(row[colName])} />
                                  ) : row[colName] === null || row[colName] === undefined ? (
                                    <span className="text-muted-foreground italic">empty</span>
                                  ) : (
                                    String(row[colName])
                                  )}
                                </TableCell>
                              ))}
                              <TableCell className="text-right">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8" 
                                  disabled={isSubmitting || isEditDialogOpen || !dataTableDetails?.primaryKeyField} 
                                  onClick={() => handleEdit(row)} 
                                  title={!dataTableDetails?.primaryKeyField ? "Edit disabled: No primary key defined by API" : "Edit row"}
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={isEditDialogOpen} onOpenChange={handleDialogOpeChange}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Edit Row for {currentTableName}</DialogTitle>
                <DialogDescription>
                  Modify the fields for the selected row. The primary key cannot be changed.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                {editedRowData && dataTableDetails?.primaryKeyField && dataTableDetails.schema.properties[dataTableDetails.primaryKeyField] && (
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor={dataTableDetails.primaryKeyField} className="text-right col-span-1 font-semibold">
                            {dataTableDetails.primaryKeyField} (Key)
                        </Label>
                        <div className="col-span-3 text-sm text-muted-foreground pt-2">
                            {String(editedRowData[dataTableDetails.primaryKeyField])}
                        </div>
                    </div>
                 )}

                {editedRowData && dataTableDetails && dataTableDetails.schema.properties &&
                  Object.entries(dataTableDetails.schema.properties)
                    .filter(([colName]) => colName !== dataTableDetails.primaryKeyField) 
                    .sort(([aName], [bName]) => aName.localeCompare(bName)) 
                    .map(([colName, colSchema]) => (
                      <div className="grid grid-cols-4 items-center gap-4" key={colName}>
                        <Label htmlFor={colName} className="text-right col-span-1">
                          {colName} ({colSchema.type})
                        </Label>
                        <div className="col-span-3">
                          {colSchema.type === 'boolean' ? (
                            <Checkbox
                              id={colName}
                              checked={editedRowData?.[colName] as boolean ?? false}
                              onCheckedChange={(checked) => handleInputChange(colName, !!checked)}
                              disabled={isSubmitting}
                              aria-label={`Edit ${colName}`}
                            />
                          ) : colSchema.type === 'integer' || colSchema.type === 'number' ? (
                            <Input
                              id={colName}
                              type="number"
                              value={editedRowData?.[colName] === null || editedRowData?.[colName] === undefined ? '' : String(editedRowData?.[colName])}
                              onChange={(e) => handleInputChange(colName, e.target.value === '' ? null : Number(e.target.value))}
                              className="h-9"
                              disabled={isSubmitting}
                              aria-label={`Edit ${colName}`}
                            />
                          ) : (
                            <Input
                              id={colName}
                              value={editedRowData?.[colName] as string ?? ''}
                              onChange={(e) => handleInputChange(colName, e.target.value)}
                              className="h-9"
                              disabled={isSubmitting}
                              aria-label={`Edit ${colName}`}
                            />
                          )}
                        </div>
                      </div>
                    ))}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isSubmitting}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="button" onClick={handleSaveEdit} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      )}

      {!selectedTableId && !isLoadingTablesList && availableDataTables.length > 0 && (
         <div className="text-center text-muted-foreground mt-10">
            <AlertTriangle className="mx-auto h-12 w-12 text-primary/50 mb-4" />
            <p className="text-lg">Please select a DataTable from the dropdown above to view its details and rows.</p>
        </div>
      )}
    </div>
  );
}
    
