
'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import {
  getDataTableDetails,
  getDataTableRows,
  getDataTables,
  updateDataTableRow,
} from '@/app/actions';
import type { DataTableDetails, DataTableRow } from '@/app/actions';
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
import { Database, RefreshCw, Loader2, AlertTriangle, Edit3, Save, XCircle, PlusCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const TARGET_DATATABLE_NAME = "CG_SHSV_DynamicPrompt";

export default function DataTablesPage() {
  const [dataTableDetails, setDataTableDetails] = useState<DataTableDetails | null>(null);
  const [dataTableRows, setDataTableRows] = useState<DataTableRow[]>([]);
  const [targetTableId, setTargetTableId] = useState<string | null>(null);

  const [editingRowId, setEditingRowId] = useState<string | null>(null); // Stores the PK of the row being edited
  const [editedRowData, setEditedRowData] = useState<DataTableRow | null>(null); // Stores the data for the form in the dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [isLoadingDetails, startLoadingDetails] = useTransition();
  const [isLoadingRows, startLoadingRows] = useTransition();
  const [isLoadingInitialSearch, startLoadingInitialSearch] = useTransition();
  const [isSubmitting, startSubmitting] = useTransition();

  useEffect(() => {
    startLoadingInitialSearch(async () => {
      try {
        const allTables = await getDataTables();
        const target = allTables.find(table => table.name === TARGET_DATATABLE_NAME);
        if (target) {
          setTargetTableId(target.id);
        } else {
          toast({
            title: "Error: DataTable Not Found",
            description: `The DataTable "${TARGET_DATATABLE_NAME}" could not be found. Please check its name and ensure it exists in Genesys Cloud.`,
            variant: "destructive",
            duration: 10000,
          });
        }
      } catch (error: any) {
        toast({
          title: "Error Fetching DataTable List",
          description: error.message || "Could not retrieve list of DataTables.",
          variant: "destructive",
        });
      }
    });
  }, []);

  const fetchDataForTable = (tableId: string) => {
    startLoadingDetails(async () => {
      try {
        const details = await getDataTableDetails(tableId);
        setDataTableDetails(details);
      } catch (error: any) {
        toast({
          title: `Error Fetching Details for ${TARGET_DATATABLE_NAME}`,
          description: error.message,
          variant: "destructive",
        });
        setDataTableDetails(null);
      }
    });

    startLoadingRows(async () => {
      try {
        const rows = await getDataTableRows(tableId, true); // showEmptyFields = true
        setDataTableRows(rows);
      } catch (error: any) {
        toast({
          title: `Error Fetching Rows for ${TARGET_DATATABLE_NAME}`,
          description: error.message,
          variant: "destructive",
        });
        setDataTableRows([]);
      }
    });
  };

  useEffect(() => {
    if (targetTableId) {
      fetchDataForTable(targetTableId);
    }
  }, [targetTableId]);

  const handleRefresh = () => {
    if (!targetTableId) {
      toast({ title: "Cannot Refresh", description: "Target DataTable ID not found.", variant: "destructive"});
      return;
    };
    fetchDataForTable(targetTableId);
    toast({ title: "Data Refreshed", description: `Data for ${TARGET_DATATABLE_NAME} is being updated.` });
  };

  const orderedColumnNames = useMemo(() => {
    if (!dataTableDetails?.schema?.properties) return [];
    const pkField = dataTableDetails.primaryKeyField;
    const otherColumns = Object.keys(dataTableDetails.schema.properties)
      .filter(name => name !== pkField)
      .sort();
    return pkField ? [pkField, ...otherColumns] : otherColumns;
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
    if (!targetTableId || !editingRowId || !editedRowData || !dataTableDetails?.primaryKeyField) {
      toast({ title: "Error", description: "Cannot save, missing critical data (e.g., primary key).", variant: "destructive" });
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
        await updateDataTableRow(targetTableId, editingRowId, rowDataPayload as DataTableRow);
        toast({ title: "Row Updated", description: "Successfully updated the row." });
        fetchDataForTable(targetTableId); 
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

  const isLoading = isLoadingDetails || isLoadingRows || isLoadingInitialSearch;

  if (isLoadingInitialSearch && !targetTableId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Searching for DataTable "{TARGET_DATATABLE_NAME}"...</p>
      </div>
    );
  }

  if (!targetTableId && !isLoadingInitialSearch) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-10 shadow-lg bg-destructive/10 border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center text-destructive-foreground">
            <AlertTriangle className="h-6 w-6 mr-2" /> DataTable Not Found
          </CardTitle>
        </CardHeader>
        <CardContent className="text-destructive-foreground/90">
          <p>The DataTable "<strong>{TARGET_DATATABLE_NAME}</strong>" could not be found in your Genesys Cloud organization.</p>
          <p className="mt-2">Please verify:</p>
          <ul className="list-disc list-inside ml-4 mt-1">
            <li>The DataTable name is correct.</li>
            <li>The DataTable exists in the expected Genesys Cloud division.</li>
            <li>The application's OAuth client has permissions to access DataTables.</li>
          </ul>
        </CardContent>
      </Card>
    );
  }

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
          View and manage rows for the Genesys Cloud DataTable.
        </p>
      </header>

      {targetTableId && (
        <main className="w-full max-w-6xl space-y-6">
          <Card className="shadow-lg">
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <CardTitle className="flex items-center">
                  {isLoadingDetails && !dataTableDetails ? <Skeleton className="h-7 w-48" /> : dataTableDetails?.name || TARGET_DATATABLE_NAME }
                  {isLoadingDetails && <Loader2 className="h-5 w-5 animate-spin text-primary ml-3" />}
                </CardTitle>
                <CardDescription className="mt-1">
                  {isLoadingDetails && !dataTableDetails ? <Skeleton className="h-4 w-64" /> : dataTableDetails?.description || "No description provided."}
                </CardDescription>
                 {dataTableDetails?.primaryKeyField && (
                    <p className="text-xs text-muted-foreground mt-1">Primary Key: <strong>{dataTableDetails.primaryKeyField}</strong></p>
                  )}
                {!dataTableDetails?.primaryKeyField && !isLoadingDetails && dataTableDetails && (
                  <p className="text-xs text-destructive mt-1 font-semibold">Warning: Primary key not identified. Editing will be disabled.</p>
                )}
              </div>
              <div className="flex gap-2 mt-2 sm:mt-0">
                <Button onClick={handleRefresh} disabled={isLoadingRows || isLoadingDetails || isSubmitting || isEditDialogOpen} variant="default" size="sm">
                  <RefreshCw className={`mr-2 h-4 w-4 ${(isLoadingRows || isLoadingDetails) ? 'animate-spin' : ''}`} />
                  {(isLoadingRows || isLoadingDetails) ? 'Refreshing...' : 'Refresh Data'}
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
                <p className="text-center text-muted-foreground py-8">Could not load DataTable details for "{TARGET_DATATABLE_NAME}".</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {orderedColumnNames.map(colName => (
                          <TableHead key={colName} className={colName === dataTableDetails?.primaryKeyField ? 'font-bold text-primary/90' : ''}>
                            {colName}
                            <span className="block text-xs text-muted-foreground font-normal">({dataTableDetails?.schema.properties[colName]?.type})</span>
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
                                <TableCell key={`cell-${rowIndex}-${colName}`}>
                                  {typeof row[colName] === 'boolean' ? row[colName] ? 'True' : 'False' :
                                   row[colName] === null || row[colName] === undefined ? <span className="text-muted-foreground italic">empty</span> : String(row[colName])}
                                </TableCell>
                              ))}
                              <TableCell className="text-right">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8" 
                                  disabled={isSubmitting || isEditDialogOpen || !dataTableDetails?.primaryKeyField} 
                                  onClick={() => handleEdit(row)} 
                                  title={!dataTableDetails?.primaryKeyField ? "Edit disabled: No primary key defined" : "Edit row"}
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
                <DialogTitle>Edit Row</DialogTitle>
                <DialogDescription>
                  Modify the fields for the selected row. The primary key cannot be changed.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
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
                 {dataTableDetails?.primaryKeyField && editedRowData?.[dataTableDetails.primaryKeyField] && (
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right col-span-1 font-semibold">{dataTableDetails.primaryKeyField} (Key)</Label>
                        <div className="col-span-3 text-sm text-muted-foreground">
                            {String(editedRowData[dataTableDetails.primaryKeyField])}
                        </div>
                    </div>
                 )}
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
    </div>
  );
}
