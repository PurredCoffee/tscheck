//@ts-check
const {expect, test} = require('bun:test')
const {defaultenv} = require('../src/index')

test("type", () => {
    /**
     * @typedef {{meow: {awoof: "test"}}[] | number | [string, number]?} test
     */
    const type = defaultenv.parseType('{meow: {awoof: "test"}}[]? | number | [string, number]')
    const check = type.check
    expect(check(null)).toBeTrue()
    expect(check([{meow: {awoof: "test"}}])).toBeTrue()
    expect(check(4432)).toBeTrue()
    expect(check(["meow", 4432])).toBeTrue()
    expect(check([4432, "meow"])).toBeFalse()
})

test("typedef", () => {
    defaultenv.parseType('T[]?[]', 'Array', 'T')
    const type = defaultenv.parseType('Array<string>')
    const check = type.check
    expect(check(null)).toBeFalse()
    expect(check([["meow"], null])).toBeTrue()
})

test("inference", () => {
    const type = defaultenv.check('{a: infer T, b: T}')
    expect(type({a: 5, b: 'string'})).toBeFalse()
    expect(type({a: 5, b: 32})).toBeTrue()
})

test("numerics", () => {
    expect(defaultenv.parseType('Less<10>').check(3)).toBeTrue()
    expect(defaultenv.parseType('Greater<4>').check(3)).toBeFalse()
    expect(defaultenv.parseType('Shorter<10>').check("testtest")).toBeTrue()
    expect(defaultenv.parseType('Longer<4>').check("test")).toBeFalse()
})

test("regExp", () => {
    expect(defaultenv.parseType('/cool/').check("this string is cool")).toBeTrue()
    expect(defaultenv.parseType('{x: /.+@.+\\..+/}').check({x: "email@cool.com"})).toBeTrue()
})