import {
  type Cause,
  type Context,
  Effect,
  type Layer,
  Option,
  Pipeable,
  type Predicate,
  type Runtime,
  Schema,
} from 'effect'
import { dual } from 'effect/Function'
import type { ParseOptions } from 'effect/SchemaAST'

export type Guard<I, O = never, E = never, R = never> = (
  input: I,
) => Effect.Effect<Option.Option<O>, E, R>

export namespace Guard {
  export type Input<T> = [T] extends [Guard<infer I, infer _R, infer _E, infer _O>] ? I : never

  export type Output<T> = [T] extends [Guard<infer _I, infer O, infer _E, infer _R>] ? O : never

  export type Error<T> = [T] extends [Guard<infer _I, infer _O, infer E, infer _R>] ? E : never

  export type Context<T> = [T] extends [Guard<infer _I, infer _O, infer _E, infer R>] ? R : never
}

export const identity: <A>(a: A) => Effect.Effect<Option.Option<A>> = Effect.succeedSome

export const compose: {
  <O, B, E2, R2>(
    output: Guard<O, B, E2, R2>,
  ): <I, R, E>(input: Guard<I, O, E, R>) => Guard<I, B, E | E2, R | R2>
  <I, O, E, R, B, E2, R2>(
    input: Guard<I, O, E, R>,
    output: Guard<O, B, E2, R2>,
  ): Guard<I, B, E | E2, R | R2>
} = dual(2, function flatMap<
  I,
  O,
  E,
  R,
  B,
  E2,
  R2,
>(input: Guard<I, O, E, R>, output: Guard<O, B, E2, R2>): Guard<I, B, E | E2, R | R2> {
  return (i) =>
    Effect.flatMap(
      input(i),
      Option.match({
        onNone: () => Effect.succeedNone,
        onSome: output,
      }),
    )
})

export const mapEffect: {
  <O, B, E2, R2>(
    f: (o: O) => Effect.Effect<B, E2, R2>,
  ): <I, R, E>(guard: Guard<I, O, E, R>) => Guard<I, B, E | E2, R | R2>
  <I, O, E, R, B, E2, R2>(
    guard: Guard<I, O, E, R>,
    f: (o: O) => Effect.Effect<B, E2, R2>,
  ): Guard<I, B, E | E2, R | R2>
} = dual(2, function mapEffect<
  I,
  O,
  E,
  R,
  B,
  E2,
  R2,
>(guard: Guard<I, O, E, R>, f: (o: O) => Effect.Effect<B, E2, R2>): Guard<I, B, E | E2, R | R2> {
  return compose(guard, (o) => Effect.asSome(f(o)))
})

export const map: {
  <O, B>(f: (o: O) => B): <I, R, E>(guard: Guard<I, O, E, R>) => Guard<I, B, E, R>
  <I, O, E, R, B>(guard: Guard<I, O, E, R>, f: (o: O) => B): Guard<I, B, E, R>
} = dual(2, function map<I, O, E, R, B>(guard: Guard<I, O, E, R>, f: (o: O) => B): Guard<
  I,
  B,
  E,
  R
> {
  return mapEffect(guard, (o) => Effect.sync(() => f(o)))
})

export const tap: {
  <O, B, E2, R2>(
    f: (o: O) => Effect.Effect<B, E2, R2>,
  ): <I, R, E>(guard: Guard<I, O, E, R>) => Guard<I, O, E | E2, R | R2>
  <I, O, E, R, B, E2, R2>(
    guard: Guard<I, O, E, R>,
    f: (o: O) => Effect.Effect<B, E2, R2>,
  ): Guard<I, O, E | E2, R | R2>
} = dual(2, function tap<
  I,
  O,
  E,
  R,
  B,
  E2,
  R2,
>(guard: Guard<I, O, E, R>, f: (o: O) => Effect.Effect<B, E2, R2>): Guard<I, O, E | E2, R | R2> {
  return compose(guard, (o) => Effect.as(f(o), Option.some(o)))
})

