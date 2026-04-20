//@ts-check
const { parseType } = require('./parsing/parser')
const { addDefaults, defaultTypes } = require('./default')
const { inspect } = require('util')
/**
 * @import {typecheck, typeEnvironment} from "./parsing/parser" 
 */

/**
 * 
 * @param {{[x: string]: typecheck}} types 
 * @returns {typeEnvironment}
 */
const createEnvironemt = (types = defaultTypes) => ({
    types,
    infertypes: {},
    cache: {},
    check(str) {
        return this.parseType(str).check
    },
    throw(str) {
        return this.parseType(str).throw
    },
    parseType(str, name, ...paramNames) {
        if(this.cache[str] && !name) return this.cache[str]
        let t
        if(this.types[str]) {
            t = this.types[str]
        } else {
            t = parseType(str)
        }
        const p = this
        const ret = {
            params: paramNames,
            check: (v) => t.check(v, p),
            throw: (v) => {
                if(!t.check(v, this)) throw TypeError("value: '" + inspect(v, false, null, false) + "' has the following problems: " + t.throw(v, p)?.trimStart())
            }
        }
        if(ret.params.length == 0) this.cache[str] = ret
        if(name) {
            this.types[name] = {
                params: paramNames,
                check: t.check,
                throw: t.throw
            }
        }
        return ret
    }
})

const defaultenv = createEnvironemt()
addDefaults(defaultenv)

module.exports = {
    defaultenv,
    createEnvironemt
}