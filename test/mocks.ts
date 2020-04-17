import { EventEmitter } from 'events';

export class HTMLElementMock {
  private emitter?: EventEmitter;
  private attributes?: Map<string, string>;

  constructor() {
    const attributes = new Map();
    const eventEmitter = new EventEmitter();
    Object.defineProperties(this, {
      emitter: { get: () => eventEmitter, enumerable: false },
      attributes: { get: () => attributes, enumerable: false },
    })
  }

  addEventListener(type: string, callback: (...args: any[]) => any) {
    this.emitter && this.emitter.on(type, callback);
  }

  removeEventListener(type: string, callback: (...args: any[]) => any) {
    this.emitter && this.emitter.off(type, callback);
  }

  dispatchEvent(event: Event) {
    this.emitter && this.emitter.emit(event.type, event);
  }

  getAttribute(qualifiedName: string) {
    return this.attributes && this.attributes.get(qualifiedName);
  }

  setAttribute(qualifiedName: string, value: string) {
    this.attributes && this.attributes.set(qualifiedName, value);
    this.emitter && this.emitter.emit('@attributeChanged', qualifiedName, value);
  }
}

export class EventMock {
  constructor(public type: string, public detail?: any) {}
}