export const filterMap: {
  <O, B>(f: (o: O) => Option.Option<B>): <I, R, E>(guard: Guard<I, O, E, R>) => Guard<I, B, E, R>
  <I, O, E, R, B>(guard: Guard<I, O, E, R>, f: (o: O) => Option.Option<B>): Guard<I, B, E, R>
} = dual(
  2,
  <I, O, E, R, B>(guard: Guard<I, O, E, R>, f: (o: O) => Option.Option<B>): Guard<I, B, E, R> => {
    return (i) => Effect.map(guard(i), Option.filterMap(f))
  },
)

export const filter: {
  <O, O2 extends O>(
    predicate: (o: O) => o is O2,
  ): <I, R, E>(guard: Guard<I, O, E, R>) => Guard<I, O, E, R>
  <O>(predicate: (o: O) => boolean): <I, R, E>(guard: Guard<I, O, E, R>) => Guard<I, O, E, R>
  <I, O, E, R, O2 extends O>(
    guard: Guard<I, O, E, R>,
    predicate: (o: O) => o is O2,
  ): Guard<I, O, E, R>
  <I, O, E, R>(guard: Guard<I, O, E, R>, predicate: (o: O) => boolean): Guard<I, O, E, R>
} = dual(
  2,
  <I, O, E, R>(guard: Guard<I, O, E, R>, predicate: (o: O) => boolean): Guard<I, O, E, R> => {
    return (i) => Effect.map(guard(i), Option.filter(predicate))
  },
)

export function any<const GS extends Readonly<Record<string, Guard<any, any, any, any>>>>(
  guards: GS,
): Guard<AnyInput<GS>, AnyOutput<GS>, Guard.Error<GS[keyof GS]>, Guard.Context<GS[keyof GS]>> {
  return (i: AnyInput<GS>) =>
    Effect.gen(function* () {
      for (const [_tag, guard] of Object.entries(guards)) {
        const match = yield* guard(i)
        if (Option.isSome(match)) {
          return Option.some({ _tag, value: match.value } as AnyOutput<GS>)
        }
      }
      return Option.none()
    })
}

export type AnyInput<GS extends Readonly<Record<string, Guard<any, any, any, any>>>> = Guard.Input<
  GS[keyof GS]
>

export type AnyOutput<GS extends Readonly<Record<string, Guard<any, any, any, any>>>> = [
  {
    [K in keyof GS]: { readonly _tag: K; readonly value: Guard.Output<GS[K]> }
  }[keyof GS],
] extends [infer R]
  ? R
  : never

export function liftPredicate<A, B extends A>(predicate: Predicate.Refinement<A, B>): Guard<A, B>
export function liftPredicate<A>(predicate: Predicate.Predicate<A>): Guard<A, A>
export function liftPredicate<A>(predicate: Predicate.Predicate<A>): Guard<A, A> {
  return (a) => Effect.sync(() => (predicate(a) ? Option.some(a) : Option.none()))
}

export const catchAllCause: {
  <E = never, O2 = never, E2 = never, R2 = never>(
    f: (e: Cause.Cause<E>) => Effect.Effect<O2, E2, R2>,
  ): <I = never, O = never, R = never>(guard: Guard<I, O, E, R>) => Guard<I, O | O2, E2, R | R2>
  <I = never, O = never, E = never, R = never, O2 = never, E2 = never, R2 = never>(
    guard: Guard<I, O, E, R>,
    f: (e: Cause.Cause<E>) => Effect.Effect<O2, E2, R2>,
  ): Guard<I, O | O2, E2, R | R2>
} = dual(2, function catchAllCause<
  I,
  O,
  E,
  R,
  O2,
  E2,
  R2,
>(guard: Guard<I, O, E, R>, f: (e: Cause.Cause<E>) => Effect.Effect<O2, E2, R2>): Guard<
  I,
  O | O2,
  E2,
  R | R2
> {
  return (i) => Effect.catchAllCause(guard(i), (a) => Effect.asSome(f(a)))
})

