// PostHog stub — posthog-js not installed; no-op analytics until SDK is added

export function initPosthog(): void {}

export function trackEvent(
  _name: string,
  _properties?: Record<string, unknown>
): void {}

export function identifyUser(
  _userId: string,
  _properties?: Record<string, unknown>
): void {}
