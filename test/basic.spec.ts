import { EventEmitter } from 'events';
import { BehaviorSubject, noop, Observable, OperatorFunction, pipe, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  create, createPropertiesDescriptors, getPropertyChangeListener, mapProperties, prop, PropertyConfig, Setters,
  SettersEntry
} from '../src/hyperplane';
import { createSpy, markUsed } from './test-utils';

const { expect } = require('chai');

describe('property creator', () => {
  it('should return an object with passed in config and `initial` property set to first argument', () => {
    const result: PropertyConfig<number> = prop(10, { attributeName: 'foo' });
    expect(result).to.deep.equal({ initial: 10, attributeName: 'foo' })
  });
  it('should only include `initial` property if no configuration is provided', () => {
    const result: PropertyConfig<string> = prop('foo');
    expect(result).to.deep.equal({ initial: 'foo' })
  });
});

describe('mapProperties', () => {
  it('should map each event to node values from under only config keys', () => {
    const spy = createSpy();
    const properties = { a: null as any, b: null as any, c: null as any } as any;
    const node = { a: 1, b: 2, c: 3, others: 4 } as any;
    const trigger = new Subject();
    const sub = trigger.pipe(mapProperties(properties, node)).subscribe(spy);
    expect(spy.called).to.be.false;
    trigger.next();
    expect(spy.lastCalledWith).to.deep.equal([{ a: 1, b: 2, c: 3 }]);
    node.a = 10;
    trigger.next();
    expect(spy.lastCalledWith).to.deep.equal([{ a: 10, b: 2, c: 3 }]);
    sub.unsubscribe();
  });
  it('should not include non configured properties', () => {
    const spy = createSpy();
    const properties = { a: null as any } as any;
    const node = { a: 1, b: 2 } as any;
    const trigger = new Subject();
    const sub = trigger.pipe(mapProperties(properties, node)).subscribe(spy);
    trigger.next();
    expect(spy.lastCalledWith).to.deep.equal([{ a: 1 }]);
    node.b = 10;
    trigger.next();
    expect(spy.lastCalledWith).to.deep.equal([{ a: 1 }]);
    node.c = 20;
    trigger.next();
    expect(spy.lastCalledWith).to.deep.equal([{ a: 1 }]);
    sub.unsubscribe();
  });
});

describe('createPropertiesDescriptors', () => {
  const props = {
    foo: { initial: 'foo', attributeName: 'bar' },
    bar: { initial: undefined as Nullable<string> },
    baz: { initial: 10 }
  };
  let descriptors: Setters<typeof props>;
  let base: Element & any;
  beforeEach(() => {
    base = {} as Element;
    descriptors = createPropertiesDescriptors(base, props);
  });
  it('should return a freezed object', () => {
    expect(descriptors).to.be.frozen;
  });
  it('should contain all keys of the properties config in the returned object', () => {
    expect(descriptors).to.have.keys(['foo', 'bar', 'baz']);
  });
  it('should add setters and getters for the provided base element', () => {
    expect(base).to.haveOwnPropertyDescriptor('foo');
    expect(base).to.haveOwnPropertyDescriptor('bar');
    expect(base).to.haveOwnPropertyDescriptor('baz');
  });
  it('should return the current value when descriptor value is accessed', () => {
    expect(base.foo).to.equal('foo');
    expect(base.bar).to.equal(undefined);
    expect(base.baz).to.equal(10);
  });
  it('should set the behavior subject value when descriptor value is assigned', () => {
    base.foo = 'bar';
    base.bar = 'baz';
    base.baz = 20;
    expect(descriptors.foo[ 0 ].getValue()).to.equal('bar');
    expect(descriptors.bar[ 0 ].getValue()).to.equal('baz');
    expect(descriptors.baz[ 0 ].getValue()).to.equal(20);
    expect(base.foo).to.equal('bar');
    expect(base.bar).to.equal('baz');
    expect(base.baz).to.equal(20);
  });
  it('should contain tuples of trigger and config for each property in the returned object', () => {
    expect(descriptors).to.deep.contain({
      foo: [
        new BehaviorSubject('foo'),
        { initial: 'foo', attributeName: 'bar' }
      ]
    });
    expect(descriptors).to.deep.contain({
      bar: [
        new BehaviorSubject(undefined),
        { initial: undefined }
      ]
    });
    expect(descriptors).to.deep.contain({
      baz: [
        new BehaviorSubject(10),
        { initial: 10 }
      ]
    });
  });
  it('should allow to enumerate over new base element properties', () => {
    expect(Object.keys(base)).to.deep.equal(['foo', 'bar', 'baz']);
  });
});

