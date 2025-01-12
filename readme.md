# @typed/guard

[![npm version](https://badge.fury.io/js/%40typed%2Fguard.svg)](https://badge.fury.io/js/%40typed%2Fguard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful, type-safe runtime validation library built on top of [Effect](https://effect.website/). `@typed/guard` provides a flexible and composable way to validate and transform data with full type inference and runtime safety.

## Features

- 🛡️ **Type-safe Guards**: Runtime validation with complete type inference
- 🔄 **Effect Integration**: Seamless integration with Effect's ecosystem
- 🎯 **Composable**: Rich set of combinators for building complex validations
- 🌳 **Tree-shakeable**: Only import what you need
- 🔍 **Schema Integration**: First-class support for Effect's Schema
- ⚡ **Zero Dependencies**: Only requires Effect as a peer dependency

## Installation

```bash
# Using npm
npm install @typed/guard effect

# Using yarn
yarn add @typed/guard effect

# Using pnpm
pnpm add @typed/guard effect
```

## Quick Start

```typescript
import * as Guard from '@typed/guard'
import { Effect, Option } from 'effect'

// Simple number validation
const isPositive = Guard.liftPredicate((n: number) => n > 0)

// Usage
const result = Effect.runSync(isPositive(5))  // Option.some(5)
const invalid = Effect.runSync(isPositive(-1)) // Option.none()

// Composing guards
const toString = Guard.map(isPositive, n => n.toString())
const result2 = Effect.runSync(toString(5)) // Option.some("5")
```

## Core Concepts

### Guards

A Guard is a function that takes an input and returns an `Effect` containing an `Option` of the output:

```typescript
type Guard<I, O = never, E = never, R = never> = 
  (input: I) => Effect.Effect<Option.Option<O>, E, R>
```

- `I`: Input type
- `O`: Output type
- `E`: Error type
- `R`: Required context

### Key Operations

#### Composition

```typescript
const numberToString = (n: number) =>
  Effect.succeed(n > 5 ? Option.some(n.toString()) : Option.none())

const stringToLength = (s: string) =>
  Effect.succeed(s.length > 1 ? Option.some(s.length) : Option.none())

// Compose them together
const composed: Guard<number, number> = Guard.compose(numberToString, stringLength)
```

#### Filtering and Mapping

```typescript
// Filter values
const evenNumbers = Guard.filter(isPositive, n => n % 2 === 0)

// Map values with effects
const asyncTransform = Guard.mapEffect(isPositive, n => 
  Effect.promise(() => Promise.resolve(n * 2))
)
```

#### Error Handling

```typescript
const withRecovery = Guard.catchAll(
  failingGuard,
  error => Effect.succeed(`Recovered from: ${error}`)
)

const withTaggedRecovery = Guard.catchTag(
  failingGuard,
  'ValidationError',
  error => Effect.succeed(`Invalid input: ${error.message}`)
)
```

#### Schema Integration

```typescript
import { Schema } from 'effect'

const PersonSchema = Schema.Struct({
  name: Schema.string,
  age: Schema.number
})

const personGuard = Guard.fromSchemaDecode(PersonSchema)
const personGuard = Guard.fromSchemaDecodeUnknown(PersonSchema)
const personGuard = Guard.fromSchemaEncode(PersonSchema)
```

## Advanced Usage

### Pattern Matching with `any`

```typescript
const numberOrString = Guard.any({
  number: Guard.liftPredicate((n): n is number => typeof n === 'number'),
  string: Guard.liftPredicate((s): s is string => typeof s === 'string')
})

// Returns: { _tag: 'number', value: 123 }
Effect.runSync(numberOrString(123))

// Returns: { _tag: 'string', value: 'hello' }
Effect.runSync(numberOrString('hello'))
```

### Property Binding

```typescript
import { pipe } from 'effect'

const complexGuard = pipe(
  Guard.identity<number>,
  Guard.bindTo('value'),
  Guard.bind('asString', ({ value }) => 
    Effect.succeedSome(value.toString())
  ),
  Guard.let('asBigInt', ({ asString }) => 
    BigInt(asString)
  )
)

// Returns: { value: 123, asString: '123', asBigInt: 123n }
Effect.runSync(complexGuard(123))
```

### Creating Reusable Guards with `Guardable`

The `Guardable` class allows you to create reusable guards as classes. This is particularly useful when you need to create guards that are also data structures

```typescript
import { Guardable, GUARDABLE } from '@typed/guard'
import { Effect } from 'effect'

// Create a guard that multiplies numbers by a configurable value
class MultiplyGuard extends Guardable<number, number> {
  constructor(readonly multiplier: number) {
    super()
  }

  // Implement the GUARDABLE symbol to define the guard's behavior
  [GUARDABLE] = (input: number) => 
    Effect.succeedSome(input * this.multiplier)
}

// Create an instance with a specific multiplier
const multiplyByThree = new MultiplyGuard(3)

// Use it like a regular guard function
Effect.runSync(multiplyByThree(4)) // Option.some(12)

// It's pipeable too!

const guard = multiplyByThree.pipe(
  Guard.map(n => n.toString()),
)

Effect.runSync(guard(4)) // Option.some("12")
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © [Tylor Steinberger](https://github.com/TylorS)

