import { BehaviorSubject, fromEvent, merge, Observable, Subscription, UnaryFunction } from 'rxjs';
import { distinctUntilChanged, map, tap } from 'rxjs/operators';

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

export type PropertiesConfig = ObjectOf<PropertyConfig<any>>;

export type TypeFromConfig<C extends PropertyConfig<any>> = C extends PropertyConfig<infer T> ? T : never;
export type Setter<T> = [BehaviorSubject<T>, PropertyConfig<T>];
export type Setters<C extends PropertiesConfig> = { [K in keyof C]: Setter<TypeFromConfig<C[K]>> };

export function createPropertiesDescriptors<T extends PropertiesConfig>(
  base: Element, props: T): Setters<typeof props> {
  const keys = Object.keys(props) as Array<keyof typeof props>;
  const triggers = {} as Setters<typeof props>;

  Object.defineProperties(base, Object.fromEntries(keys.map(key => {
    const config = props[ key ];
    const trigger$ = new BehaviorSubject('initial' in config ? config.initial : (base as any)[key]);
    triggers[ key ] = [trigger$, config];
    return [key, {
      get: () => trigger$.getValue(),
      set: (newValue) => trigger$.next(newValue),
      enumerable: true
    }] as [string, PropertyDescriptor];
  })));

  Object.freeze(triggers);
  return triggers;
}

export type SettersEntry<E> = Observable<[keyof E, E[keyof E] extends Setter<infer T> ? T : any]>;

export function getPropertyChangeListener<P extends PropertiesConfig>(
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

export type Renderer<T = unknown> = (result: T, container: (Element | DocumentFragment)) => void;

export function mapProperties<P>(properties: PropertiesConfig, node: Element) {
  return map(() => Object.fromEntries(
    Object
      .keys(properties)
      .map(key => [key, (node as any)[ key ]])
    ) as P
  );
}

export function create<P extends PropertiesConfig, T>(node: Element, properties: P, { renderer }: { renderer: Renderer<T> }) {
  const subscriptions = [] as Subscription[];
  const registeredObservables = [] as Observable<any>[];

  const setters = createPropertiesDescriptors(node, properties);

  const propertyChanged$ = getPropertyChangeListener(node, setters);

  const connected$ = fromEvent(node, 'connected');
  const disconnected$ = fromEvent(node, 'disconnected');

  node.addEventListener('attributeChanged', ({ detail: [attr, , newValue] }: CustomEventInit) => setters[ attr ][ 0 ].next(newValue));
  node.addEventListener('connected', () => registeredObservables
    .map((observable) => observable.subscribe())
    .forEach((subscription) => subscriptions.push(subscription))
  );
  node.addEventListener('disconnected', () => subscriptions
    .splice(0, subscriptions.length)
    .forEach((subscription) => subscription.unsubscribe())
  );

  function useTemplate(template: (props: P) => T) {
    subscribe(propertyChanged$.pipe(
      mapProperties<P>(properties, node),
      tap((props) => renderer(template(props), node.shadowRoot || node))
    ))
  }

  const subscribe = (...observables: Observable<any>[]) => registeredObservables.push(...observables);
  return {
    subscribe, useTemplate,
    connected$, disconnected$, propertyChanged$,
  };
}

