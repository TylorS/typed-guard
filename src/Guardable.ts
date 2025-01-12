import * as Pipeable from 'effect/Pipeable'
import { ExtensibleFunction } from './ExtensibleFunction.js'
import type { Guard } from './Guard.js'

export const GUARDABLE = Symbol.for('@typed/guard/Guardable')
export type GUARDABLE = typeof GUARDABLE

export abstract class Guardable<I, O, E = never, R = never>
  extends ExtensibleFunction<Guard<I, O, E, R>>
  implements Pipeable.Pipeable
{
  constructor() {
    super((input) => this[GUARDABLE](input))
  }

  abstract readonly [GUARDABLE]: Guard<I, O, E, R>

  pipe() {
    // biome-ignore lint/style/noArguments: This is a pipeable function
    return Pipeable.pipeArguments(this, arguments)
  }
}
