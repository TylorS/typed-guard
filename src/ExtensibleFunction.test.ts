import { describe, expect, it } from '@effect/vitest'
import { ExtensibleFunction } from './ExtensibleFunction.js'

describe('ExtensibleFunction', () => {
  it('should create a function that can be called normally', () => {
    const add = new ExtensibleFunction((x: number) => x + 1)
    expect(add(1)).toBe(2)
  })

  it('should allow extending the function with additional properties', () => {
    class EnhancedFunction extends ExtensibleFunction<(x: number) => number> {
      description: string

      constructor(fn: (x: number) => number, description: string) {
        super(fn)
        this.description = description
      }
    }

    const add = new EnhancedFunction((x: number) => x + 1, 'adds one')
    expect(add(1)).toBe(2)
    expect(add.description).toBe('adds one')
  })

  it('should maintain function properties like length and name', () => {
    const namedFn = function addOne(x: number) {
      return x + 1
    }
    const add = new ExtensibleFunction(namedFn)
    expect(add.length).toBe(1)
    expect(add.name).toBe('addOne')
  })

  it('should work with async functions', async () => {
    const asyncAdd = new ExtensibleFunction(async (x: number) => {
      return x + 1
    })
    expect(await asyncAdd(1)).toBe(2)
  })

  it('should preserve this context in methods', () => {
    class Calculator extends ExtensibleFunction<(x: number) => number> {
      private multiplier: number

      constructor(multiplier: number) {
        super((x: number) => this.multiply(x))
        this.multiplier = multiplier
      }

      private multiply(x: number): number {
        return x * this.multiplier
      }
    }

    const calc = new Calculator(2)
    expect(calc(3)).toBe(6)
  })

  it('should handle multiple arguments correctly', () => {
    const add = new ExtensibleFunction((a: number, b: number) => a + b)
    expect(add(1, 2)).toBe(3)
  })

  it('should work with generic functions', () => {
    const identity = new ExtensibleFunction(<T>(x: T) => x)
    expect(identity(42)).toBe(42)
    expect(identity('test')).toBe('test')
  })

  it('should throw when constructed without arguments', () => {
    expect(() => new ExtensibleFunction(undefined as any)).toThrow()
  })

  it('should maintain proper error stack traces', () => {
    class Throws<E> extends ExtensibleFunction<(cause: E) => never> {
      constructor() {
        super((cause) => {
          throw cause
        })
      }
    }

    const throws = new Throws<Error>()

    try {
      throws(new Error('test error'))
    } catch (e) {
      expect(e instanceof Error).toBe(true)
      expect(e.stack).toBeDefined()
      expect(e.message).toBe('test error')
    }
  })

  it('should allow function composition', () => {
    const add1 = new ExtensibleFunction((x: number) => x + 1)
    const multiply2 = new ExtensibleFunction((x: number) => x * 2)
    const composed = new ExtensibleFunction((x: number) => multiply2(add1(x)))
    expect(composed(3)).toBe(8) // (3 + 1) * 2
  })

  it('should allow class decorator', () => {
    
  })
})
