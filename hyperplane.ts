/// <reference path="types.d.ts"/>
import { BehaviorSubject, fromEvent, merge, Observable, OperatorFunction, Subject, Subscription } from 'rxjs';
import { distinctUntilChanged, map, tap } from 'rxjs/operators';

/**
 * Built-in converters supported by the library
 */
export type BuiltInConverters = typeof JSON | typeof URL | typeof Boolean | typeof Date;

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
  effects?(node: Element): OperatorFunction<T, any>
};

export type PropertiesConfig = ObjectOf<PropertyConfig<any>>;

export type TypeFromConfig<C extends PropertyConfig<any>> = C extends PropertyConfig<infer T> ? T : never;
export type Setter<T> = [BehaviorSubject<T>, PropertyConfig<T>];
export type Setters<C extends PropertiesConfig> = { [K in keyof C]: Setter<TypeFromConfig<C[K]>> };
export type SettersEntry<E> = Observable<[keyof E, E[keyof E] extends Setter<infer T> ? T : any]>;
export type Renderer<T = unknown> = (result: T, container: (Element | DocumentFragment)) => void;
export type ConfigValues<P extends PropertiesConfig> = { [K in keyof P]: P[K] extends PropertyConfig<infer T> ? T : unknown };
export type UpgradedElement<E extends Element, P extends PropertiesConfig> = E & ConfigValues<P>;
export type CustomComponent<P extends PropertiesConfig> = HTMLElement & ConfigValues<P>;

type Constructor<T> = { (value?: any): T } | { new(...args: any[]): T };

export function voidProp<T extends Constructor<any>>(
  initial: T,
  config: Omit<PropertyConfig<(T extends Constructor<infer R> ? R : any) | undefined>, 'initial'> = {}
): PropertyConfig<(T extends Constructor<infer R> ? R : any) | undefined> {
  return { initial: void initial, ...config };
}

export function prop<T>(
  initial: T, config: Omit<PropertyConfig<T>, 'initial'> = {}): PropertyConfig<T> {
  return { initial, ...config };
}

export function parseAttribute<T extends Element, P extends PropertyConfig<any>>(node: T, key: string, config: P) {
  const attributeName = config.attributeName;
  let attribute = (attributeName ? node.getAttribute(attributeName) : node.getAttribute(key)) as string;
  const converter = config.converter || config.initial && config.initial.constructor || JSON;

  if (!attribute && converter !== Boolean) {
    return config.initial;
  }

  switch (converter) {
    case JSON:
      try {
        return JSON.parse(attribute);
      } catch (e) {
        return JSON.parse(`"${attribute.replace(/"/g, '\\"')}"`);
      }
    case Boolean:
      return attributeName ? node.hasAttribute(attributeName) : node.hasAttribute(key);
    case URL:
      return new URL(attribute, location.origin);
    case Date:
      const date = new Date(attribute);
      return date.toString() === 'Invalid Date' ? new Date(Number(attribute)) : date;
    case String:
    case Number:
    case BigInt:
      return converter(attribute);
    default:
      return converter.parse(attribute);
  }
}

export function createPropertiesDescriptors<T extends PropertiesConfig>(
  base: Element, props: T): Setters<typeof props> {
  const newBase = base as typeof base & ConfigValues<T>
  const keys = Object.keys(props) as Array<keyof typeof props>;
  const triggers = {} as Setters<typeof props>;

  Object.defineProperties(newBase, Object.fromEntries(keys.map(key => {
    const config = props[ key ] as PropertyConfig<any>;
    const initial = key in newBase ? newBase[ key ] : parseAttribute(newBase, key as string, config);
    const trigger$ = new BehaviorSubject(initial);
    triggers[ key ] = [trigger$, config];
    return [
      key, {
        get: () => trigger$.getValue(),
        set: (newValue) => trigger$.next(newValue),
        enumerable: true
      }
    ] as [string, PropertyDescriptor];
  })));

  Object.freeze(triggers);
  return triggers;
}

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

export function mapProperties<P extends ObjectOf<PropertyConfig<any>>>(properties: P, node: Element) {
  return map(() => Object.fromEntries(
    Object
      .keys(properties)
      .map(key => [key, (node as any)[ key ]])
    ) as ConfigValues<P>
  );
}

export interface HyperplaneInterface<P extends PropertiesConfig, T = any> {
  subscribe: (...observables: Observable<any>[]) => number;
  useTemplate: (template: (props: ConfigValues<P>) => T) => void;
  connected$: Observable<Event>;
  disconnected$: Observable<Event>;
  propertyChanged$: SettersEntry<Setters<P>>;
  update: () => void;
  component: Element & ConfigValues<P>;
}

export function create<P extends PropertiesConfig, T>(
  node: Element, properties: P, { renderer }: { renderer: Renderer<T> }): HyperplaneInterface<P, T> {
  const subscriptions = [] as Subscription[];
  const registeredObservables = [] as Observable<any>[];

  const setters = createPropertiesDescriptors(node, properties);

  const update$ = new Subject();

  const propertyChanged$ = getPropertyChangeListener(node, setters);

  const connected$ = fromEvent(node, 'connected');
  const disconnected$ = fromEvent(node, 'disconnected');

  node.addEventListener('attributeChanged', ({ detail: [attr, , newValue] }: CustomEventInit) => {
    const [key, setter] = [attr, setters[ attr ]] || Object.entries(setters)
      .find(([, [, { attributeName }]]) => attributeName === attr) || [];
    if (!setter) {
      return;
    }
    setter[ 0 ].next(parseAttribute(node, key, newValue));
  });
  node.addEventListener('connected', () => registeredObservables
    .map((observable) => observable.subscribe())
    .forEach((subscription) => subscriptions.push(subscription))
  );
  node.addEventListener('disconnected', () => subscriptions
    .splice(0, subscriptions.length)
    .forEach((subscription) => subscription.unsubscribe())
  );

  function useTemplate(template: (props: ConfigValues<P>) => T) {
    subscribe(merge(propertyChanged$, update$).pipe(
      mapProperties<P>(properties, node),
      tap((props) => renderer(template(props), node.shadowRoot || node))
    ))
  }

  const subscribe = (...observables: Observable<any>[]) => registeredObservables.push(...observables);
  return {
    subscribe, useTemplate, update() { update$.next(); },
    connected$, disconnected$, propertyChanged$,
    component: node as typeof node & ConfigValues<P>
  };
}
