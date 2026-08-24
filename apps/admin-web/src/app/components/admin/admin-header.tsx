import type { RefObject } from 'react';
import type { AdminUser } from '../../lib/api';
import { Button, IconButton, MenuIcon } from '../ui';
import { Breadcrumbs } from './breadcrumbs';

export function AdminHeader({
  admin,
  onMenuOpen,
  onLogout,
  menuButtonRef,
}: {
  admin: AdminUser;
  onMenuOpen: () => void;
  onLogout: () => void;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <IconButton
          ref={menuButtonRef}
          className="lg:hidden"
          aria-label="Open navigation"
          aria-controls="mobile-admin-navigation"
          onClick={onMenuOpen}
        >
          <MenuIcon className="size-5" />
        </IconButton>
        <div className="min-w-0">
          <Breadcrumbs />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden border-r border-slate-200 pr-3 text-right sm:block">
          <p className="text-sm font-semibold text-slate-900">
            {typeof admin.firstName === 'string' && admin.firstName.trim() ? admin.firstName : 'Admin'}{' '}
            {admin.lastName ?? ''}
          </p>
          <p className="max-w-48 truncate text-xs text-slate-500">
            {admin.email}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onLogout}>
          Logout
        </Button>
      </div>
    </header>
  );
}
