/** Menu groups (drawer / tablet rail). */
import { Bell, BookOpen, Building2, CircleHelp, ClipboardList, FileText, HeartPulse, Home, LayoutGrid, MessageCircle, Plus, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { RoutePath } from '@/app/routes';

export interface NavItem {
  label: string;
  to: RoutePath;
  icon: LucideIcon;
  badge?: number;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'WORKSPACE',
    items: [
      { label: 'Dashboard', to: '/', icon: Home },
      { label: 'My Patients', to: '/referrals', icon: ClipboardList },
      { label: 'New Request', to: '/refer', icon: Plus },
      { label: 'Results', to: '/results', icon: FileText },
      { label: 'Test Catalogue', to: '/services', icon: LayoutGrid },
      { label: 'Branch Information', to: '/branch', icon: Building2 },
    ],
  },
  {
    label: 'STAY CONNECTED',
    items: [
      { label: 'Inbox', to: '/messages', icon: MessageCircle },
      { label: 'Announcements', to: '/announcements', icon: Bell },
      { label: 'Health Campaigns', to: '/campaigns', icon: HeartPulse },
    ],
  },
  {
    label: 'SUPPORT',
    items: [
      { label: 'Help Centre', to: '/help', icon: CircleHelp },
      { label: 'Training & Resources', to: '/training', icon: BookOpen },
      { label: 'Privacy & Terms', to: '/privacy', icon: ShieldCheck },
    ],
  },
];

/** Is `to` the current screen (or its parent section)? */
export const isActive = (to: RoutePath, path: string) => (to === '/' ? path === '/' : path === to || path.startsWith(`${to}/`));
