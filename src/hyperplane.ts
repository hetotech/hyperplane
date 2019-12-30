import { BehaviorSubject, fromEvent, merge, Observable, of, OperatorFunction, UnaryFunction } from 'rxjs';
import { pipeFromArray } from 'rxjs/internal/util/pipe';
import { distinctUntilChanged, map, takeUntil, tap } from 'rxjs/operators';

/**
 * Built-in converters supported by the library
 */
export type BuiltInConverters = typeof JSON | typeof URL | typeof Boolean;

/**
 * Converter interface (for serializing and deserializing data)
 */
export type Converter<T extends { toString(): string } = any> =
  { new(): T, parse(string: string): T }
  | BuiltInConverters;

export type PropertyConfig<T> = {
  initial: T,
  attributeName?: string,
  converter?: Converter<T>,
  effects?(node: Element): UnaryFunction<Observable<T>, Observable<any>>
};

export function prop<T>(
  initial: T, config: Omit<PropertyConfig<T>, 'initial'> = {}): PropertyConfig<T> {
  return { initial, ...config };
}

type PropertiesConfig = ObjectOf<PropertyConfig<any>>;

export type TypeFromConfig<C extends PropertyConfig<any>> = C extends PropertyConfig<infer T> ? T : never;
export type Setter<T> = [BehaviorSubject<T>, PropertyConfig<T>];
export type Setters<C extends PropertiesConfig> = { [K in keyof C]: Setter<TypeFromConfig<C[K]>> };

export function createPropertiesDescriptors(base: Element, props: PropertiesConfig): Setters<typeof props> {
  const keys = Object.keys(props) as Array<keyof typeof props>;
  const triggers = {} as ObjectOf<[BehaviorSubject<unknown>, any]>;

  Object.defineProperties(base, keys.reduce((proto, key) => {
    const config = props[ key ];
    const trigger$ = new BehaviorSubject('initial' in config ? config.initial : undefined);
    triggers[ key ] = [trigger$, config];
    proto[ key ] = {
      get: () => trigger$.getValue(),
      set: (newValue) => trigger$.next(newValue),
      enumerable: true
    };
    return proto;
  }, {} as PropertyDescriptorMap));
  Object.freeze(triggers);
  return triggers;
}

type SettersEntry<T> = Observable<[keyof T, T[keyof T] extends Setter<infer V> ? V : T]>

export function fromSetters<P extends PropertiesConfig>(
  instance: Element, setters: Setters<P>): SettersEntry<typeof setters> {
  return merge(...Object
    .entries(setters)
    .map(<K extends keyof typeof setters>([propertyName, [trigger, propertyConfig]]: [K, (typeof setters)[K]]) => trigger.pipe(
      /* Ignore if value did not change */
      distinctUntilChanged(),
      /* Property effects */
      propertyConfig.effects ? propertyConfig.effects(instance) : tap(),
      map((value) => [propertyName, value] as [K, any])
    ))
  );
}

// export function createEventsDispatchers(instance, events) {
//   const entries = Object.entries(events);
//   const dispatchers = {};
//   Object.defineProperties(instance, entries
//     .reduce((proto, [eventName, eventConfig]) => {
//       let handler = null;
//       const getConfig = typeof eventConfig === 'function' ? eventConfig : () => {};
//       dispatchers[ eventName ] = (data) => instance.dispatchEvent(new CustomEvent(eventName, getConfig(data)));
//       proto[ `on${eventName[ 0 ].toUpperCase()}${eventName.slice(1)}` ] = {
//         get: () => handler,
//         set: (newHandler) => {
//           if (typeof newHandler === 'function') {
//             instance.addEventListener(eventName, handler);
//             handler = newHandler;
//           } else {
//             instance.removeEventListener(eventName, handler);
//             handler = null;
//           }
//         },
//         enumerable: true
//       };
//       return proto;
//     }, {})
//   );
//   Object.freeze(dispatchers);
//   return dispatchers;
// }

export type Renderer = (result: unknown, container: (Element | DocumentFragment)) => void;

