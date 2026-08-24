'use client';

import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import type { AdminUser } from '../../lib/api';
import { AdminHeader } from './admin-header';
import { MobileNavigation } from './mobile-navigation';
import { Sidebar } from './sidebar';

export function AdminShell({
  admin,
  onLogout,
  children,
}: {
  admin: AdminUser;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="min-h-screen bg-[#F6F8FA]">
      <a className="skip-link" href="#admin-main">
        Skip to main content
      </a>
      <Sidebar onLogout={onLogout} />
      <div className="lg:pl-60">
        <AdminHeader
          admin={admin}
          onMenuOpen={() => setMobileOpen(true)}
          onLogout={onLogout}
          menuButtonRef={menuButtonRef}
        />
        <MobileNavigation
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          onLogout={onLogout}
          returnFocus={menuButtonRef.current}
        />
        <main
          id="admin-main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[100rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