export const catchAll: {
  <E = never, O2 = never, E2 = never, R2 = never>(
    f: (e: E) => Effect.Effect<O2, E2, R2>,
  ): <I = never, O = never, R = never>(guard: Guard<I, O, E, R>) => Guard<I, O | O2, E2, R | R2>
  <I = never, O = never, E = never, R = never, O2 = never, E2 = never, R2 = never>(
    guard: Guard<I, O, E, R>,
    f: (e: E) => Effect.Effect<O2, E2, R2>,
  ): Guard<I, O | O2, E2, R | R2>
} = dual(2, function catchAll<
  I,
  O,
  E,
  R,
  O2,
  E2,
  R2,
>(guard: Guard<I, O, E, R>, f: (e: E) => Effect.Effect<O2, E2, R2>): Guard<I, O | O2, E2, R | R2> {
  return (i) => Effect.catchAll(guard(i), (a) => Effect.asSome(f(a)))
})

export const catchTag: {
  <
    E = never,
    K extends E extends { _tag: string } ? E['_tag'] : never = never,
    O2 = never,
    E2 = never,
    R2 = never,
  >(
    tag: K,
    f: (e: Extract<E, { _tag: K }>) => Effect.Effect<O2, E2, R2>,
  ): <I = never, O = never, R = never>(
    guard: Guard<I, O, E, R>,
  ) => Guard<I, O | O2, E2 | Exclude<E, { _tag: K }>, R | R2>

  <
    I = never,
    O = never,
    E = never,
    R = never,
    K extends E extends { _tag: string } ? E['_tag'] : never = never,
    O2 = never,
    E2 = never,
    R2 = never,
  >(
    guard: Guard<I, O, E, R>,
    tag: K,
    f: (e: Extract<E, { _tag: K }>) => Effect.Effect<O2, E2, R2>,
  ): Guard<I, O | O2, E2 | Exclude<E, { _tag: K }>, R | R2>
} = dual(3, function catchTag<
  I,
  O,
  E,
  R,
  K extends E extends { _tag: string } ? E['_tag'] : never,
  O2,
  E2,
  R2,
>(guard: Guard<I, O, E, R>, tag: K, f: (e: Extract<E, { _tag: K }>) => Effect.Effect<O2, E2, R2>): Guard<
  I,
  O | O2,
  Exclude<E, { _tag: K }> | E2,
  R | R2
> {
  return (i) => Effect.catchTag(guard(i), tag, (e) => Effect.asSome(f(e)))
})

export const provide: {
  <R2>(
    provided: Context.Context<R2>,
  ): <I, O, E, R>(guard: Guard<I, O, E, R>) => Guard<I, O, E, Exclude<R, R2>>
  <R2>(
    provided: Runtime.Runtime<R2>,
  ): <I, O, E, R>(guard: Guard<I, O, E, R>) => Guard<I, O, E, Exclude<R, R2>>
  <R2, E2, R3>(
    provided: Layer.Layer<R2, E2, R3>,
  ): <I, O, E, R>(guard: Guard<I, O, E, R>) => Guard<I, O, E | E2, Exclude<R, R2> | R3>

  <I, O, E, R, R2>(
    guard: Guard<I, O, E, R>,
    provided: Context.Context<R2>,
  ): Guard<I, O, E, Exclude<R, R2>>
  <I, O, E, R, R2>(
    guard: Guard<I, O, E, R>,
    provided: Runtime.Runtime<R2>,
  ): Guard<I, O, E, Exclude<R, R2>>
  <I, O, E, R, R2, E2, R3>(
    guard: Guard<I, O, E, R>,
    provided: Layer.Layer<R2, E2, R3>,
  ): Guard<I, O, E | E2, Exclude<R, R2> | R3>
} = dual(2, function provide<
  I,
  O,
  E,
  R,
  R2,
>(guard: Guard<I, O, E, R>, provided: Context.Context<R2>): Guard<I, O, E, Exclude<R, R2>> {
  return (i) => Effect.provide(guard(i), provided)
})

export const provideService: {
  <Id, S>(
    tag: Context.Tag<Id, S>,
    service: S,
  ): <I, O, E, R>(guard: Guard<I, O, E, R>) => Guard<I, O, E, Exclude<R, Id>>
  <I, O, E, R, Id, S>(
    guard: Guard<I, O, E, R>,
    tag: Context.Tag<Id, S>,
    service: S,
  ): Guard<I, O, E, Exclude<R, Id>>
} = dual(3, function provideService<
  I,
  O,
  E,
  R,
  Id,
  S,
>(guard: Guard<I, O, E, R>, tag: Context.Tag<Id, S>, service: S): Guard<I, O, E, Exclude<R, Id>> {
  return (i) => Effect.provideService(guard(i), tag, service)
})

