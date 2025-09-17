import { describe, it, expect } from 'vitest';
import { isFnKey } from '../../../src/lib/client/ipcReducer';

// Test objects with various property types
interface TestObject {
  method1: () => void;
  method2: (arg: string) => string;
  asyncMethod: () => Promise<void>;
  stringProp: string;
  numberProp: number;
  booleanProp: boolean;
  objectProp: { key: string };
  arrayProp: string[];
  nullProp: null;
  undefinedProp: undefined;
}

describe('ipcReducer', () => {
  describe('isFnKey', () => {
    let testObj: TestObject;

    beforeEach(() => {
      testObj = {
        method1: () => {},
        method2: (arg: string) => arg,
        asyncMethod: async () => {},
        stringProp: 'test',
        numberProp: 42,
        booleanProp: true,
        objectProp: { key: 'value' },
        arrayProp: ['a', 'b', 'c'],
        nullProp: null,
        undefinedProp: undefined,
      };
    });

    it('should return true for function properties', () => {
      expect(isFnKey('method1', testObj)).toBe(true);
      expect(isFnKey('method2', testObj)).toBe(true);
      expect(isFnKey('asyncMethod', testObj)).toBe(true);
    });

    it('should return false for non-function properties', () => {
      expect(isFnKey('stringProp', testObj)).toBe(false);
      expect(isFnKey('numberProp', testObj)).toBe(false);
      expect(isFnKey('booleanProp', testObj)).toBe(false);
      expect(isFnKey('objectProp', testObj)).toBe(false);
      expect(isFnKey('arrayProp', testObj)).toBe(false);
      expect(isFnKey('nullProp', testObj)).toBe(false);
      expect(isFnKey('undefinedProp', testObj)).toBe(false);
    });

    it('should return false for non-existent properties', () => {
      expect(isFnKey('nonExistent', testObj)).toBe(false);
      expect(isFnKey('anotherMissing', testObj)).toBe(false);
    });

    it('should handle symbol keys', () => {
      const symbolKey = Symbol('symbolMethod');
      const objWithSymbol = {
        ...testObj,
        [symbolKey]: () => {},
      };

      expect(isFnKey(symbolKey, objWithSymbol)).toBe(true);
    });

    it('should handle symbol keys that are not functions', () => {
      const symbolKey = Symbol('symbolProp');
      const objWithSymbol = {
        ...testObj,
        [symbolKey]: 'not a function',
      };

      expect(isFnKey(symbolKey, objWithSymbol)).toBe(false);
    });

    it('should handle numeric keys', () => {
      const objWithNumericKeys = {
        0: () => {},
        1: 'not a function',
        2: 42,
      };

      expect(isFnKey(0, objWithNumericKeys)).toBe(true);
      expect(isFnKey(1, objWithNumericKeys)).toBe(false);
      expect(isFnKey(2, objWithNumericKeys)).toBe(false);
      expect(isFnKey(3, objWithNumericKeys)).toBe(false);
    });

    it('should not be affected by prototype properties', () => {
      const proto = {
        protoMethod: () => {},
      };
      const obj = Object.create(proto);
      obj.ownMethod = () => {};
      obj.ownProp = 'value';

      expect(isFnKey('ownMethod', obj)).toBe(true);
      expect(isFnKey('ownProp', obj)).toBe(false);
      expect(isFnKey('protoMethod', obj)).toBe(false); // Should be false as it's on prototype
    });

    it('should handle arrow functions', () => {
      const obj = {
        arrowFn: () => 'arrow',
        asyncArrowFn: async () => 'async arrow',
      };

      expect(isFnKey('arrowFn', obj)).toBe(true);
      expect(isFnKey('asyncArrowFn', obj)).toBe(true);
    });

    it('should handle regular functions', () => {
      const obj = {
        regularFn: function () {
          return 'regular';
        },
        namedFn: function namedFunction() {
          return 'named';
        },
      };

      expect(isFnKey('regularFn', obj)).toBe(true);
      expect(isFnKey('namedFn', obj)).toBe(true);
    });

    it('should handle class methods', () => {
      class TestClass {
        method1() {
          return 'method1';
        }
        prop1 = 'value';
        arrowMethod = () => 'arrow';
      }

      const instance = new TestClass();

      // Note: class methods are on the prototype, not own properties
      expect(isFnKey('method1', instance)).toBe(false); // prototype method
      expect(isFnKey('prop1', instance)).toBe(false);
      expect(isFnKey('arrowMethod', instance)).toBe(true); // own property
    });

    it('should handle getters and setters', () => {
      const obj = {
        _value: 0,
        get value() {
          return this._value;
        },
        set value(v) {
          this._value = v;
        },
      };

      // Getters and setters are not functions when accessed
      expect(isFnKey('value', obj)).toBe(false);
      expect(isFnKey('_value', obj)).toBe(false);
    });

    it('should handle objects with null prototype', () => {
      const obj = Object.create(null);
      obj.method = () => {};
      obj.prop = 'value';

      expect(isFnKey('method', obj)).toBe(true);
      expect(isFnKey('prop', obj)).toBe(false);
    });

    it('should handle empty objects', () => {
      const emptyObj = {};

      expect(isFnKey('anyKey', emptyObj)).toBe(false);
    });

    it('should handle objects with constructor property', () => {
      const obj = {
        constructor: () => {},
      };

      expect(isFnKey('constructor', obj)).toBe(true);
    });

    it('should handle objects with toString and valueOf', () => {
      const obj = {
        toString: () => 'custom toString',
        valueOf: () => 42,
      };

      expect(isFnKey('toString', obj)).toBe(true);
      expect(isFnKey('valueOf', obj)).toBe(true);
    });

    it('should handle edge case with hasOwnProperty override', () => {
      const obj = {
        hasOwnProperty: () => false,
        method: () => {},
      };

      // Should still work correctly using Object.prototype.hasOwnProperty.call
      expect(isFnKey('method', obj)).toBe(true);
      expect(isFnKey('hasOwnProperty', obj)).toBe(true);
    });

    it('should handle frozen objects', () => {
      const obj = Object.freeze({
        method: () => {},
        prop: 'value',
      });

      expect(isFnKey('method', obj)).toBe(true);
      expect(isFnKey('prop', obj)).toBe(false);
    });

    it('should handle sealed objects', () => {
      const obj = Object.seal({
        method: () => {},
        prop: 'value',
      });

      expect(isFnKey('method', obj)).toBe(true);
      expect(isFnKey('prop', obj)).toBe(false);
    });

    it('should handle special property names', () => {
      const obj = {
        '': () => {},
        'space key': () => {},
        '123': () => {},
        '!@#$%': () => {},
      };

      expect(isFnKey('', obj)).toBe(true);
      expect(isFnKey('space key', obj)).toBe(true);
      expect(isFnKey('123', obj)).toBe(true);
      expect(isFnKey('!@#$%', obj)).toBe(true);
    });
  });
});
