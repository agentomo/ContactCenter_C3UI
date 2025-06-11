import type { UserStatus } from '@/app/actions';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, CircleSlash, Clock, UserMinus, Briefcase } from 'lucide-react';

interface StatusIndicatorProps {
  status: UserStatus['status'];
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  // Define Tailwind classes for text and icon colors directly.
  // This is acceptable for semantic status indicators where colors have specific meanings.
  const statusConfig: Record<UserStatus['status'], { icon: JSX.Element; textClass: string; containerClass?: string }> = {
    Available: { 
      icon: <CheckCircle2 className="h-5 w-5 text-green-600" />, 
      textClass: 'text-green-700' 
    },
    Busy: { 
      icon: <XCircle className="h-5 w-5 text-red-600" />, 
      textClass: 'text-red-700' 
    },
    Offline: { 
      icon: <CircleSlash className="h-5 w-5 text-slate-500" />, 
      textClass: 'text-slate-600' 
    },
    'On Queue': { 
      icon: <Clock className="h-5 w-5 text-accent-foreground" />, 
      textClass: 'text-accent-foreground',
      containerClass: 'bg-accent rounded px-2 py-0.5' // Use accent for background
    },
    Away: { 
      icon: <UserMinus className="h-5 w-5 text-amber-600" />, 
      textClass: 'text-amber-700' 
    },
    Meeting: { 
      icon: <Briefcase className="h-5 w-5 text-purple-600" />, 
      textClass: 'text-purple-700' 
    },
  };

  const config = statusConfig[status] || statusConfig.Offline;

  return (
    <div className={cn("flex items-center space-x-2", config.containerClass)}>
      {config.icon}
      <span className={cn("font-medium", config.textClass)}>{status}</span>
    </div>
  );
}
