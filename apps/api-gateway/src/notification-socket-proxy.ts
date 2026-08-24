type UpgradeHandler = (...args: unknown[]) => void;

type UpgradeServer = {
  on: (
    event: 'upgrade',
    handler: UpgradeHandler,
  ) => unknown;
};

type WebSocketProxy = {
  upgrade: UpgradeHandler;
};

export function attachNotificationSocketUpgrade(
  server: UpgradeServer,
  proxy: WebSocketProxy,
): void {
  server.on('upgrade', proxy.upgrade);
}
