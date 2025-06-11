
'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import {
  getDataTableDetails,
  getDataTableRows,
  getDataTables,
  updateDataTableRow,
  addDataTableRow, // New action
} from '@/app/actions';
import type { DataTable, DataTableDetails, DataTableRow, DataTableColumn } from '@/app/actions';
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
import { Database, RefreshCw, Loader2, AlertTriangle, Edit3, Save, XCircle, ListFilter, PlusCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function DataTablesPage() {
  const [availableDataTables, setAvailableDataTables] = useState<DataTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | undefined>(undefined);
  
  const [dataTableDetails, setDataTableDetails] = useState<DataTableDetails | null>(null);
  const [dataTableRows, setDataTableRows] = useState<DataTableRow[]>([]);

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editedRowData, setEditedRowData] = useState<DataTableRow | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRowData, setNewRowData] = useState<DataTableRow | null>(null);

  const [isLoadingTablesList, startLoadingTablesList] = useTransition();
  const [isLoadingDetails, startLoadingDetails] = useTransition();
  const [isLoadingRows, startLoadingRows] = useTransition();
  const [isSubmitting, startSubmitting] = useTransition(); // Used for both edit and create

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
    const pkField = dataTableDetails.primaryKeyField;
    const pkValue = String(row[pkField]); 
    
    console.log(`[DataTablesPage] handleEdit: Primary Key Field Name: '${pkField}', Primary Key Value for this row: '${pkValue}'`);

    setEditingRowId(pkValue); 
    setEditedRowData({ ...row }); 
    setIsEditDialogOpen(true);
  };

  const handleCancelEdit = () => {
    setIsEditDialogOpen(false);
    setEditedRowData(null);
    setEditingRowId(null);
  };

  const handleEditDialogOpeChange = (open: boolean) => {
    if (!open) {
      handleCancelEdit();
    } else {
      setIsEditDialogOpen(true);
    }
  }

  const handleInputChange = (fieldName: string, value: string | number | boolean | null, target: 'edit' | 'create') => {
    if (target === 'edit') {
        setEditedRowData(prev => prev ? { ...prev, [fieldName]: value } : null);
    } else {
        setNewRowData(prev => prev ? { ...prev, [fieldName]: value } : null);
    }
  };

  const handleSaveEdit = () => {
    if (!selectedTableId || !editingRowId || !editedRowData || !dataTableDetails?.schema?.properties) {
      toast({ title: "Error", description: "Cannot save, missing critical data (e.g., table ID, primary key value, row data, or schema).", variant: "destructive" });
      return;
    }
    
    const payloadForUpdate: DataTableRow = {};
    const schemaProperties = dataTableDetails.schema.properties;

    for (const keyInSchema in schemaProperties) {
        if (Object.prototype.hasOwnProperty.call(schemaProperties, keyInSchema)) {
            // For updates, we send the complete row data, including the PK.
            let value = editedRowData[keyInSchema];

            if (value === undefined) { 
                payloadForUpdate[keyInSchema] = null;
            } else if (typeof value === 'number' && Number.isNaN(value)) {
                payloadForUpdate[keyInSchema] = null; 
            } else if (typeof value === 'boolean') {
                payloadForUpdate[keyInSchema] = value; // Send actual boolean
            }
            else {
                payloadForUpdate[keyInSchema] = value;
            }
        }
    }
    
    console.log("[DataTablesPage] Payload for updateDataTableRow (ALL SCHEMA FIELDS INCLUDED, native booleans):", JSON.stringify(payloadForUpdate, null, 2));

    startSubmitting(async () => {
      try {
        await updateDataTableRow(selectedTableId, editingRowId, payloadForUpdate);
        toast({ title: "Row Updated", description: "Successfully updated the row." });
        fetchDataForTable(selectedTableId); 
        handleCancelEdit(); 
      } catch (error: any) {
        toast({
          title: "Error Updating Row",
          description: error.message || "Could not update the row.",
          variant: "destructive",
        });
      }
    });
  };

  const handleOpenCreateDialog = () => {
    if (!dataTableDetails || !dataTableDetails.primaryKeyField || !dataTableDetails.schema.properties) {
      toast({ title: "Cannot Create Row", description: "Essential table schema information (like primary key or properties) is missing. Creation is disabled.", variant: "destructive"});
      return;
    }
    const initialData: DataTableRow = {};
    Object.keys(dataTableDetails.schema.properties).forEach(colName => {
      const colSchema = getColumnSchema(colName);
      if (colSchema?.type === 'boolean') {
        initialData[colName] = false; 
      } else if (colSchema?.type === 'string') {
        initialData[colName] = ''; 
      } else if (colSchema?.type === 'number' || colSchema?.type === 'integer') {
        initialData[colName] = null; 
      } else {
        initialData[colName] = ''; 
      }
    });
    setNewRowData(initialData);
    setIsCreateDialogOpen(true);
  };

  const handleCancelCreate = () => {
    setIsCreateDialogOpen(false);
    setNewRowData(null);
  };

  const handleCreateDialogOpeChange = (open: boolean) => {
    if (!open) {
      handleCancelCreate();
    } else {
      setIsCreateDialogOpen(true);
    }
  };

  const handleSaveCreate = () => {
    if (!selectedTableId || !newRowData || !dataTableDetails?.primaryKeyField || !dataTableDetails?.schema?.properties) {
      toast({ title: "Error Creating Row", description: "Missing critical data (e.g., table ID, primary key field definition, schema properties, or row data).", variant: "destructive" });
      return;
    }
    const pkField = dataTableDetails.primaryKeyField;
    if (newRowData[pkField] === undefined || newRowData[pkField] === null || String(newRowData[pkField]).trim() === '') {
        toast({ title: "Primary Key Required", description: `The primary key field "${pkField}" cannot be empty.`, variant: "destructive" });
        return;
    }

    const rowDataPayload: DataTableRow = {};
    const schemaProperties = dataTableDetails.schema.properties;

    for (const key in schemaProperties) {
        if (Object.prototype.hasOwnProperty.call(schemaProperties, key)) {
            let value = newRowData[key];

            if (value === undefined) {
                rowDataPayload[key] = null;
            } else if (typeof value === 'number' && Number.isNaN(value)) {
                rowDataPayload[key] = null;
            } else if (typeof value === 'boolean') {
                rowDataPayload[key] = value; 
            }
            else {
                rowDataPayload[key] = value;
            }
        }
    }
    
    console.log("[DataTablesPage] Payload for addDataTableRow (ALL SCHEMA FIELDS PRESENT, native booleans):", JSON.stringify(rowDataPayload, null, 2));

    startSubmitting(async () => {
      try {
        await addDataTableRow(selectedTableId, rowDataPayload);
        toast({ title: "Row Created", description: "Successfully created the new row." });
        fetchDataForTable(selectedTableId);
        handleCancelCreate();
      } catch (error: any) {
        toast({
          title: "Error Creating Row",
          description: error.message || "Could not create the row. The primary key might already exist or data is invalid.",
          variant: "destructive",
        });
      }
    });
  };


  const isLoadingCurrentTableData = isLoadingDetails || isLoadingRows;
  const currentTableName = dataTableDetails?.name || "the selected table";
  
  const getColumnSchema = (colName: string): DataTableColumn | undefined => {
    return dataTableDetails?.schema?.properties?.[colName];
  };

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
          Select a Genesys Cloud DataTable to view, manage its rows, or create new entries.
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
                    Warning: Primary key not identified by the API for this table. Editing and Creation will be disabled. 
                    (Ensure a primary key is set in Genesys Cloud for "{currentTableName}".)
                  </p>
                )}
              </div>
              <div className="flex gap-2 mt-2 sm:mt-0">
                <Button 
                  onClick={handleOpenCreateDialog} 
                  disabled={isLoadingCurrentTableData || isSubmitting || isEditDialogOpen || isCreateDialogOpen || !selectedTableId || !dataTableDetails?.primaryKeyField} 
                  variant="outline" 
                  size="sm"
                  title={!dataTableDetails?.primaryKeyField ? "Create disabled: No primary key defined" : "Create new row"}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create Row
                </Button>
                <Button onClick={handleRefresh} disabled={isLoadingCurrentTableData || isSubmitting || isEditDialogOpen || isCreateDialogOpen || !selectedTableId} variant="default" size="sm">
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
                              ({getColumnSchema(colName)?.type || 'unknown'})
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
                              {orderedColumnNames.map(colName => {
                                const colSchema = getColumnSchema(colName);
                                const cellValue = row[colName];
                                
                                let displayAsCheckbox = false;
                                if (colSchema?.type === 'boolean') {
                                  displayAsCheckbox = true;
                                } else if (colSchema?.type === 'string') {
                                  const lowerCellValue = String(cellValue).toLowerCase();
                                  if (lowerCellValue === 'true' || lowerCellValue === 'false') {
                                    displayAsCheckbox = true;
                                  }
                                }

                                return (
                                  <TableCell key={`cell-${rowIndex}-${colName}`} className={colName === dataTableDetails?.primaryKeyField ? 'font-semibold text-primary/80' : ''}>
                                    {displayAsCheckbox ? (
                                      <Checkbox checked={String(cellValue).toLowerCase() === 'true'} disabled aria-label={String(cellValue)} />
                                    ) : cellValue === null || cellValue === undefined ? (
                                      <span className="text-muted-foreground italic">empty</span>
                                    ) : (
                                      String(cellValue)
                                    )}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-right">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8" 
                                  disabled={isSubmitting || isEditDialogOpen || isCreateDialogOpen || !dataTableDetails?.primaryKeyField} 
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

          {/* Edit Row Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogOpeChange}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Edit Row for {currentTableName}</DialogTitle>
                <DialogDescription>
                  Modify the fields for the selected row. The primary key cannot be changed.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                {editedRowData && dataTableDetails?.primaryKeyField && getColumnSchema(dataTableDetails.primaryKeyField) && (
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
                    .map(([colName, colDef]) => {
                      const colSchema = colDef as DataTableColumn;
                      const currentValue = editedRowData?.[colName];
                      
                      let treatAsBooleanInput = false;
                      if (colSchema.type === 'boolean') {
                        treatAsBooleanInput = true;
                      } else if (colSchema.type === 'string') {
                        const lowerCurrentValue = String(currentValue).toLowerCase();
                        if (lowerCurrentValue === 'true' || lowerCurrentValue === 'false') {
                          treatAsBooleanInput = true;
                        }
                      }
                      
                      return (
                        <div className="grid grid-cols-4 items-center gap-4" key={colName}>
                          <Label htmlFor={`edit-${colName}`} className="text-right col-span-1">
                            {colName} ({colSchema.type})
                          </Label>
                          <div className="col-span-3">
                            {treatAsBooleanInput ? (
                              <Checkbox
                                id={`edit-${colName}`}
                                checked={String(currentValue).toLowerCase() === 'true'}
                                onCheckedChange={(checked) => handleInputChange(colName, !!checked, 'edit')} 
                                disabled={isSubmitting}
                                aria-label={`Edit ${colName}`}
                              />
                            ) : colSchema.type === 'integer' || colSchema.type === 'number' ? (
                              <Input
                                id={`edit-${colName}`}
                                type="number"
                                value={currentValue === null || currentValue === undefined ? '' : String(currentValue)}
                                onChange={(e) => handleInputChange(colName, e.target.value === '' ? null : Number(e.target.value), 'edit')}
                                className="h-9"
                                disabled={isSubmitting}
                                aria-label={`Edit ${colName}`}
                              />
                            ) : (
                              <Input
                                id={`edit-${colName}`}
                                value={currentValue as string ?? ''}
                                onChange={(e) => handleInputChange(colName, e.target.value, 'edit')}
                                className="h-9"
                                disabled={isSubmitting}
                                aria-label={`Edit ${colName}`}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
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

          {/* Create Row Dialog */}
          <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogOpeChange}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Row in {currentTableName}</DialogTitle>
                <DialogDescription>
                  Provide values for all fields. The primary key field must be unique.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                {newRowData && dataTableDetails && dataTableDetails.schema.properties &&
                  orderedColumnNames.map((colName) => {
                      const colSchema = getColumnSchema(colName) as DataTableColumn;
                      const currentValue = newRowData?.[colName];
                      const isPrimaryKey = colName === dataTableDetails.primaryKeyField;

                      let treatAsBooleanInput = false;
                      if (colSchema.type === 'boolean') {
                        treatAsBooleanInput = true;
                      }
                      
                      return (
                        <div className="grid grid-cols-4 items-center gap-4" key={`create-${colName}`}>
                          <Label htmlFor={`create-${colName}`} className={`text-right col-span-1 ${isPrimaryKey ? 'font-bold' : ''}`}>
                            {colName} {isPrimaryKey ? '(Key)' : ''} ({colSchema.type})
                          </Label>
                          <div className="col-span-3">
                            {treatAsBooleanInput ? ( 
                              <Checkbox
                                id={`create-${colName}`}
                                checked={!!currentValue} 
                                onCheckedChange={(checked) => handleInputChange(colName, !!checked, 'create')}
                                disabled={isSubmitting}
                                aria-label={`Create ${colName}`}
                              />
                            ) : colSchema.type === 'integer' || colSchema.type === 'number' ? (
                              <Input
                                id={`create-${colName}`}
                                type="number"
                                value={currentValue === null || currentValue === undefined ? '' : String(currentValue)}
                                onChange={(e) => handleInputChange(colName, e.target.value === '' ? null : Number(e.target.value), 'create')}
                                className="h-9"
                                disabled={isSubmitting}
                                aria-label={`Create ${colName}`}
                              />
                            ) : (
                              <Input
                                id={`create-${colName}`}
                                value={currentValue as string ?? ''}
                                onChange={(e) => handleInputChange(colName, e.target.value, 'create')}
                                className="h-9"
                                disabled={isSubmitting}
                                aria-label={`Create ${colName}`}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isSubmitting}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="button" onClick={handleSaveCreate} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Create Row
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
    

    

    