export const provideServiceEffect: {
  <Id, S, E2, R2>(
    tag: Context.Tag<Id, S>,
    service: Effect.Effect<S, E2, R2>,
  ): <I, O, E, R>(guard: Guard<I, O, E, R>) => Guard<I, O, E | E2, Exclude<R, Id> | R2>
  <I, O, E, R, Id, S, E2, R2>(
    guard: Guard<I, O, E, R>,
    tag: Context.Tag<Id, S>,
    service: Effect.Effect<S, E2, R2>,
  ): Guard<I, O, E | E2, Exclude<R, Id> | R2>
} = dual(3, function provideServiceEffect<
  I,
  O,
  E,
  R,
  Id,
  S,
  E2,
  R2,
>(guard: Guard<I, O, E, R>, tag: Context.Tag<Id, S>, service: Effect.Effect<S, E2, R2>): Guard<
  I,
  O,
  E | E2,
  Exclude<R, Id> | R2
> {
  return (i) => Effect.provideServiceEffect(guard(i), tag, service)
})

const parseOptions: ParseOptions = { errors: 'all', onExcessProperty: 'ignore' }

export function fromSchemaDecode<A, I, R>(schema: Schema.Schema<A, I, R>): Guard<I, A, never, R> {
  const decode_ = Schema.decode(schema)
  return (i: I) =>
    decode_(i, parseOptions).pipe(
      Effect.asSome,
      Effect.catchTag('ParseError', (e) => Effect.succeedNone),
    )
}

export function fromSchemaDecodeUnknown<A, I, R>(
  schema: Schema.Schema<A, I, R>,
): Guard<unknown, A, never, R> {
  const decode_ = Schema.decodeUnknown(schema)
  return (i: unknown) =>
    decode_(i, parseOptions).pipe(
      Effect.asSome,
      Effect.catchTag('ParseError', () => Effect.succeedNone),
    )
}

export function fromSchemaEncode<A, I, R>(schema: Schema.Schema<A, I, R>): Guard<A, I, never, R> {
  const encode_ = Schema.encode(schema)
  return (a: A) =>
    encode_(a, parseOptions).pipe(
      Effect.asSome,
      Effect.catchTag('ParseError', () => Effect.succeedNone),
    )
}

export const decode: {
  <A, O, R2>(
    schema: Schema.Schema<A, O, R2>,
  ): <I, E = never, R = never>(guard: Guard<I, O, E, R>) => Guard<I, A, E, R | R2>

  <I, O, E, R, A, R2>(
    guard: Guard<I, O, E, R>,
    schema: Schema.Schema<A, O, R2>,
  ): Guard<I, A, E, R | R2>
} = dual(2, function decode<
  I,
  O,
  E,
  R,
  A,
  R2,
>(guard: Guard<I, O, E, R>, schema: Schema.Schema<A, O, R2>): Guard<I, A, E, R | R2> {
  return compose(guard, fromSchemaDecode(schema))
})

export const encode: {
  <O, A, R2>(
    schema: Schema.Schema<O, A, R2>,
  ): <I, E = never, R = never>(guard: Guard<I, O, E, R>) => Guard<I, A, E, R | R2>

  <I, O, E, R, A, R2>(
    guard: Guard<I, O, E, R>,
    schema: Schema.Schema<O, A, R2>,
  ): Guard<I, A, E, R | R2>
} = dual(2, function encode<
  I,
  O,
  E,
  R,
  A,
  R2,
>(guard: Guard<I, O, E, R>, schema: Schema.Schema<O, A, R2>): Guard<I, A, E, R | R2> {
  return compose(guard, fromSchemaEncode(schema))
})

