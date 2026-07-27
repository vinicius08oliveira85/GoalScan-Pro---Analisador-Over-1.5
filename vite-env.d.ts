/// <reference types="vite/client" />

interface Gtag {
  (command: 'event', eventName: string, properties?: Record<string, unknown>): void;
}

interface Plausible {
  (eventName: string, options?: { props?: Record<string, unknown> }): void;
}

interface Window {
  gtag?: Gtag;
  plausible?: Plausible;
}