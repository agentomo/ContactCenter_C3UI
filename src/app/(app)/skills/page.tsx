
'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { getGenesysUsers, getAllSkills, getUserSkills, updateUserSkills } from '@/app/actions';
import type { UserStatus, SkillDefinition, UserRoutingSkill, UserRoutingSkillUpdateItem } from '@/app/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { Badge } from '@/components/ui/badge';
import { toast } from "@/hooks/use-toast";
import { ListTodo, UserCog, X, PlusCircle, Save, Filter, UserCircle, Building2, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusIndicator } from '@/components/status-indicator'; // Added import for StatusIndicator

interface Division {
  id: string;
  name: string;
}

export default function SkillsManagementPage() {
  const [allUsers, setAllUsers] = useState<UserStatus[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [allSkills, setAllSkills] = useState<SkillDefinition[]>([]);
  const [currentUserSkills, setCurrentUserSkills] = useState<UserRoutingSkill[]>([]);
  const [modifiedSkills, setModifiedSkills] = useState<Map<string, number>>(new Map()); // skillId -> proficiency
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('all');

  const [isLoadingUsers, startLoadingUsers] = useTransition();
  const [isLoadingAllSkills, startLoadingAllSkills] = useTransition();
  const [isLoadingUserSkills, startLoadingUserSkills] = useTransition();
  const [isUpdatingUserSkills, startUpdatingUserSkills] = useTransition();

  useEffect(() => {
    startLoadingUsers(async () => {
      try {
        const fetchedUsers = await getGenesysUsers();
        setAllUsers(fetchedUsers.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error: any) {
        toast({ title: "Error fetching users", description: error.message, variant: "destructive" });
      }
    });

    startLoadingAllSkills(async () => {
      try {
        const fetchedSkills = await getAllSkills();
        setAllSkills(fetchedSkills.sort((a,b) => a.name.localeCompare(b.name)));
      } catch (error: any) {
        toast({ title: "Error fetching all skills", description: error.message, variant: "destructive" });
      }
    });
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      startLoadingUserSkills(async () => {
        try {
          const fetchedUserSkills = await getUserSkills(selectedUserId);
          setCurrentUserSkills(fetchedUserSkills);
          const initialModifiedSkills = new Map<string, number>();
          fetchedUserSkills.forEach(skill => initialModifiedSkills.set(skill.id, skill.proficiency));
          setModifiedSkills(initialModifiedSkills);
        } catch (error: any) {
          toast({ title: "Error fetching user skills", description: error.message, variant: "destructive" });
          setCurrentUserSkills([]);
          setModifiedSkills(new Map());
        }
      });
    } else {
      setCurrentUserSkills([]);
      setModifiedSkills(new Map());
    }
  }, [selectedUserId]);

  const divisions = useMemo(() => {
    const allDivs = allUsers.map(user => ({ id: user.divisionId, name: user.divisionName }));
    const uniqueDivsMap = new Map<string, Division>();
    allDivs.forEach(div => {
      if (div.id && div.id !== 'N/A' && !uniqueDivsMap.has(div.id)) {
        uniqueDivsMap.set(div.id, div);
      }
    });
    return [{ id: 'all', name: 'All Divisions' }, ...Array.from(uniqueDivsMap.values()).sort((a, b) => a.name.localeCompare(b.name))];
  }, [allUsers]);

  const filteredUsersForSelection = useMemo(() => {
    if (selectedDivisionId === 'all') {
      return allUsers;
    }
    return allUsers.filter(user => user.divisionId === selectedDivisionId);
  }, [allUsers, selectedDivisionId]);

  const handleDivisionChange = (divisionId: string) => {
    setSelectedDivisionId(divisionId);
    if (selectedUserId) {
      const currentUserInSelection = allUsers.find(u => u.id === selectedUserId);
      if (currentUserInSelection && divisionId !== 'all' && currentUserInSelection.divisionId !== divisionId) {
        setSelectedUserId(undefined);
      }
    }
  };
  
  const selectedUser = useMemo(() => allUsers.find(u => u.id === selectedUserId), [allUsers, selectedUserId]);

  const handleSaveSkills = () => {
    if (!selectedUserId) return;

    const skillsToUpdate: UserRoutingSkillUpdateItem[] = Array.from(modifiedSkills.entries())
      .map(([skillId, proficiency]) => ({ skillId, proficiency, state: 'active' }));

    startUpdatingUserSkills(async () => {
      try {
        const updatedSkills = await updateUserSkills(selectedUserId, skillsToUpdate);
        setCurrentUserSkills(updatedSkills);
        const newModifiedSkills = new Map<string, number>();
        updatedSkills.forEach(skill => newModifiedSkills.set(skill.id, skill.proficiency));
        setModifiedSkills(newModifiedSkills);
        toast({ title: "Skills Updated", description: `Successfully updated skills for ${selectedUser?.name}.` });
      } catch (error: any) {
        toast({ title: "Error updating skills", description: error.message, variant: "destructive" });
      }
    });
  };
  
  const handleProficiencyChange = (skillId: string, proficiency: number) => {
    const newProficiency = Math.max(1, Math.min(5, proficiency));
    setModifiedSkills(new Map(modifiedSkills).set(skillId, newProficiency));
  };

  const handleAddSkill = (skillId: string) => {
    if (!modifiedSkills.has(skillId)) {
      setModifiedSkills(new Map(modifiedSkills).set(skillId, 1));
    }
  };

  const handleRemoveSkill = (skillId: string) => {
    const newModifiedSkills = new Map(modifiedSkills);
    newModifiedSkills.delete(skillId);
    setModifiedSkills(newModifiedSkills);
  };
  
  const availableSkillsToAdd = allSkills.filter(s => !modifiedSkills.has(s.id));

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex flex-col items-center selection:bg-primary/30 selection:text-primary-foreground">
      <header className="w-full max-w-4xl mb-8 text-center">
        <div className="flex items-center justify-center mb-4" role="banner">
          <ListTodo className="w-12 h-12 mr-3 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary tracking-tight">
            Skills Management
          </h1>
        </div>
        <p className="text-md sm:text-lg text-muted-foreground font-body max-w-2xl mx-auto">
          View and manage skills for Genesys Cloud users.
        </p>
      </header>

      <main className="w-full max-w-4xl space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="w-6 h-6 text-accent" />
              Select User
            </CardTitle>
            <CardDescription>Filter by division, then choose a user to manage their skills or view details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingUsers ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Label htmlFor="division-filter">Filter by Division</Label>
                    <Select value={selectedDivisionId} onValueChange={handleDivisionChange}>
                      <SelectTrigger id="division-filter" aria-label="Filter by division">
                        <SelectValue placeholder="Filter by division..." />
                      </SelectTrigger>
                      <SelectContent>
                        {divisions.map(division => (
                          <SelectItem key={division.id} value={division.id}>
                            {division.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="user-select">Select User</Label>
                    <Select onValueChange={setSelectedUserId} value={selectedUserId} disabled={filteredUsersForSelection.length === 0}>
                      <SelectTrigger id="user-select" aria-label="Select user">
                        <SelectValue placeholder="Select a user..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredUsersForSelection.length > 0 ? (
                          filteredUsersForSelection.map(user => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name} ({user.divisionName})
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-4 text-sm text-muted-foreground">No users in selected division.</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {selectedUser && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-6 h-6 text-primary" />
                User Details
              </CardTitle>
              <CardDescription>Basic information for {selectedUser.name}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <UserCircle className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Name:</span>
                <span>{selectedUser.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Division:</span>
                <span>{selectedUser.divisionName}</span>
              </div>
              <div className="flex items-center gap-3">
                {/* StatusIndicator already includes an icon */}
                <span className="font-medium mr-1">Status:</span>
                <StatusIndicator status={selectedUser.status} />
              </div>
              {/* Future details can be added here, e.g., Email, Department, Title */}
            </CardContent>
          </Card>
        )}

        {selectedUserId && (
          <>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Current Skills for {selectedUser?.name || 'User'}</CardTitle>
                <CardDescription>Manage proficiencies (1-5) or remove skills.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoadingUserSkills ? (
                  <>
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </>
                ) : modifiedSkills.size === 0 ? (
                  <p className="text-muted-foreground">This user has no skills assigned.</p>
                ) : (
                  Array.from(modifiedSkills.entries()).map(([skillId, proficiency]) => {
                    const skillDefinition = allSkills.find(s => s.id === skillId) || currentUserSkills.find(s => s.id === skillId);
                    return (
                      <div key={skillId} className="flex items-center justify-between gap-2 p-3 border rounded-md bg-secondary/30">
                        <span className="font-medium">{skillDefinition?.name || `Skill ID: ${skillId}`}</span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            max="5"
                            value={proficiency}
                            onChange={(e) => handleProficiencyChange(skillId, parseInt(e.target.value, 10))}
                            className="w-20 h-9 text-center"
                            aria-label={`Proficiency for ${skillDefinition?.name}`}
                            disabled={isUpdatingUserSkills}
                          />
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleRemoveSkill(skillId)} 
                            className="text-destructive hover:text-destructive/80 h-9 w-9"
                            disabled={isUpdatingUserSkills}
                            title="Remove Skill"
                            >
                            <X className="w-5 h-5" />
                            <span className="sr-only">Remove Skill</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Add New Skills</CardTitle>
                <CardDescription>Select skills to add to {selectedUser?.name || 'the user'}. Default proficiency is 1.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoadingAllSkills ? (
                  <Skeleton className="h-10 w-full" />
                ) : availableSkillsToAdd.length === 0 ? (
                    <p className="text-muted-foreground">All available skills are already assigned or selected for this user.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availableSkillsToAdd.map(skill => (
                      <Button
                        key={skill.id}
                        variant="outline"
                        onClick={() => handleAddSkill(skill.id)}
                        className="justify-start gap-2 h-10"
                        disabled={isUpdatingUserSkills}
                      >
                        <PlusCircle className="w-5 h-5 text-green-600" />
                        {skill.name}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <div className="flex justify-end">
              <Button onClick={handleSaveSkills} disabled={isUpdatingUserSkills || isLoadingUserSkills}>
                {isUpdatingUserSkills ? <Filter className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" /> }
                {isUpdatingUserSkills ? 'Saving...' : 'Save All Changes'}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
