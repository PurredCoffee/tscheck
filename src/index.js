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
        const t = parseType(str)
        return (value) => t.check(value, this)
    },
    throw(str) {
        const t = parseType(str)
        return (value) => {
            if(!t.check(value, this)) throw TypeError("value: '" + inspect(value, false, null, false) + "' is " + t.throw(value, this))
        }
    },
    parseType(str, name, ...paramNames) {
        if(this.cache[str]) return this.cache[str];
        let t 
        if(this.types[str]) {
            t = this.types[str];
        } else {
            t = parseType(str)
        }
        const ret = this.cache[str] = {
            params: paramNames,
            check: (v) => t.check(v, p),
            throw: (v) => t.throw(v, p)
        }
        const p = this
        if(name) {
            this.types[name] = ret
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