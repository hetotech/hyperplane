type Spy = ((...args: any[]) => any) & {
  called: boolean;
  calledTimes: number;
  calledWith: Set<any[]>;
  lastCalledWith: any[];
  nthCallArgs(n: number): any[];
  nthCallWith(n: number, ...args: any[]): boolean;
  resetSpy(): void;
};

export function createSpy(cb?: Function): Spy {
  const calls = new Set<any[]>();
  return Object.defineProperties(function (...args: any[]) {
    calls.add(args);
    if (cb) {
      return cb(...args || []);
    }
  }, {
    called: { get() {return calls.size > 0; } },
    calledTimes: { get() {return calls.size; } },
    calledWith: { get() {return new Set(calls); } },
    lastCalledWith: { get() {return [...calls].pop();}},
    nthCallArgs: { value(n: number) { return [...calls][ n ]; } },
    nthCallWith: {
      value(n: number, ...args: any[]) {
        const storedArgs = [...calls][ n ];
        return args.every((arg, i) => arg === storedArgs[ i ]);
      }
    },
    resetSpy: { value() {calls.clear();} }
  });
}

export function assertTSType<T>(arg: T) {
  return arg;
}
