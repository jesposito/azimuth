/**
 * Helper to load IIFE modules from source files into a test context.
 * The extension uses `const Foo = (() => { ... })();` pattern.
 * `const` declarations don't become context properties in vm.runInContext,
 * so we replace the leading `const` with `var` to make them accessible.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadModule(relativePath) {
  const filePath = path.resolve(__dirname, '..', relativePath);
  let code = fs.readFileSync(filePath, 'utf-8');

  // Replace leading `const` declarations with `var` so they attach to the context
  code = code.replace(/^const\s+/gm, 'var ');

  const context = vm.createContext({
    Math, console, Date, parseFloat, parseInt, isNaN, isFinite,
    NaN, Infinity, undefined,
  });

  vm.runInContext(code, context);
  return context;
}

module.exports = { loadModule };
