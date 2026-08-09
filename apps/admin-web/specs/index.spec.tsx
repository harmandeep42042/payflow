import Page from '../src/app/page';

jest.mock(
  'next/navigation',
  () => ({
    redirect: jest.fn(),
  }),
);

import {
  redirect,
} from 'next/navigation';

describe('Admin home page', () => {
  it('should redirect to login', () => {
    Page();

    expect(
      redirect,
    ).toHaveBeenCalledWith(
      '/login',
    );
  });
});