describe('getPropertyChangeListener', () => {
  const props = {
    foo: { initial: 'foo', attributeName: 'bar' },
    bar: { initial: undefined as Nullable<string> },
    baz: {
      initial: 10,
      effects: (node: HTMLElement) => pipe(
        tap((value) => node.setAttribute('baz', value.toString())),
      ) as OperatorFunction<number, number>
    },
  };

  let base: Element & any;
  let descriptors: Setters<typeof props>;
  let propertyChanged$: SettersEntry<typeof descriptors>;

  beforeEach(() => {
    base = {
      attributes: {},
      setAttribute(qualifiedName: string, value: string): void { (this.attributes as any)[ qualifiedName ] = value}
    } as Element;
    descriptors = createPropertiesDescriptors(base, props);
    propertyChanged$ = getPropertyChangeListener(base, descriptors) as any;
  });

  it('should return an observable', () => {
    expect(propertyChanged$).to.be.instanceOf(Observable);
  });
  it('should emit an event whenever a property on a base element changes', () => {
    const spy = createSpy();
    const sub = propertyChanged$.subscribe(([key, value]) => {
      const keyClone: 'foo' | 'bar' | 'baz' = key;
      const valueClone: 'string' | 'number' | 'null' | 'undefined' = value;
      markUsed(keyClone, valueClone);
      spy([key, value]);
    });
    spy.resetSpy();
    base.baz = 100;
    expect(spy.called).to.equal(true);
    base.foo = 'bar';
    base.bar = 'baz';
    expect(spy.calledTimes).to.equal(3);
    expect([...spy.calledWith]).to.deep.equal([[['baz', 100]], [['foo', 'bar']], [['bar', 'baz']]]);
    sub.unsubscribe();
  });
  it('should not emit a value if property was assigned with the same value', () => {
    const spy = createSpy();
    const sub = propertyChanged$.subscribe(spy);
    spy.resetSpy();
    base.baz = props.baz.initial;
    base.foo = props.foo.initial;
    base.bar = props.bar.initial;
    expect(spy.called).to.equal(false);
    sub.unsubscribe();
  });
  it('should use effects when defined', () => {
    const spy = createSpy();
    const sub = propertyChanged$.subscribe(spy);
    spy.resetSpy();
    base.baz = 30;
    expect(base.attributes[ 'baz' ]).to.equal('30');
    sub.unsubscribe();
  });
});

