
'use client';

import type { ReactNode } from 'react';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ListTodo, Users, Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: '/', label: 'Status Board', icon: LayoutDashboard },
  { href: '/skills', label: 'Skills Management', icon: ListTodo },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2" onClick={() => setIsSheetOpen(false)}>
            <Users className="h-7 w-7 text-primary" />
            <h2 className="text-lg font-semibold">
              CapitalGroup Genesys Configurator
            </h2>
          </Link>

          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden"> {/* Show only on md and smaller, adjust as needed */}
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[340px]">
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                   <Users className="h-6 w-6 text-primary" /> CapitalGroup Genesys Configurator
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2">
                {navItems.map((item) => (
                  <SheetClose asChild key={item.href}>
                    <Link href={item.href} legacyBehavior passHref>
                      <Button
                        variant={pathname === item.href ? 'secondary' : 'ghost'}
                        className="w-full justify-start gap-2"
                        onClick={() => setIsSheetOpen(false)}
                        asChild={false} // Ensure Button doesn't try to use Link's asChild
                      >
                        <a> {/* Content needs to be wrapped for passHref with legacyBehavior or direct styling */}
                          <item.icon className="h-5 w-5" />
                          <span>{item.label}</span>
                        </a>
                      </Button>
                    </Link>
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
          
          {/* Desktop Navigation (visible on md and larger) */}
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} legacyBehavior passHref>
                <Button
                  variant={pathname === item.href ? 'secondary' : 'ghost'}
                  className="gap-2"
                  asChild={false}
                >
                  <a>
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </a>
                </Button>
              </Link>
            ))}
          </nav>

        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
