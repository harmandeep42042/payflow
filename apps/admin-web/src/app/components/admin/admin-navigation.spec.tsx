import { fireEvent, render, screen } from '@testing-library/react';
import { MobileNavigation } from './mobile-navigation';
import { SidebarNavigation } from './sidebar';

jest.mock('next/navigation', () => ({
  usePathname: () => '/transactions/transaction-123',
}));

describe('Admin navigation', () => {
  it('marks the parent navigation item active on detail routes', () => {
    render(<SidebarNavigation />);

    expect(
      screen.getByRole('link', { name: 'Transactions' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(
      screen.getByRole('link', { name: 'Users' }).getAttribute('aria-current'),
    ).toBeNull();
  });

  it('traps focus, closes with Escape, and restores focus to the menu button', () => {
    const menuButton = document.createElement('button');
    document.body.appendChild(menuButton);
    menuButton.focus();

    const onClose = jest.fn();
    const { unmount } = render(
      <MobileNavigation
        open
        onClose={onClose}
        onLogout={jest.fn()}
        returnFocus={menuButton}
      />,
    );

    const closeButton = screen.getByRole('button', { name: 'Close navigation' });
    expect(document.activeElement).toBe(closeButton);
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Logout' }),
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(document.activeElement).toBe(menuButton);
    expect(document.body.style.overflow).toBe('');
    menuButton.remove();
  });
});
