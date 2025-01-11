import { Effect, identity, Option, pipe, Predicate, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import * as Guard from './Guard'

describe('Guard', () => {
  // Helper function to run a guard and get the result
  const runGuard = <I, O, E>(guard: Guard.Guard<I, O, E>, input: I) => Effect.runSync(guard(input))

  describe('basic functionality', () => {
    it('should create a basic guard that succeeds', () => {
      const guard = (input: number): Effect.Effect<Option.Option<string>, never, never> =>
        Effect.succeed(input > 5 ? Option.some(input.toString()) : Option.none())

      expect(runGuard(guard, 10)).toEqual(Option.some('10'))
      expect(runGuard(guard, 3)).toEqual(Option.none())
    })
  })

  describe('compose', () => {
    it('should compose two guards', () => {
      const numberToString = (n: number) =>
        Effect.succeed(n > 5 ? Option.some(n.toString()) : Option.none())
      const stringToLength = (s: string) =>
        Effect.succeed(s.length > 1 ? Option.some(s.length) : Option.none())

      const composed = Guard.compose(numberToString, stringToLength)

      expect(runGuard(composed, 10)).toEqual(Option.some(2))
      expect(runGuard(composed, 3)).toEqual(Option.none())
    })
  })

  describe('mapEffect and map', () => {
    it('should map over guard results with Effect', () => {
      const guard = (n: number) => Effect.succeed(n > 5 ? Option.some(n) : Option.none())
      const mapped = Guard.mapEffect(guard, (n) => Effect.succeed(n * 2))

      expect(runGuard(mapped, 10)).toEqual(Option.some(20))
      expect(runGuard(mapped, 3)).toEqual(Option.none())
    })

    it('should map over guard results synchronously', () => {
      const guard = (n: number) => Effect.succeed(n > 5 ? Option.some(n) : Option.none())
      const mapped = Guard.map(guard, (n) => n * 2)

      expect(runGuard(mapped, 10)).toEqual(Option.some(20))
      expect(runGuard(mapped, 3)).toEqual(Option.none())
    })
  })

  describe('tap', () => {
    it('should perform side effects without modifying the result', () => {
      let sideEffect = 0
      const guard = (n: number) => Effect.succeed(n > 5 ? Option.some(n) : Option.none())
      const tapped = Guard.tap(guard, (n) =>
        Effect.sync(() => {
          sideEffect = n
        }),
      )

      expect(runGuard(tapped, 10)).toEqual(Option.some(10))
      expect(sideEffect).toBe(10)

      expect(runGuard(tapped, 3)).toEqual(Option.none())
      expect(sideEffect).toBe(10) // Unchanged because guard returned None
    })
  })

  describe('filterMap and filter', () => {
    it('should filter and map values', () => {
      const filtered = Guard.filterMap(Guard.identity<number>, (n) =>
        n > 5 ? Option.some(n.toString()) : Option.none(),
      )

      expect(runGuard(filtered, 10)).toEqual(Option.some('10'))
      expect(runGuard(filtered, 3)).toEqual(Option.none())
    })

    it('should filter values', () => {
      const filtered = Guard.filter(Guard.identity<number>, (n) => n > 5)

      expect(runGuard(filtered, 10)).toEqual(Option.some(10))
      expect(runGuard(filtered, 3)).toEqual(Option.none())
    })
  })

  describe('any', () => {
    it('should match against multiple guards', () => {
      const anyGuard = Guard.any({
        number: Guard.liftPredicate(Predicate.isNumber),
        string: Guard.liftPredicate(Predicate.isString),
      })

      expect(runGuard(anyGuard, 123)).toEqual(Option.some({ _tag: 'number', value: 123 }))
      expect(runGuard(anyGuard, 'test')).toEqual(Option.some({ _tag: 'string', value: 'test' }))
      expect(runGuard(anyGuard, true)).toEqual(Option.none())
    })
  })

  describe('liftPredicate', () => {
    it('should lift a predicate into a guard', () => {
      const guard = Guard.liftPredicate(Predicate.isNumber)

      expect(runGuard(guard, 123)).toEqual(Option.some(123))
      expect(runGuard(guard, 'test')).toEqual(Option.none())
    })
  })

  describe('error handling', () => {
    describe('catchAll and catchAllCause', () => {
      it('should catch errors', () => {
        const failingGuard = (_: unknown) => Effect.fail('error')
        const recovered = Guard.catchAll(failingGuard, (e) =>
          Effect.succeed(['recovered:', e].join(' ')),
        )

        expect(runGuard(recovered, 123)).toEqual(Option.some('recovered: error'))
      })

      it('should catch error causes', () => {
        const failingGuard = (_: unknown) => Effect.fail('error')
        const recovered = Guard.catchAllCause(failingGuard, () =>
          Effect.succeed('recovered from cause'),
        )

        expect(runGuard(recovered, 123)).toEqual(Option.some('recovered from cause'))
      })
    })

    describe('catchTag', () => {
      it('should catch specific error tags', () => {
        type MyError = { _tag: 'MyError'; message: string }
        const failingGuard = (_: unknown) =>
          Effect.fail({ _tag: 'MyError', message: 'test error' } as MyError)
        const recovered = Guard.catchTag(failingGuard, 'MyError', (e) =>
          Effect.succeed(['recovered:', e.message].join(' ')),
        )

        expect(runGuard(recovered, 123)).toEqual(Option.some('recovered: test error'))
      })
    })
  })

  describe('schema integration', () => {
    describe('fromSchemaDecode', () => {
      it('should create a guard from a schema decoder', () => {
        const guard = Guard.fromSchemaDecodeUnknown(Schema.Number)

        expect(runGuard(guard, 123)).toEqual(Option.some(123))
        expect(runGuard(guard, 'test')).toEqual(Option.none())
      })
    })

    describe('fromSchemaEncode', () => {
      it('should create a guard from a schema encoder', () => {
        const guard = Guard.fromSchemaEncode(Schema.Number)

        expect(runGuard(guard, 123)).toEqual(Option.some(123))
        expect(runGuard(guard, 'test' as any)).toEqual(Option.none())
      })
    })
  })

  describe('property attachment', () => {
    describe('attachProperty', () => {
      it('should attach a property to the guarded value', () => {
        const guard = (n: number) => Effect.succeed(Option.some({ value: n }))
        const withProp = Guard.addTag(guard, 'number')

        expect(runGuard(withProp, 123)).toEqual(Option.some({ _tag: 'number', value: 123 }))
      })
    })

    describe('bind', () => {
      it('should bind a new property based on the guarded value', () => {
        const guard = pipe(
          Guard.identity<number>,
          Guard.bindTo('value'),
          Guard.bind('asString', ({ value }) => Effect.succeedSome(value.toString())),
          Guard.let('asBigInt', ({ asString }) => BigInt(asString)),
        )

        expect(runGuard(guard, 123)).toEqual(
          Option.some({ value: 123, asString: '123', asBigInt: 123n }),
        )
      })
    })
  })
})
