/** Menu groups (drawer / tablet rail). */
import { Bell, BookOpen, Building2, CircleHelp, ClipboardList, Gift, Home, LayoutGrid, MessageCircle, Plus, Sparkles, Target, Wallet, type LucideIcon } from 'lucide-react';
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
      { label: 'My Referrals', to: '/referrals', icon: ClipboardList },
      { label: 'Refer a Patient', to: '/refer', icon: Plus },
      { label: 'Service Catalogue', to: '/services', icon: LayoutGrid },
      { label: 'AI Test Assistant', to: '/assistant', icon: Sparkles },
      { label: 'Branch Information', to: '/branch', icon: Building2 },
    ],
  },
  {
    label: 'FINANCE & GROWTH',
    items: [
      { label: 'My Earnings', to: '/earnings', icon: Wallet },
      { label: 'Targets & Incentives', to: '/targets', icon: Target },
      { label: 'Campaigns', to: '/campaigns', icon: Gift },
    ],
  },
  {
    label: 'STAY CONNECTED',
    items: [
      { label: 'Messages', to: '/messages', icon: MessageCircle, badge: 2 },
      { label: 'Announcements', to: '/announcements', icon: Bell },
    ],
  },
  {
    label: 'SUPPORT',
    items: [
      { label: 'Help Centre', to: '/help', icon: CircleHelp },
      { label: 'Training & Resources', to: '/training', icon: BookOpen },
    ],
  },
];

/** Is `to` the current screen (or its parent section)? */
export const isActive = (to: RoutePath, path: string) => (to === '/' ? path === '/' : path === to || path.startsWith(`${to}/`));
