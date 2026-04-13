//@ts-check
const { parseType } = require('./parsing/parser')
/**
 * @import {typecheck, typeEnvironment} from "./parsing/parser" 
 */
/**
 * @type {{[x: string]: typecheck}}
 */
const defaultTypes =  {
    "string": {
        check: (v) => typeof v === 'string'
    },
    "number": {
        check: (v) => typeof v === 'number'
    },
    "object": {
        check: (v) => typeof v === 'object' && v != null
    },
    "boolean": {
        check: (v) => typeof v === 'boolean'
    },
    "any": {
        check: (v) => true
    },
    "Less": {
        check: (v, env) => typeof v === 'number' && v < (env.types.V?.raw ?? Number.NaN),
        params: ['V'],
    },
    "Greater": {
        check: (v, env) => typeof v === 'number' && v > (env.types.V?.raw ?? Number.NaN),
        params: ['V']
    },
    "Shorter": {
        check: (v, env) => typeof v === 'string' && v.length < (env.types.V?.raw ?? Number.NaN),
        params: ['V']
    },
    "Longer": {
        check: (v, env) => typeof v === 'string' && v.length > (env.types.V?.raw ?? Number.NaN),
        params: ['V'],
    }
}

/**
 * 
 * @param {{[x: string]: typecheck}} types 
 * @returns {typeEnvironment}
 */
const createEnvironemt = (types = defaultTypes) => ({
    types,
    infertypes: {},
    check(str, value) {
        return parseType(str).check(value, this)
    },
    parseType(str, name, ...paramNames) {
        const t = parseType(str)
        if(name) {
            this.types[name] = {
                params: paramNames,
                check: t.check,
                raw: t.raw
            }
        }
        return (value) => {
            this.infertypes = {}
            return t.check(value, this)
        }
    }
})

const defaultenv = createEnvironemt()
defaultenv.parseType('T[]', 'Array', 'T')

module.exports = {
    defaultenv,
    createEnvironemt
}