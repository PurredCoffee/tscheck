
type typestr<T extends string> = T extends ""?T:T extends `{${infer S}}`?T:never

function test<S extends string>(t: typestr<S>) {}
test('{{}}' as const)
export type {typestr};