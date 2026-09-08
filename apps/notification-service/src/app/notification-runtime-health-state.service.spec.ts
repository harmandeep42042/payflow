import {
  NotificationRuntimeHealthState,
} from './notification-runtime-health-state.service';

describe('NotificationRuntimeHealthState', () => {
  it('tracks RabbitMQ bootstrap state', () => {
    const state =
      new NotificationRuntimeHealthState();

    expect(
      state.isRabbitMqStarted(),
    ).toBe(false);

    state.markRabbitMqStarted();

    expect(
      state.isRabbitMqStarted(),
    ).toBe(true);

    state.markRabbitMqStopped();

    expect(
      state.isRabbitMqStarted(),
    ).toBe(false);
  });
});