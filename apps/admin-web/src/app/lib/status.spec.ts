import { getStatusClasses } from './status';

describe('getStatusClasses', () => {
  it.each(['FAILED', 'BLOCKED'])('never renders %s as success', (status) => {
    expect(getStatusClasses(status)).toContain('red');
    expect(getStatusClasses(status)).not.toContain('emerald');
  });

  it.each(['PENDING', 'UNDER_REVIEW', 'SUSPENDED', 'FROZEN'])(
    'renders %s as a warning',
    (status) => expect(getStatusClasses(status)).toContain('amber'),
  );

  it('renders PROCESSING as informational', () => {
    expect(getStatusClasses('PROCESSING')).toContain('blue');
  });

  it('renders unknown statuses as neutral', () => {
    expect(getStatusClasses('SOMETHING_NEW')).toContain('slate');
    expect(getStatusClasses('SOMETHING_NEW')).not.toContain('emerald');
  });
});
