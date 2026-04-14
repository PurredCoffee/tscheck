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
    "null": {
        check: (v) => v === null
    },
    "undefined": {
        check: (v) => v === undefined
    },
    "true": {
        check: (v) => v === true
    },
    "false": {
        check: (v) => v === false
    },
    "any": {
        check: (v) => true
    },
    "Function": {
        check: (v) => typeof v === 'function'
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
        check: (v, env) => (typeof v === 'string' || Array.isArray(v)) && v.length < (env.types.V?.raw ?? Number.NaN),
        params: ['V']
    },
    "Longer": {
        check: (v, env) => (typeof v === 'string' || Array.isArray(v)) && v.length > (env.types.V?.raw ?? Number.NaN),
        params: ['V'],
    },
}

function addDefaults(defaultenv) {
    defaultenv.parseType('T[]', 'Array', 'T')
    defaultenv.parseType(`{
        byteLength: number,
        maxByteLength: number,
        detached: boolean,
        resizable: boolean,
        resize: Function,
        slice: Function,
        transfer: Function,
        transferToFixedLength: Function
    }`, 'ArrayBuffer')
    
/**
 * @typedef {} test
 */
/**
 * @type {test}
 */
let m = {
}
}

module.exports = {
    defaultTypes,
    addDefaults
}