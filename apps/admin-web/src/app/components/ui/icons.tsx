import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function DashboardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </Icon>
  );
}
export function UsersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  );
}
export function WalletIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h13" />
      <path d="M16 13h5" />
      <circle cx="16" cy="13" r=".5" fill="currentColor" />
    </Icon>
  );
}
export function TransactionsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 7h13l-3-3M17 17H4l3 3M20 7l-3 3M4 17l3-3" />
    </Icon>
  );
}
export function AnalyticsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 19V9M10 19V5M16 19v-7M22 19V3" />
    </Icon>
  );
}
export function AuditIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4M9 3h6v4H9z" />
      <path d="m14 13 2 2 5-5" />
    </Icon>
  );
}
export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 11a8 8 0 1 0-2.34 5.66" />
      <path d="M20 4v7h-7" />
    </Icon>
  );
}
export function BalanceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 10h18M5 6l7-3 7 3M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18" />
    </Icon>
  );
}
export function ArrowUpRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 17 17 7M7 7h10v10" />
    </Icon>
  );
}
export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}
export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}
export function LogoutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    </Icon>
  );
}
