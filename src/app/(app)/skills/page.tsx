
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { getGenesysUsers, getAllSkills, getUserSkills, updateUserSkills } from '@/app/actions';
import type { UserStatus, SkillDefinition, UserRoutingSkill, UserRoutingSkillUpdateItem } from '@/app/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from "@/hooks/use-toast";
import { ListTodo, UserCog, X, PlusCircle, Save } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function SkillsManagementPage() {
  const [users, setUsers] = useState<UserStatus[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [allSkills, setAllSkills] = useState<SkillDefinition[]>([]);
  const [currentUserSkills, setCurrentUserSkills] = useState<UserRoutingSkill[]>([]);
  const [modifiedSkills, setModifiedSkills] = useState<Map<string, number>>(new Map()); // skillId -> proficiency

  const [isLoadingUsers, startLoadingUsers] = useTransition();
  const [isLoadingAllSkills, startLoadingAllSkills] = useTransition();
  const [isLoadingUserSkills, startLoadingUserSkills] = useTransition();
  const [isUpdatingUserSkills, startUpdatingUserSkills] = useTransition();

  useEffect(() => {
    startLoadingUsers(async () => {
      try {
        const fetchedUsers = await getGenesysUsers();
        setUsers(fetchedUsers.sort((a, b) => a.name.localeCompare(b.name)));
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

  const selectedUser = users.find(u => u.id === selectedUserId);

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
    const newProficiency = Math.max(1, Math.min(5, proficiency)); // Clamp between 1 and 5
    setModifiedSkills(new Map(modifiedSkills).set(skillId, newProficiency));
  };

  const handleAddSkill = (skillId: string) => {
    if (!modifiedSkills.has(skillId)) {
      setModifiedSkills(new Map(modifiedSkills).set(skillId, 1)); // Default proficiency 1
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
            <CardDescription>Choose a user to view and manage their skills.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingUsers ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select onValueChange={setSelectedUserId} value={selectedUserId}>
                <SelectTrigger aria-label="Select user">
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.divisionName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {selectedUserId && (
          <>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Current Skills for {selectedUser?.name || 'User'}</CardTitle>
                <CardDescription>Manage proficiencies or remove skills.</CardDescription>
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
                          />
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveSkill(skillId)} className="text-destructive hover:text-destructive/80">
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
                    <p className="text-muted-foreground">All available skills are already assigned or selected.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availableSkillsToAdd.map(skill => (
                      <Button
                        key={skill.id}
                        variant="outline"
                        onClick={() => handleAddSkill(skill.id)}
                        className="justify-start gap-2"
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
                <Save className="mr-2 h-5 w-5" />
                {isUpdatingUserSkills ? 'Saving...' : 'Save All Changes'}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

