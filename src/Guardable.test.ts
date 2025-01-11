import { describe, expect, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { Guardable, GUARDABLE } from './Guardable.js'

describe('Guardable', () => {
  it('should be a Guard function', async () => {
    class Test extends Guardable<number, number> {
      constructor(readonly multiplier: number) {
        super()
      }

      [GUARDABLE] = (input: number) => Effect.succeedSome(input * this.multiplier)
    }
    const test = new Test(3)

    expect(await Effect.runPromise(test(1))).toEqual(Option.some(3))
  })
})
