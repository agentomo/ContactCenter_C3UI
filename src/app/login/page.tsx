
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, LogIn, AlertTriangle, Settings } from 'lucide-react';
import { handleLogin, isLoginConfigured } from '@/app/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function LoginPage() {
  const [configured, setConfigured] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    async function checkConfig() {
      try {
        const isConfig = await isLoginConfigured();
        setConfigured(isConfig);
      } catch (error) {
        console.error("Failed to check login configuration:", error);
        setConfigured(false); // Assume not configured on error
      } finally {
        setIsLoading(false);
      }
    }
    checkConfig();
  }, []);

  const onLoginClick = async () => {
    if (!configured) return;
    try {
      const redirectUrl = await handleLogin();
      window.location.href = redirectUrl;
    } catch (error: any) {
      console.error('Login initiation failed:', error);
      alert(`Login failed: ${error.message}`);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Users className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">CapitalGroup Genesys Configurator</CardTitle>
          <CardDescription>Please log in with your Genesys Cloud account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoading && !configured && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Configuration Missing</AlertTitle>
              <AlertDescription>
                The application is not configured for login. An administrator must set the required environment variables.
              </AlertDescription>
            </Alert>
          )}
          <form action={onLoginClick}>
            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={!configured || isLoading}
            >
              <LogIn className="mr-2 h-5 w-5" />
              {isLoading ? "Loading..." : "Login with Genesys"}
            </Button>
          </form>
        </CardContent>
         {!isLoading && !configured && (
            <CardFooter className="flex-col items-start text-sm text-muted-foreground pt-4 border-t">
               <p>Are you an administrator?</p>
                <Link href="/setup" className="w-full">
                    <Button variant="outline" className="w-full mt-2">
                        <Settings className="mr-2 h-4 w-4" />
                        Go to Setup Instructions
                    </Button>
                </Link>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
