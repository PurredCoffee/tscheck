//@ts-check
/**
 * @typedef {{
 *  params?: string[],
 *  check: (v: any, env: typeEnvironment) => boolean,
 *  throw: (v: any, env: typeEnvironment) => string | undefined,
 *  raw?: any
 * }} typecheck
 */
/**
 * @typedef {{
 *  types: {[x: string]: typecheck},
 *  infertypes: {[x: string]: typecheck},
 *  check(str: string): (value: any) => boolean,
 *  throw(str: string): (value: any, name?: string) => void,
 *  parseType(str: string, name?: string, ...paramNames: string[]): {
 *   params?: string[],
 *   check: (v: any) => boolean,
 *   throw: (v: any, name?: string) => void,
 *  },
 *  cache: {[key: string]: {
 *   params?: string[],
 *   check: (v: any) => boolean,
 *   throw: (v: any, name?: string) => void,
 *  }},
 *  wrapFunction<T extends (...args: any) => any>(args: [string, string][], callback: T): T
 * }} typeEnvironment
 */
/**
 * @typedef {{
 *  restStr: string, 
 *  check: (v: any, env: typeEnvironment) => boolean, 
 *  throw: (v: any, env: typeEnvironment) => string | undefined,
 *  raw: any
 * }} typecomp
 */

