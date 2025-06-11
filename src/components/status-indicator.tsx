
import React from 'react';
import type { UserStatus } from '@/app/actions';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, CircleSlash, Clock, UserMinus, Briefcase } from 'lucide-react';

interface StatusIndicatorProps {
  status: UserStatus['status'];
}

// Defines the order in which statuses should appear in summaries or lists.
export const STATUS_ORDER: UserStatus['status'][] = ['Available', 'On Queue', 'Busy', 'Meeting', 'Away', 'Offline'];

// Provides visual configurations for each status.
export const statusVisuals: Record<UserStatus['status'], { icon: JSX.Element; textClass: string; colorHex: string; containerClass?: string }> = {
  Available: { 
    icon: <CheckCircle2 className="h-5 w-5 text-green-600" />, 
    textClass: 'text-green-700',
    colorHex: '#16a34a', // Corresponds to Tailwind's green-600
  },
  Busy: { 
    icon: <XCircle className="h-5 w-5 text-red-600" />, 
    textClass: 'text-red-700',
    colorHex: '#dc2626', // Corresponds to Tailwind's red-600
  },
  Offline: { 
    icon: <CircleSlash className="h-5 w-5 text-slate-500" />, 
    textClass: 'text-slate-600',
    colorHex: '#64748b', // Corresponds to Tailwind's slate-500
  },
  'On Queue': { 
    icon: <Clock className="h-5 w-5 text-teal-600" />, // Using teal-600 for the icon color
    textClass: 'text-teal-700', // Using teal-700 for text
    containerClass: 'bg-teal-500 text-white rounded px-2 py-0.5', // Example: using teal-500 for background in table
    colorHex: '#0d9488', // Corresponds to Tailwind's teal-600 for summary card border
  },
  Away: { 
    icon: <UserMinus className="h-5 w-5 text-amber-600" />, 
    textClass: 'text-amber-700',
    colorHex: '#d97706', // Corresponds to Tailwind's amber-600
  },
  Meeting: { 
    icon: <Briefcase className="h-5 w-5 text-purple-600" />, 
    textClass: 'text-purple-700',
    colorHex: '#9333ea', // Corresponds to Tailwind's purple-600
  },
};

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const config = statusVisuals[status] || statusVisuals.Offline;

  return (
    <div className={cn("flex items-center space-x-2", config.containerClass)}>
      {/* Re-clone element to apply className for consistent sizing if needed elsewhere, though current icons have size */}
      {React.cloneElement(config.icon, { className: config.icon.props.className || "h-5 w-5"})}
      <span className={cn("font-medium", config.textClass)}>{status}</span>
    </div>
  );
}