function createRender<T extends PropertiesConfig>(
  node: Element, properties: T, changes$: Observable<any>, disconnected$: Observable<any>, renderer: Renderer) {
  type P = { [K in keyof T]: T[K]['initial'] };
  return render;

  function render<A>(fn1: OperatorFunction<P, A>): void;
  function render<A, B>(fn1: OperatorFunction<P, A>, fn2: OperatorFunction<A, B>): void;
  function render<A, B, C>(fn1: OperatorFunction<P, A>, fn2: OperatorFunction<A, B>, fn3: OperatorFunction<B, C>): void;
  function render<A, B, C, D>(
    fn1: OperatorFunction<P, A>, fn2: OperatorFunction<A, B>, fn3: OperatorFunction<B, C>,
    fn4: OperatorFunction<C, D>
  ): void;
  function render<A, B, C, D, E>(
    fn1: OperatorFunction<P, A>, fn2: OperatorFunction<A, B>, fn3: OperatorFunction<B, C>, fn4: OperatorFunction<C, D>,
    fn5: OperatorFunction<D, E>
  ): void;
  function render<A, B, C, D, E, F>(
    fn1: OperatorFunction<P, A>, fn2: OperatorFunction<A, B>, fn3: OperatorFunction<B, C>, fn4: OperatorFunction<C, D>,
    fn5: OperatorFunction<D, E>, fn6: OperatorFunction<E, F>
  ): void;
  function render<A, B, C, D, E, F, G>(
    fn1: OperatorFunction<P, A>, fn2: OperatorFunction<A, B>, fn3: OperatorFunction<B, C>, fn4: OperatorFunction<C, D>,
    fn5: OperatorFunction<D, E>, fn6: OperatorFunction<E, F>, fn7: OperatorFunction<F, G>
  ): void;
  function render<A, B, C, D, E, F, G, H>(
    fn1: OperatorFunction<P, A>, fn2: OperatorFunction<A, B>, fn3: OperatorFunction<B, C>, fn4: OperatorFunction<C, D>,
    fn5: OperatorFunction<D, E>, fn6: OperatorFunction<E, F>, fn7: OperatorFunction<F, G>, fn8: OperatorFunction<G, H>
  ): void;
  function render<A, B, C, D, E, F, G, H, I>(
    fn1: OperatorFunction<P, A>, fn2: OperatorFunction<A, B>, fn3: OperatorFunction<B, C>, fn4: OperatorFunction<C, D>,
    fn5: OperatorFunction<D, E>, fn6: OperatorFunction<E, F>, fn7: OperatorFunction<F, G>, fn8: OperatorFunction<G, H>,
    fn9: OperatorFunction<H, I>
  ): void;
  function render<A, B, C, D, E, F, G, H, I>(
    fn1: OperatorFunction<P, A>, fn2: OperatorFunction<A, B>, fn3: OperatorFunction<B, C>, fn4: OperatorFunction<C, D>,
    fn5: OperatorFunction<D, E>, fn6: OperatorFunction<E, F>, fn7: OperatorFunction<F, G>, fn8: OperatorFunction<G, H>,
    fn9: OperatorFunction<H, I>, ...fns: OperatorFunction<any, any>[]
  ): void;

  function render(...operations: OperatorFunction<any, any>[]) {
    return node.addEventListener('connected', () => changes$
      .pipe(
        takeUntil(disconnected$),
        map(() => {
          return Object.keys(properties)
            .reduce((props, key) => Object.assign(props, { [ key ]: (node as any)[ key ] }), {}) as P;
        }),
        pipeFromArray(operations),
        tap((template) => renderer(template, node.shadowRoot || node))
      )
      .subscribe()
    );
  }
}

export function create<P extends PropertiesConfig>(node: Element, properties: P, { renderer }: { renderer: Renderer }) {
  const setters = createPropertiesDescriptors(node, properties);

  const propertyChanged$ = fromSetters(node, setters);

  const connected$ = fromEvent(node, 'connected');
  const disconnected$ = fromEvent(node, 'disconnected');

  node.addEventListener('attributeChanged', ({ detail: [attr, , newValue] }: CustomEventInit) => setters[ attr ][ 0 ].next(newValue));

  const render = createRender(node, properties, propertyChanged$, disconnected$, renderer);
  const whileConnected = (...operations: OperatorFunction<any, any>[]) => node.addEventListener('connected', () =>
    of(undefined)
      .pipe(
        takeUntil(disconnected$),
        pipeFromArray(operations)
      )
      .subscribe()
  );
  return {
    render, whileConnected,
    connected$, disconnected$, propertyChanged$,
  };
}