const paramReg = /^[#$_\p{Lu}\p{Ll}\p{Lt}\p{Lm}\p{Lo}\p{Nl}][$_\p{Lu}\p{Ll}\p{Lt}\p{Lm}\p{Lo}\p{Nl}\u200C\u200D\p{Mn}\p{Mc}\p{Nd}\p{Pc}]*/u
const numberReg = /^^(-?(0b|0B|0o|0x)?[\d_]([\d_]*|[\d_]*\.[\d_]*)|.[\d_]+)(e[+-]?\d+)?/
const stringReg = /^".*?(?<!\\)(?:(\\\\)*)"|^'.*?(?<!\\)(?:(\\\\)*)'/
const regReg = /^\/.*?(?<!\\)(?:(\\\\)*)\//

/**
 * 
 * @param {string} response 
 * @param {(v: any, env: typeEnvironment) => boolean} check
 * @returns {{throw: (v: any, env: typeEnvironment) => string | undefined, check: (v: any, env: typeEnvironment) => boolean}}
 */
function throwFalse(check, response) {
    return {
        check,
        throw: (...args) => {
            //@ts-ignore
            if(!check(...args)) return response
        }
    }
}
/**
 * 
 * @param {String} typestr
 * @returns {typecomp}
 */
function parseString(typestr) {
    const reg = stringReg.exec(typestr)
    if(!reg) throw new Error("not a properly defined string: " + typestr.substring(0, 20))
    const val = JSON.parse(reg[0])
    return {
        restStr: typestr.substring(reg[0].length),
        ...throwFalse((v) => v === val, ` != "${reg[0]}"`),
        raw: reg[0]
    }
}

/**
 * 
 * @param {String} typestr
 * @returns {typecomp}
 */
function parseNum(typestr) {
    const reg = numberReg.exec(typestr)
    if(!reg) throw new Error("not a properly defined number: " + typestr.substring(0, 20))
    const val = reg[0][0] == '0'?parseInt(reg[0]):parseFloat(reg[0])
    return {
        restStr: typestr.substring(reg[0].length),
        ...throwFalse((v) => v === val, ` != ${val}`),
        raw: val
    }
}

/**
 * 
 * @param {String} typestr
 * @returns {typecomp}
 */
function parseReg(typestr) {
    const reg = regReg.exec(typestr)
    if(!reg) throw new Error("not a properly defined regex: " + typestr.substring(0, 20))
    const val = new RegExp(reg[0].substring(1, reg[0].length-1))
    return {
        restStr: typestr.substring(reg[0].length),
        ...throwFalse((v) => typeof v === 'string' && val.test(v), ` !≡ /${reg[0]}/`),
        raw: "/" + reg[0] + "/"
    }
}

/**
 * 
 * @param {String} typestr
 * @returns {typecomp}
 */
function parseObject(typestr) {
    typestr = typestr.substring(1).trimStart()
    if(typestr[0] == '[') {
        typestr = typestr.substring(1).trimStart()
        const name = paramReg.exec(typestr)
        if (!name) throw new Error('could not parse Property? ' + typestr.substring(0, 20))
        typestr = typestr.substring(name[0].length).trimStart()
        if(typestr[0] != ':') throw new Error('property is improperly defined!')
        typestr = typestr.substring(1)
        let t = parseType(typestr)
        typestr = t.restStr.trimStart()
        if(typestr[0] != ']') throw Error('accessor is not closed!')
        typestr = typestr.substring(1).trimStart()
        if(typestr[0] != ':') throw new Error('property is improperly defined!')
        typestr = typestr.substring(1)
        let vt = parseType(typestr)
        typestr = vt.restStr.trimStart()
        if(typestr[0] != '}') throw Error('Object cannot define both an accessor and other properties')
        return {
            restStr: typestr.substring(1),
            check: (v, env) => Object.keys(v).every(p => {
                let ret = true
                let numberbak = env.types['number']
                env.types['number'] = throwFalse((v) => Number(v) != Number.NaN, ` not of type number`)
                let check = t.check(p, env)
                //@ts-ignore
                env.types['number'] = numberbak
                if(check) ret = vt?.check(v?.[p], env)
                return ret
            }),
            throw: (v, env) => {
                const x = Object.keys(v).map(p => {
                    let numberbak = env.types['number']
                    env.types['number'] = throwFalse((v) => Number(v) != Number.NaN, ` not of type number`)
                    let ret = t.throw(p, env)
                    if(Boolean(ret)) ret = `[${p}${ret}]`
                    //@ts-ignore
                    env.types['number'] = numberbak
                    if(!Boolean(ret)) {
                        ret = vt?.throw(v?.[p], env)
                        if(Boolean(ret)) ret = `[${p}]${ret}`
                    }
                    return ret
                }).filter(Boolean)
                if(x.length == 1) {
                    return x[0]
                } else if(x.length > 1) {
                    return `(${x.join(" & ")})`
                }
            },
            raw: "[" + t.raw + "]:" + vt.raw 
        }
    }
    /**
     * @type {{[x: string]: typecomp}}
     */
    const testValues = {}
    while(typestr[0] != '}') {
        if(!typestr) throw Error('Object was not closed')
        const name = paramReg.exec(typestr)
        if (!name) throw new Error('could not parse Property? ' + typestr.substring(0, 20))
        typestr = typestr.substring(name[0].length).trimStart()
        if(typestr[0] != ':') throw new Error('property is improperly defined!')
        typestr = typestr.substring(1)
        let t = parseType(typestr)
        typestr = t.restStr.trimStart()
        testValues[name[0]] = t
        if(typestr[0] == ',') {
            typestr = typestr.substring(1).trimStart()
        } else if(typestr[0] != '}') throw Error('Object is missing a comma!')
    }

    return {
        restStr: typestr.substring(1),
        check: (v, env) => Object.keys(testValues).every(p => testValues[p]?.check(v?.[p], env)),
        throw: (v, env) => {
            const x = Object.keys(testValues).map(p => {
                const ret = testValues[p]?.throw(v?.[p], env)
                if(ret) return `[${p}]${ret}`
            }).filter(Boolean)
            if(x.length == 1) {
                return x[0]
            } else if(x.length > 1) {
                return `(${x.join(" & ")})`
            }
        },
        raw: Object.fromEntries(
            Object.entries(testValues).map(([key, value]) => [key, value.raw])
        )
    }
}

/**
 * 
 * @param {String} typestr
 * @returns {typecomp}
 */
function parseArray(typestr) {
    typestr = typestr.substring(1).trimStart()
    /**
     * @type {typecomp[]}
     */
    const testValues = []
    while(typestr[0] != ']') {
        if(!typestr) throw Error('Object was not closed')
        let t = parseType(typestr)
        typestr = t.restStr.trimStart()
        testValues.push(t)
        if(typestr[0] == ',') {
            typestr = typestr.substring(1).trimStart()
        } else if(typestr[0] != ']') throw Error('Object is missing a comma!')
    }
    return {
        restStr: typestr.substring(1),
        check: (v, env) => Array.isArray(v) && testValues.every((p, i) => p.check(v[i], env)),
        throw: (v, env) => {
            if(!Array.isArray(v)) return " is not of type Array"
            const x = testValues.map((p, i) => {
                const ret = p?.throw(v?.[i], env)
                if(ret) return `[${i}]${ret}`
            }).filter(Boolean)
            if(x.length == 1) {
                return x[0]
            } else if(x.length > 1) {
                return `(${x.join(" & ")})`
            }
        },
        raw: testValues.map(v => v.raw)
    }
}

/**
 * 
 * @param {String} typestr
 * @returns {typecomp}
 */
function parseLiteral(typestr) {
    switch (typestr[0]) {
        case '(': {
            let ret = parseType(typestr)
            ret.restStr = ret.restStr.trimStart()
            if(ret.restStr[0] != ')') throw Error('opening bracket is not closed!')
            ret.restStr = ret.restStr.substring(1)
            return ret
        }
        case '{': {
            return parseObject(typestr)
        }
        case '[': {
            return parseArray(typestr)
        }
        case '"':
        case "'":
            return parseString(typestr)
        case "/":
            return parseReg(typestr)
        case ".":
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
            return parseNum(typestr)
        default: {
            const reg = paramReg.exec(typestr)
            if (!reg) throw new Error('could not parse Property? ' + typestr.substring(0, 20))
            typestr = typestr.substring(reg[0].length).trimStart()
            /**
             * @type {typecomp[]}
             */
            const params = []
            if(typestr[0] == '<') {
                typestr = typestr.substring(1)
                while((typestr = typestr.trimStart()) != '>') {
                    const t = parseType(typestr)
                    params.push(t)
                    typestr = t.restStr.trimStart()
                    if(typestr[0] == ',') {
                        typestr = typestr.substring(1).trimStart()
                    } else if(typestr[0] != '>') throw Error('Object is missing a comma!')
                }
            }
            return {
                restStr: typestr,
                ...throwFalse((v, env) => {
                    const t = env.types[reg[0]] ?? env.infertypes[reg[0]]
                    if(!t) return false
                    /**
                     * @type {any[]}
                     */
                    const bak = []
                    const inferbak = env.infertypes
                    try {
                        env.infertypes = {}
                        t.params?.forEach((v, i) => {
                            bak.push(env.types[v])
                            env.types[v] = {
                                ...throwFalse(params[i]?.check ?? (() => false), ` not of type ${v}`),
                                raw: params[i]?.raw
                            }
                        })
                        return t.check(v, env)
                    } finally {
                        t.params?.forEach(v => {
                            env.types[v] = bak.shift()
                        })
                        env.infertypes = inferbak
                    }
                },` not of type ${reg[0] + (params.length?`<${params.map(v => v.raw).join(', ')}>`:"")}`),
                raw: reg[0] + (params.length?`<${params.map(v => v.raw).join(', ')}>`:"")
            }
        }
    }
}

/**
 * 
 * @param {String} typestr
 * @param {(v: any, e: typeEnvironment) => boolean} check
 * @param {(v: any, e: typeEnvironment) => string | undefined} thrw
 * @returns {typecomp}
 */
function wrapLiteral(typestr, check, thrw) {
    const flags = {
        isArray: false,
        isNullable: false,
        isNonNullable: false
    }
    let raw = ""
    if(typestr[0] == '?') {
        typestr = typestr.substring(1).trimStart()
        flags.isNullable=true
        const ocheck = check
        check = (v, env) => v == null || ocheck(v, env)
        const othrow = thrw
        thrw = (v, env) => {
            const ret = othrow(v,env)
            return v == null?undefined:ret? ret + " & != null":undefined
        }
        raw += "?"
    } else if(typestr[0] == '!') {
        typestr = typestr.substring(1).trimStart()
        flags.isNonNullable=true
        const ocheck = check
        check = (v, env) => v != null && ocheck(v, env)
        const othrow = thrw
        thrw = (v, env) => {
            const ret = othrow(v, env)
            if(ret) {
                if(v == null) return ` == null & ${ret}`
            }
            if(v == null) return ` == null`
        }
        raw += "!"
    }
    if(typestr.startsWith('[]')) {
        typestr = typestr.substring(2).trimStart()
        flags.isArray = true
        const ocheck = check
        check = (v, env) => Array.isArray(v) && v.every((a) => ocheck(a, env))
        const othrow = thrw
        thrw = (v, env) => {
            if(!Array.isArray(v)) return " not of type Array"
            const ret = v.map((a, i) => {
                const ret = othrow(a, env)
                if(Boolean(ret)) return `[${i}]${ret}`
            }).filter(Boolean)
            if(ret.length == 1) return ret[0]
            if(ret.length > 1) return `(${ret.join(" & ")})`
        }
        const t = wrapLiteral(typestr, check, thrw)
        typestr = t.restStr.trimStart()
        check = t.check
        raw += "[]" + t.raw
    }
    return {
        restStr: typestr,
        check: check,
        throw: thrw,
        raw
    }
}

/**
 * 
 * @param {String} typestr
 * @returns {typecomp}
 */
function parseWrappedLiteral(typestr) {
    let {restStr: t, check, throw: thrw, raw} = parseLiteral(typestr)
    typestr = t.trimStart()
    const ret = wrapLiteral(typestr, check, thrw)
    ret.raw = raw + ret.raw
    return ret
}
/**
 * 
 * @param {String} typestr
 * @returns {typecomp}
 */
function inferType(typestr) {
    typestr = typestr.trimStart()
    if(typestr.startsWith('infer')) {
        typestr = typestr.substring(5).trimStart()
        const name = paramReg.exec(typestr)
        if(!name) throw Error('Could not infer type name!')
        typestr = typestr.substring(name[0].length).trimStart()
        /**
         * @type {(v: any, env: typeEnvironment) => boolean}
         */
        let check = () => true
        let raw
        if(typestr.startsWith('extends')) {
            typestr = typestr.substring(7).trimStart()
            const t = parseWrappedLiteral(typestr)
            check = t.check
            raw = t.raw 
            typestr = typestr.trimStart()
        }
        return {
            restStr: typestr,
            ...throwFalse((v, env) => {
                const typable = Object.values(env.types).filter(a => !Boolean(a?.params) && a?.check(v, env))
                env.infertypes[name[0]] = {
                    check: (v, env) => typable.every(t => t.check(v, env)),
                    throw: () => undefined
                }
                return check(v, env)
            }, ` does not extend ${raw}`),
            raw: 'infer'
        }
    }
    return parseWrappedLiteral(typestr)
}

/**
 * 
 * @param {String} typestr
 * @returns {typecomp}
 */
function parseIntersection(typestr) {
    const next = [
        inferType(typestr)
    ]
    if(!next[0]) throw 'TS IGNORE'
    typestr = next[0].restStr.trimStart()
    let raw = next[0].raw
    if(typestr[0] == '&') {
        while(typestr[0] == '&') {
            typestr = typestr.substring(1).trimStart()
            next.push(inferType(typestr))
            //@ts-ignore
            typestr = next[next.length-1].restStr.trimStart()
            raw += " & " + next[next.length-1]?.raw.trimStart()
        }
        return {
            restStr: typestr,
            check: (v, env) => next.every(a => a.check(v, env)) ?? false,
            throw: (v, env) => {
                const ret = next.map(a => a.throw(v, env)).filter(Boolean)
                if(ret.length == 1) {
                    return ret[0]
                }
                if(ret.length > 1) {
                    return `(${ret.map(v => v?.trimStart()).join(" | ")})`
                }
            },
            raw
        }
    }
    return next[0]
}
/**
 * 
 * @param {String} typestr
 * @returns {typecomp}
 */
function parseType(typestr) {
    const next = [
        parseIntersection(typestr)
    ]
    if(!next[0]) throw 'TS IGNORE'
    typestr = next[0].restStr.trimStart()
    let raw = next[0].raw
    if(typestr[0] == '|') {
        while(typestr[0] == '|') {
            typestr = typestr.substring(1).trimStart()
            next.push(parseIntersection(typestr))
            //@ts-ignore
            typestr = next[next.length-1].restStr.trimStart()
            raw += " | " + next[next.length-1]?.raw.trimStart()
        }
        return {
            restStr: typestr,
            check: (v, env) => next.some(a => a.check(v, env)),
            throw: (v, env) => {
                const ret = []
                for(let x = 0; x < next.length; x++) {
                    let p = next[x]?.throw(v, env)
                    if(!p) return
                    ret.push(p)
                }
                if(ret.length == 1) return ret[0]
                return `(${ret.map(v => v.trimStart()).join(" & ")})`
            },
            raw
        }
    }
    return next[0]
}

module.exports = {
    parseType
}