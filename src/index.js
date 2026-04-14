//@ts-check
const { parseType } = require('./parsing/parser')
const { addDefaults, defaultTypes } = require('./default')
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
addDefaults(defaultenv)

module.exports = {
    defaultenv,
    createEnvironemt
}