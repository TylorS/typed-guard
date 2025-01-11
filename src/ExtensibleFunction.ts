function Extensible<I, O>(f: (input: I) => O): (input: I) => O {
  return Object.setPrototypeOf(f, new.target.prototype)
}
Extensible.prototype = Function.prototype

// Hack to make the type inference work
export const ExtensibleFunction: new <F extends (...inputs: readonly any[]) => any>(f: F) => F =
  Extensible as any
