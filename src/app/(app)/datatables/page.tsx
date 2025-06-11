
'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import {
  getDataTableDetails,
  getDataTableRows,
  getDataTables,
  // addDataTableRow, // Future: for adding new rows
  updateDataTableRow,
  // deleteDataTableRow // Future: for deleting rows
} from '@/app/actions';
import type { DataTableDetails, DataTableRow } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from "@/hooks/use-toast";
import { Database, RefreshCw, Loader2, AlertTriangle, Edit3, Trash2, PlusCircle, Save, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const TARGET_DATATABLE_NAME = "CG_SHSV_DynamicPrompt";

export default function DataTablesPage() {
  const [dataTableDetails, setDataTableDetails] = useState<DataTableDetails | null>(null);
  const [dataTableRows, setDataTableRows] = useState<DataTableRow[]>([]);
  const [targetTableId, setTargetTableId] = useState<string | null>(null);

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editedRowData, setEditedRowData] = useState<DataTableRow | null>(null);

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
    if (!dataTableDetails?.primaryKeyField) return;
    const pkValue = row[dataTableDetails.primaryKeyField] as string;
    setEditingRowId(pkValue);
    setEditedRowData({ ...row });
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
    setEditedRowData(null);
  };

  const handleInputChange = (fieldName: string, value: string | number | boolean) => {
    setEditedRowData(prev => prev ? { ...prev, [fieldName]: value } : null);
  };

  const handleSaveEdit = () => {
    if (!targetTableId || !editingRowId || !editedRowData || !dataTableDetails?.primaryKeyField) {
      toast({ title: "Error", description: "Cannot save, missing critical data.", variant: "destructive" });
      return;
    }
    
    // Ensure the primary key in editedRowData matches editingRowId, and is not accidentally changed
    // The API requires the rowId (PK value) in the URL and the full row data in the body.
    // The primary key field in the body should match the one in the URL.
    const rowDataPayload = { ...editedRowData };
    if (rowDataPayload[dataTableDetails.primaryKeyField] !== editingRowId) {
        console.warn("Primary key in payload mismatch, correcting.", rowDataPayload[dataTableDetails.primaryKeyField], editingRowId);
        rowDataPayload[dataTableDetails.primaryKeyField] = editingRowId;
    }


    startSubmitting(async () => {
      try {
        await updateDataTableRow(targetTableId, editingRowId, rowDataPayload);
        toast({ title: "Row Updated", description: "Successfully updated the row." });
        fetchDataForTable(targetTableId); // Refresh data
        handleCancelEdit(); // Exit editing mode
      } catch (error: any) {
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
            <li>The application's OAuth client has permissions to access DataTables (e.g., `architect:datatable:view`, `architect:datatableRow:edit`).</li>
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
              </div>
              <div className="flex gap-2 mt-2 sm:mt-0">
                {/* <Button variant="outline" size="sm" disabled={isLoading || isSubmitting}> <PlusCircle className="mr-2 h-4 w-4" /> Add Row </Button> */}
                <Button onClick={handleRefresh} disabled={isLoadingRows || isLoadingDetails || isSubmitting || !!editingRowId} variant="default" size="sm">
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
                          <TableHead key={colName} className={dataTableDetails?.schema.properties[colName]?.isPrimaryKey ? 'font-bold text-primary/90' : ''}>
                            {colName}
                            <span className="block text-xs text-muted-foreground font-normal">({dataTableDetails?.schema.properties[colName]?.type})</span>
                          </TableHead>
                        ))}
                        <TableHead className="w-[120px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingRows ? (
                        [...Array(3)].map((_, i) => (
                          <TableRow key={`skel-${i}`}>
                            {orderedColumnNames.map(colName => (
                              <TableCell key={`skel-cell-${i}-${colName}`}><Skeleton className="h-5 w-full" /></TableCell>
                            ))}
                            <TableCell className="text-right"><Skeleton className="h-8 w-[100px] ml-auto" /></TableCell>
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
                          const currentPkValue = dataTableDetails?.primaryKeyField ? row[dataTableDetails.primaryKeyField] as string : `row-${rowIndex}`;
                          const isEditingThisRow = editingRowId === currentPkValue;

                          return (
                            <TableRow key={currentPkValue}>
                              {orderedColumnNames.map(colName => {
                                const colSchema = dataTableDetails?.schema.properties[colName];
                                return (
                                <TableCell key={`cell-${rowIndex}-${colName}`}>
                                  {isEditingThisRow && colName !== dataTableDetails?.primaryKeyField ? (
                                    colSchema?.type === 'boolean' ? (
                                      <Checkbox
                                        checked={editedRowData?.[colName] as boolean ?? false}
                                        onCheckedChange={(checked) => handleInputChange(colName, !!checked)}
                                        disabled={isSubmitting}
                                        aria-label={`Edit ${colName}`}
                                      />
                                    ) : colSchema?.type === 'integer' || colSchema?.type === 'number' ? (
                                      <Input
                                        type="number"
                                        value={editedRowData?.[colName] ?? ''}
                                        onChange={(e) => handleInputChange(colName, e.target.value === '' ? null : Number(e.target.value))}
                                        className="h-8 text-sm"
                                        disabled={isSubmitting}
                                        aria-label={`Edit ${colName}`}
                                      />
                                    ) : (
                                      <Input
                                        value={editedRowData?.[colName] as string ?? ''}
                                        onChange={(e) => handleInputChange(colName, e.target.value)}
                                        className="h-8 text-sm"
                                        disabled={isSubmitting}
                                        aria-label={`Edit ${colName}`}
                                      />
                                    )
                                  ) : (
                                    typeof row[colName] === 'boolean' ? row[colName] ? 'True' : 'False' :
                                    row[colName] === null || row[colName] === undefined ? <span className="text-muted-foreground italic">empty</span> : String(row[colName])
                                  )}
                                </TableCell>
                              )})}
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end">
                                  {isEditingThisRow ? (
                                    <>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-500" disabled={isSubmitting} onClick={handleSaveEdit} title="Save">
                                        <Save className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" disabled={isSubmitting} onClick={handleCancelEdit} title="Cancel">
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isSubmitting || !!editingRowId} onClick={() => handleEdit(row)} title="Edit">
                                        <Edit3 className="h-4 w-4" />
                                      </Button>
                                      {/* 
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/80" disabled={isSubmitting || !!editingRowId} onClick={() => {/ Confirm delete /}} title="Delete">
                                        <Trash2 className="h-4 w-4" />
                                      </Button> 
                                      */}
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      )}
    </div>
  );
}
