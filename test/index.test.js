//@ts-check
const {expect, test} = require('bun:test')
const {defaultenv} = require('../src/index')

test("type", () => {
    const type = defaultenv.parseType('{meow: {awoof: "test"}}[]? | number | [string, number]')
    expect(type(null)).toBeTrue()
    expect(type([{meow: {awoof: "test"}}])).toBeTrue()
    expect(type(4432)).toBeTrue()
    expect(type(["meow", 4432])).toBeTrue()
    expect(type([4432, "meow"])).toBeFalse()
})

test("typedef", () => {
    defaultenv.parseType('T[]?[]', 'Array', 'T')
    const type = defaultenv.parseType('Array<string>')
    expect(type(null)).toBeFalse()
    expect(type([["meow"], null])).toBeTrue()
})

test("inference", () => {
    const type = defaultenv.parseType('{a: infer T, b: T}')
    expect(type({a: 5, b: 'string'})).toBeFalse()
    expect(type({a: 5, b: 32})).toBeTrue()
})

test("numerics", () => {
    expect(defaultenv.parseType('Less<10>')(3)).toBeTrue()
    expect(defaultenv.parseType('Greater<4>')(3)).toBeFalse()
    expect(defaultenv.parseType('Shorter<10>')("testtest")).toBeTrue()
    expect(defaultenv.parseType('Longer<4>')("test")).toBeFalse()
})

test("regExp", () => {
    expect(defaultenv.parseType('/cool/')("this string is cool")).toBeTrue()
    expect(defaultenv.parseType('{x: /.+@.+\\..+/}')({x: "email@cool.com"})).toBeTrue()
})