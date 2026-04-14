//@ts-check
/**
 * @typedef {{
 *  params?: string[],
 *  check: (v: any, env: typeEnvironment) => boolean,
 *  raw?: any
 * }} typecheck
 */
/**
 * @typedef {{
 *  types: {[x: string]: typecheck},
 *  infertypes: {[x: string]: typecheck},
 *  check(str: string, value: any): boolean,
 *  parseType(str: string, name?: string, ...paramNames: string[]): (value: any) => boolean
 * }} typeEnvironment
 */
/**
 * @typedef {{restStr: string, check: (v: any, env: typeEnvironment) => boolean, raw: any}} typecomp
 */
const paramReg = /^[#$_\p{Lu}\p{Ll}\p{Lt}\p{Lm}\p{Lo}\p{Nl}][$_\p{Lu}\p{Ll}\p{Lt}\p{Lm}\p{Lo}\p{Nl}\u200C\u200D\p{Mn}\p{Mc}\p{Nd}\p{Pc}]*/u
const numberReg = /^^(-?(0b|0B|0o|0x)?[\d_]([\d_]*|[\d_]*\.[\d_]*)|.[\d_]+)(e[+-]?\d+)?/
const stringReg = /^".*?(?<!\\)(?:(\\\\)*)"|^'.*?(?<!\\)(?:(\\\\)*)'/
const regReg = /^\/.*?(?<!\\)(?:(\\\\)*)\//

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
        check: (v) => v === val,
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
        check: (v) => v === val,
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
    const val = new RegExp(reg[0].substring(1, reg[0].length-1));
    return {
        restStr: typestr.substring(reg[0].length),
        check: (v) => typeof v === 'string' && val.test(v),
        raw: reg[0]
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
        const name = paramReg.exec(typestr)
        if (!name) throw new Error('could not parse Property? ' + typestr.substring(0, 20))
        typestr = typestr.substring(name[0].length).trimStart()
        if(typestr[0] != ':') throw new Error('property is improperly defined!')
        typestr = typestr.substring(1)
        let t = parseType(typestr)
        typestr = t.restStr.trimStart()
        if(typestr[0] != ']') throw Error('accessor is not closed!');
        typestr = typestr.substring(1).trimStart()
        if(typestr[0] != ':') throw new Error('property is improperly defined!')
        typestr = typestr.substring(1)
        let vt = parseType(typestr)
        typestr = t.restStr.trimStart()
        if(typestr[0] != '}') throw Error('Object cannot define both an accessor and other properties');
        return {
            restStr: typestr.substring(1),
            check: (v, env) => Object.keys(v).every(p => {
                let ret = true
                let numberbak = env.types['number'];
                env.types['number'] = {
                    check: (v) => Number(v) != Number.NaN
                }
                let check = t.check(p, env);
                //@ts-ignore
                env.types['number'] = numberbak;
                if(check) ret = vt?.check(v?.[p], env)
                return ret
            }),
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
                check: (v, env) => {
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
                                check: params[i]?.check ?? (() => false),
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
                },
                raw: reg[0] + (params.length?`<${params.join(', ')}>`:"")
            }
        }
    }
}

/**
 * 
 * @param {String} typestr
 * @param {(v: any, e: typeEnvironment) => boolean} check
 * @returns {typecomp}
 */
function wrapLiteral(typestr, check) {
    const flags = {
        isArray: false,
        isNullable: false,
        isNonNullable: false,
        and: false,
        /**
         * @type {typecomp?}
         */
        next: null
    }
    let raw = "";
    if(typestr[0] == '?') {
        typestr = typestr.substring(1).trimStart()
        flags.isNullable=true
        const ocheck = check
        check = (v, env) => v == null || ocheck(v, env)
        raw += "?"
    } else if(typestr[0] == '!') {
        typestr = typestr.substring(1).trimStart()
        flags.isNonNullable=true
        const ocheck = check
        check = (v, env) => v != null && ocheck(v, env)
        raw += "!"
    }
    if(typestr.startsWith('[]')) {
        typestr = typestr.substring(2).trimStart()
        flags.isArray = true
        const ocheck = check
        check = (v, env) => Array.isArray(v) && v.every((a) => ocheck(a, env))
        const t = wrapLiteral(typestr, check)
        typestr = t.restStr.trimStart()
        check = t.check
        raw += "[]" + t.raw
    }
    if(typestr[0] == '|') {
        typestr = typestr.substring(1).trimStart()
        flags.and = false
        const next = flags.next = parseType(typestr)
        const ocheck = check
        check = (v, env) => ocheck(v, env) || next.check(v, env)
        raw += " | "
    } else if(typestr[0] == '&') {
        typestr = typestr.substring(1).trimStart()
        flags.and = true
        const next = flags.next = parseType(typestr)
        const ocheck = check
        check = (v, env) => ocheck(v, env) && next.check(v, env)
        raw += " & "
    }
    return {
        restStr: typestr,
        check: check,
        raw
    }
}

/**
 * 
 * @param {String} typestr
 * @returns {typecomp}
 */
function parseWrappedLiteral(typestr) {
    let {restStr: t, check, raw} = parseLiteral(typestr)
    typestr = t.trimStart()
    const ret = wrapLiteral(typestr, check);
    ret.raw = raw + ret.raw;
    return ret;
}

/**
 * 
 * @param {String} typestr
 * @returns {typecomp}
 */
function parseType(typestr) {
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
        if(typestr.startsWith('extends')) {
            typestr = typestr.substring(7).trimStart()
            const t = parseWrappedLiteral(typestr)
            check = t.check
            typestr = typestr.trimStart()
        }
        return {
            check(v, env) {
                const typable = Object.values(env.types).filter(a => !Boolean(a?.params) && a?.check(v, env))
                env.infertypes[name[0]] = {
                    check: (v, env) => typable.every(t => t.check(v, env))
                }
                return check(v, env)
            },
            restStr: typestr,
            raw: 'infer'
        }
    }
    return parseWrappedLiteral(typestr)
}

module.exports = {
    parseType
}