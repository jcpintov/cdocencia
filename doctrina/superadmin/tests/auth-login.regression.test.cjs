const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'auth-login.js'), 'utf8');

test('login form remains mounted within the modal dialog', () => {
  assert.match(source, /dialog\.append\(close,mark,eyebrow,title,desc,form,foot\)/);
  assert.match(source, /modal\.append\(dialog\)/);
  assert.doesNotMatch(source, /document\.body\.append\(trigger,form\)/);
  assert.doesNotMatch(source, /form\.append\(label,send,close,status\)/);
});

test('OTP sign-in must not create unauthorized users', () => {
  assert.match(source, /shouldCreateUser:\s*false/);
});