const let_: {
  <O, K extends PropertyKey, B>(
    key: K,
    value: (o: O) => B,
  ): <I, E = never, R = never>(guard: Guard<I, O, E, R>) => Guard<I, O & { [k in K]: B }, E, R>

  <I, O, E, R, K extends PropertyKey, B>(
    guard: Guard<I, O, E, R>,
    key: K,
    value: (o: O) => B,
  ): Guard<I, O & { [k in K]: B }, E, R>
} = dual(3, function let_<
  I,
  O,
  E,
  R,
  K extends PropertyKey,
  B,
>(guard: Guard<I, O, E, R>, key: K, value: (o: O) => B): Guard<I, O & { [k in K]: B }, E, R> {
  return map(guard, (a) => ({ ...a, [key]: value(a) }) as O & { [k in K]: B })
})

export { let_ as let }

export const attachProperty: {
  <K extends PropertyKey, B>(
    key: K,
    value: B,
  ): <I, O, E, R>(guard: Guard<I, O, E, R>) => Guard<I, O & { readonly [k in K]: B }, E, R>

  <I, O, E, R, K extends PropertyKey, B>(
    guard: Guard<I, O, E, R>,
    key: K,
    value: B,
  ): Guard<I, O & { readonly [k in K]: B }, E, R>
} = dual(3, function attachProperty<
  I,
  O,
  E,
  R,
  K extends PropertyKey,
  B,
>(guard: Guard<I, O, E, R>, key: K, value: B): Guard<I, O & { readonly [k in K]: B }, E, R> {
  return map(guard, (a) => ({ ...a, [key]: value }) as O & { readonly [k in K]: B })
})

export const addTag: {
  <B>(
    value: B,
  ): <I, O, E = never, R = never>(
    guard: Guard<I, O, E, R>,
  ) => Guard<I, O & { readonly _tag: B }, E, R>

  <I, O, E, R, B>(guard: Guard<I, O, E, R>, value: B): Guard<I, O & { readonly _tag: B }, E, R>
} = dual(2, function addTag<I, O, E, R, B>(guard: Guard<I, O, E, R>, value: B): Guard<
  I,
  O & { readonly _tag: B },
  E,
  R
> {
  return map(guard, (a) => ({ ...a, _tag: value }) as O & { readonly _tag: B })
})

export const bindTo: {
  <K extends PropertyKey>(
    key: K,
  ): <I, O, E, R>(guard: Guard<I, O, E, R>) => Guard<I, { [k in K]: O }, E, R>
  <I, O, E, R, K extends PropertyKey>(
    guard: Guard<I, O, E, R>,
    key: K,
  ): Guard<I, { [k in K]: O }, E, R>
} = dual(
  2,
  <I, O, E, R, K extends PropertyKey>(
    guard: Guard<I, O, E, R>,
    key: K,
  ): Guard<I, { [k in K]: O }, E, R> => map(guard, (a) => ({ [key]: a }) as { [k in K]: O }),
)

export const bind: {
  <I, O, E, R, K extends PropertyKey, B, E2, R2>(
    key: K,
    f: Guard<O, B, E2, R2>,
  ): (guard: Guard<I, O, E, R>) => Guard<I, O & { [k in K]: B }, E | E2, R | R2>

  <I, O, E, R, K extends PropertyKey, B, E2, R2>(
    guard: Guard<I, O, E, R>,
    key: K,
    f: Guard<O, B, E2, R2>,
  ): Guard<I, O & { [k in K]: B }, E | E2, R | R2>
} = dual(3, function bind<
  I,
  O,
  E,
  R,
  K extends PropertyKey,
  B,
  E2,
  R2,
>(guard: Guard<I, O, E, R>, key: K, f: Guard<O, B, E2, R2>): Guard<
  I,
  O & { [k in K]: B },
  E | E2,
  R | R2
> {
  const f_ = bindTo(f, key)

  return compose(guard, (o) =>
    Effect.map(
      f_(o),
      Option.map((b) => ({ ...o, ...b })),
    ),
  )
})

declare global {
  interface Function extends Pipeable.Pipeable {}
}

Function.prototype.pipe = function pipe() {
  // biome-ignore lint/style/noArguments: This is a pipeable function
  return Pipeable.pipeArguments(this, arguments)
}
