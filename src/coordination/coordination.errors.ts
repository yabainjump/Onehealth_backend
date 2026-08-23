export class CoordinationUnavailableError extends Error {
  constructor() {
    super('Distributed coordination is temporarily unavailable.');
    this.name = 'CoordinationUnavailableError';
  }
}

export class LeaseBusyError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('The protected resource is currently busy.');
    this.name = 'LeaseBusyError';
  }
}
