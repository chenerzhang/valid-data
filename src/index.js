const class2type = {
        '[object HTMLDocument]': 'Document',
        '[object HTMLCollection]': 'NodeList',
        '[object StaticNodeList]': 'NodeList',
        '[object IXMLDOMNodeList]': 'NodeList',
        '[object DOMWindow]': 'Window',
        '[object global]': 'Window',
        'null': 'Null',
        'NaN': 'NaN',
        'undefined': 'Undefined'
    },
    win = window,
    emptyFn = function() {};

'Boolean,Number,String,Function,Array,Date,RegExp,Symbol,Window,Document,Arguments,NodeList,Null,Undefined'
.replace(/\w+/ig, (value) => class2type[`[object ${value}]`] = value);

function is(x, y) {
    // SameValue algorithm
    if (x === y) {
        // Steps 1-5, 7-10
        // Steps 6.b-6.e: +0 != -0
        return x !== 0 || 1 / x === 1 / y;
    } else {
        // Step 6.a: NaN == NaN
        return x !== x && y !== y;
    }
}

let getType = (obj, match) => {
    let rs = class2type[
            (obj === null || obj !== obj) ?
                obj :
                Object.prototype.toString.call(obj)
            ] || (obj && obj.nodeName) || '#';

    if (obj === undefined) {
        rs = 'Undefined';
    } else if (rs.charAt(0) === '#') {
        if (obj == obj.document && obj.document != obj) {
            rs = 'Window';
        } else if (obj.nodeType === 9) {
            rs = 'Document';
        } else if (obj.callee) {
            rs = 'Arguments';
        } else if (isFinite(obj.length) && obj.item) {
            rs = 'NodeList';
        } else {
            rs = Object.prototype.toString.call(obj).slice(8, -1);
        }
    }
    if (match) {
        return match === rs;
    }
    return rs;
};

function propTypeError(errorFn = emptyFn, propCheck, tagName, propsFullName, message) {
    errorFn(propCheck, tagName, propsFullName);
    console.error(message);
}

/**
 * 循环遍历检查对象的值是否合法
 * 
 * @param {Object} checkObj 将要检查的对象
 * @param {Object} checkTypeObj 检查规则的对象
 * @param {string} [tagName='<<anonymous>>'] 标签名，主要用来区分是哪个地方调用的
 * @param {string} [propsFullName=''] 属性前缀名
 * @param {func} [errorFn=emptyFn] GG的时候调用的函数
 * @returns 
 */
function checkType(checkObj, checkTypeObj, tagName = '<<anonymous>>', propsFullName = '', errorFn = emptyFn) {
    if (!getType(checkObj, 'Object') || !getType(checkTypeObj, 'Object')) {
        return propTypeError(`In ${tagName}'s porperty ${propsFullName}, checkTypeObj is not Object.`);
    }

    // 需要验证的key
    let keys = Object.keys(checkTypeObj).concat(Object.getOwnPropertySymbols(checkTypeObj));
    keys.forEach(function(prop) {
        judge(prop, checkObj, checkTypeObj, tagName, propsFullName, errorFn);
    });
}

/**
 * 检查该值是否合法
 * 
 * @param {string|number} prop 键名
 * @param {Object|Array} checkObj 包含该键的对象或者数组 
 * @param {Object} checkTypeObj 规则对象
 * @param {string} tagName 标签名
 * @param {string} propsFullName 属性前缀名
 * @param {func} errorFn GG的时候调用的函数
 * @returns 
 */
function judge(prop, checkObj, checkTypeObj, tagName, propsFullName, errorFn) {
    // 搞 prop.toString 主要是Symbol无法在模板字符串里取值，要人为toString取值
    let checkTypeObjFlag = getType(checkTypeObj.type, 'String'),
        propToStr = checkTypeObjFlag ? 
                    '' : getType(prop) === 'Symbol' ?
                    prop.toString() :
                    prop,
        localPropsFullName = [propsFullName, propsFullName && propToStr ? '.' : '', propToStr].join(''),
        propVal = checkObj[prop],
        propCheck = checkTypeObjFlag ? checkTypeObj : checkTypeObj[prop],
        propValType,
        msg;

    msg = validateCheckType(propCheck, tagName, propsFullName);
    if (msg) {
        return propTypeError(errorFn, propCheck, tagName, propsFullName, msg);
    }

    // 不存在则赋默认值
    if (propVal === undefined) {
        propVal = checkObj[prop] = propCheck.default;
    }
    propValType = getType(propVal);

    // 验证是否为必须
    if (propCheck.isRequired) {
        if (propVal == null) {
            if (propVal === null) {
                return propTypeError(errorFn, propCheck, tagName, propsFullName, `In ${tagName}'s porperty ${localPropsFullName}, it is marked as required, but its value is 'null'.`);
            }
            return propTypeError(errorFn, propCheck, tagName, propsFullName, `In ${tagName}'s porperty ${localPropsFullName}, it is marked as required, but its value is 'undefined'.`);
        }
    }

    // 验证类型，值存在且类型不为任何类型
    if (propVal && propCheck.type !== 'Any' && propValType !== propCheck.type) {
        return propTypeError(errorFn, propCheck, tagName, propsFullName, `In ${tagName}'s porperty ${localPropsFullName}, its type is ${propValType}, but it should be ${propCheck.type}.`);
    }

    // 看子属性是否需要验证
    if (propVal && getType(propCheck.children, 'Object')) {
        if (propValType === 'Array') {
            if (!getType(propCheck.children.type, 'String')) {
                propVal.forEach(function(item, index) {
                    checkType(item, propCheck.children, tagName, `${localPropsFullName}[${index}]`, errorFn);
                });
            } else {
                propVal.forEach(function(val, index) {
                    judge(index, propVal, propCheck.children, tagName, `${localPropsFullName}[${index}]`, errorFn);
                });
            }
        } else {
            checkType(propVal, propCheck.children, tagName, localPropsFullName, errorFn);
        }
    }
}

function validateCheckType(checkTypeObj, tagName, propsFullName) {
    if (!checkTypeObj.type) {
        return `In ${tagName}'s porperty ${propsFullName}, it must has 'type' property.`;
    }
}

function PrimitiveTypeChecker(type) {
    this.type = type;
}
PrimitiveTypeChecker.prototype = {
    setDefault: function(val) {
        this.default = val;

        return this;
    },
    setIsRequired: function() {
        this.isRequired = true;

        return this;
    }
};

function createPrimitiveTypeChecker(type) {
    if (type == null) {
        return propTypeError(undefined, undefined, undefined, undefined, undefined, 'type is Undefined or Null.');
    }
    return function() {
        return new PrimitiveTypeChecker(type);
    };
}

var PropTypes = {
    array: createPrimitiveTypeChecker('Array'),
    bool: createPrimitiveTypeChecker('Boolean'),
    func: createPrimitiveTypeChecker('Function'),
    number: createPrimitiveTypeChecker('Number'),
    object: createPrimitiveTypeChecker('Object'),
    string: createPrimitiveTypeChecker('String'),
    symbol: createPrimitiveTypeChecker('Symbol')
};

window.checkType = checkType;
window.PropTypes = PropTypes;