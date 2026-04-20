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
            /**
             * 
             * @param {any} v 
             * @returns 
             */
            check: (v) => t.check(v, p),
            /**
             * 
             * @param {any} v 
             * @param {string} name 
             */
            throw: (v, name="value") => {
                if(!t.check(v, this)) throw TypeError(`${name}: '${inspect(v, false, null, false)}' has the following problems: ${t.throw(v, p)?.trimStart()}`)
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
    },
    //@ts-ignore
    wrapFunction(params, func) {
        const overriden = params.map(v => this.throw(typeof v == 'string'?v:v[0]));
        /**
         * @param {Parameters<typeof func>} args
         */
        return function verifyArgs(...args) {
            try {
                overriden.forEach((v, i) => v(args[i], params[i]?.[1] ?? "value"))
            } catch(e) {
                throw e;
            }
            return func(...args);
        } 
    }
})


const defaultenv = createEnvironemt()
addDefaults(defaultenv)

module.exports = {
    defaultenv,
    createEnvironemt
}