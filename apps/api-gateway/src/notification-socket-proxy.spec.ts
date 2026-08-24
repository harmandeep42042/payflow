import { attachNotificationSocketUpgrade } from './notification-socket-proxy';

describe('notification Socket.IO proxy', () => {
  it('attaches the proxy upgrade handler to the HTTP server', () => {
    const server = {
      on: jest.fn(),
    };
    const proxy = {
      upgrade: jest.fn(),
    };

    attachNotificationSocketUpgrade(server, proxy);

    expect(server.on).toHaveBeenCalledWith(
      'upgrade',
      proxy.upgrade,
    );
  });
});