describe('create', () => {
  const properties = { a: {} as PropertyConfig<number>, b: {} as PropertyConfig<number>, c: {} as PropertyConfig<number> };
  let node: Element & { [K in keyof typeof properties]: number };
  let emitter: EventEmitter;

  beforeEach(() => {
    node = Object.defineProperties(new EventEmitter(), {
      addEventListener: { value: EventEmitter.prototype.on },
      a: { value: 1, configurable: true, enumerable: true, writable: true },
      b: { value: 2, configurable: true, enumerable: true, writable: true },
      c: { value: 3, configurable: true, enumerable: true, writable: true }
    }) as any;
    emitter = node as any;
  });

  it('should return subscribe function, template setter and lifecycle observables', () => {
    const created = create(node as any, properties, { renderer: noop });
    expect(created).to.have.keys([
      'subscribe', 'useTemplate',
      'connected$', 'disconnected$', 'propertyChanged$',
    ]);
  });
  describe('subscribe', () => {
    it('should subscribe an observable on connected event and unsubscribe on disconnected', () => {
      const { subscribe } = create(node as any, properties, { renderer: noop });
      const spy = createSpy();
      let behaviorSubject = new Subject();
      subscribe(behaviorSubject.pipe(tap(spy)));
      behaviorSubject.next(1);
      expect(spy.calledTimes).to.equal(0);
      emitter.emit('connected');
      behaviorSubject.next(2);
      expect(spy.calledTimes).to.equal(1);
      emitter.emit('disconnected');
      behaviorSubject.next(3);
      expect(spy.calledTimes).to.equal(1);
    });
  });
  describe('useTemplate', () => {
    beforeEach(() => {
      const em = new EventEmitter() as any;
      em.addEventListener = EventEmitter.prototype.on;
      em.a = 1;
      em.b = 2;
      em.c = 3;
      node = em as any;
      emitter = node as any;
    });

    it('should when subscribed, map each propertyChanged$ signal to configured properties values and call render with provided template', () => {
      const renderer = createSpy();
      const template = createSpy();
      const { useTemplate } = create(node as any, properties, { renderer });
      useTemplate(template);
      emitter.emit('connected');
      expect(template.lastCalledWith).to.deep.equal([
        {
          a: 1,
          b: 2,
          c: 3
        }
      ]);
      node.a = 100;
      expect(template.lastCalledWith).to.deep.equal([
        {
          a: 100,
          b: 2,
          c: 3
        }
      ]);
      template.resetSpy();
      emitter.emit('disconnected');
      node.b = 200;
      expect(template.called).to.be.false;
    });
  });
  describe('connected$', () => {
    beforeEach(() => {
      const em = new EventEmitter() as any;
      em.addEventListener = EventEmitter.prototype.on;
      node = em as any;
      emitter = node as any;
    });
    it('should send next signal on connected event fired', () => {
      const renderer = createSpy();
      const spy = createSpy();
      const { connected$ } = create(node as any, properties, { renderer });
      const sub = connected$.subscribe(spy)
      expect(spy.called).to.be.false;
      emitter.emit('connected');
      expect(spy.called).to.be.true;
      sub.unsubscribe();
    });
  });
  describe('disconnected$', () => {
    beforeEach(() => {
      const em = new EventEmitter() as any;
      em.addEventListener = EventEmitter.prototype.on;
      node = em as any;
      emitter = node as any;
    });
    it('should send next signal on disconnected event fired', () => {
      const renderer = createSpy();
      const spy = createSpy();
      const { disconnected$ } = create(node as any, properties, { renderer });
      const sub = disconnected$.subscribe(spy)
      expect(spy.called).to.be.false;
      emitter.emit('disconnected');
      expect(spy.called).to.be.true;
      sub.unsubscribe();
    });
  });
  describe('propertyChanged$', () => {
    beforeEach(() => {
      const em = new EventEmitter() as any;
      em.addEventListener = EventEmitter.prototype.on;
      node = em as any;
      emitter = node as any;
    });
    it('should send next event when any configured property changes', () => {
      const renderer = createSpy();
      const spy = createSpy();
      const { propertyChanged$ } = create(node as any, properties, { renderer });
      const sub = propertyChanged$.subscribe(spy);
      spy.resetSpy();
      expect(spy.called).to.be.false;
      node.a = 9;
      expect(spy.called).to.be.true;
      sub.unsubscribe();
    });
    it('should send a pair of property name and value of a property that changed', () => {
      const renderer = createSpy();
      const spy = createSpy();
      const { propertyChanged$ } = create(node as any, properties, { renderer });
      const sub = propertyChanged$.subscribe(spy);
      spy.resetSpy();
      expect(spy.called).to.be.false;
      node.a = 9;
      expect(spy.lastCalledWith).to.deep.equal([['a', 9]]);
      sub.unsubscribe();
    });
  });
});
