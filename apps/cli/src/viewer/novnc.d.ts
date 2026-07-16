declare module "@novnc/novnc" {
  interface Credentials {
    password?: string;
    username?: string;
  }

  interface RfbOptions {
    credentials?: Credentials;
    shared?: boolean;
  }

  export default class RFB extends EventTarget {
    background: string;
    resizeSession: boolean;
    scaleViewport: boolean;
    viewOnly: boolean;

    constructor(target: HTMLElement, url: string, options?: RfbOptions);
    disconnect(): void;
    sendCredentials(credentials: Credentials): void;
  }
}
