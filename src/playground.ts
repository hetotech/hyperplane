import { OperatorFunction, pipe } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { create, prop } from './hyperplane';

const props = {
  name: prop(''),
  middleName: prop(undefined as Nullable<string>),
  age: prop(10, {
      effects: (node) => pipe(
        tap((value) => node.setAttribute('age', value.toFixed(2))),
        map((value) => value.toFixed(2))
      ) as OperatorFunction<number, string>
    }
  )
};

function Testing(node: HTMLElement) {
  const { propertyChanged$, connected$, disconnected$, render, whileConnected } = create(
    node, props, { renderer: null as any }
  );
  render(
    map(({ name, age, middleName }) => `<div>Hello World (${JSON.stringify(({ name, age, middleName }))})</div>`),
  )
}
