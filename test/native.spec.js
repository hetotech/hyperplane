import { expect } from 'chai';
import { EventEmitter } from "events";
import { noop, Subject } from "rxjs";
import { tap } from "rxjs/operators";
import { create, prop, voidProp } from "../hyperplane";
import { createSpy } from "./test-utils";

/**
 * @typedef {import('../hyperplane').PropertyConfig<T>} PropertyConfig<T>
 * @template T
 */

describe('create', () => {
  const properties = {
    a: prop(0),
    b: prop(0),
    c: voidProp(Number)
  };
  /**
   * @type {import('../hyperplane').UpgradedElement<Element, typeof properties>}
   */
  let node;
  /**
   * @type {EventEmitter}
   */
  let emitter;

  beforeEach(() => {
    node = Object.defineProperties(new EventEmitter(), {
      addEventListener: { value: EventEmitter.prototype.on },
      a: { value: 1, configurable: true, enumerable: true, writable: true },
      b: { value: 2, configurable: true, enumerable: true, writable: true },
      c: { value: 3, configurable: true, enumerable: true, writable: true }
    });
    //noinspection UnnecessaryLocalVariableJS
    /** @type {any} */
    const tmp = node;
    emitter = tmp;
  });

  describe('subscribe', () => {
    it('should subscribe an observable on connected event and unsubscribe on disconnected', () => {
      const { subscribe } = create(node, properties, { renderer: noop });
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
      /** @type {any} */
      const em = new EventEmitter();
      em.addEventListener = EventEmitter.prototype.on;
      em.a = 1;
      em.b = 2;
      em.c = 3;
      node = em;
      //noinspection UnnecessaryLocalVariableJS
      /** @type {any} */
      const tmp = node;
      emitter = tmp;
    });

    it('should when subscribed, map each propertyChanged$ signal to configured properties values and call render with provided template', () => {
      const template = createSpy();
      const { useTemplate } = create(node, properties, { renderer: noop });
      useTemplate(({ a, b, c }) => {
        a.toFixed() && b.toFixed() && (c ? c.toFixed() : null);
      });
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
});
