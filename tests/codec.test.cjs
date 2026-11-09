'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const codec = require('../codec.js');
const converter = require('../cvnss-converter.js');

test('27 mã Base27 tương ứng song ánh với 3 trít', () => {
  assert.equal(codec.ALPHABET.length, 27);
  const seen = new Set();
  for (let value = 0; value < 27; value++) {
    const ch = codec.ALPHABET[value];
    const result = codec.encodeAscii(ch);
    assert.equal(result.values[0], value);
    assert.equal(result.trits.length, 3);
    assert.equal(codec.decodeTrits(result.ternary).ascii, ch);
    seen.add(result.ternary);
  }
  assert.equal(seen.size, 27);
  assert.equal(codec.encodeAscii(' ').ternary, '000');
  assert.equal(codec.encodeAscii('A').ternary, '001');
  assert.equal(codec.encodeAscii('Z').ternary, '222');
});

test('Các câu mẫu tiếng Việt round-trip dạng chuẩn không phân biệt hoa thường', () => {
  const samples = [
    'Tôi ổn',
    'Cần nước',
    'Có người bị thương',
    'Gọi cứu hộ',
    'Xin chào Việt Nam',
    'sẽ hề mồ mộ võ'
  ];
  for (const sample of samples) {
    const tx = codec.encodeVietnamese(sample, converter);
    const rx = codec.decodeVietnamese(tx.ternary, converter);
    assert.equal(tx.ascii, rx.ascii, sample);
    assert.equal(tx.trits.length, 3 * tx.ascii.length, sample);
    assert.equal(codec.compareVietnamese(sample, rx.vietnamese).equalIgnoringCase, true, sample);
  }
});

test('Chuẩn hóa NFC và khoảng trắng của đầu vào', () => {
  const t = codec.encodeVietnamese('  Tôi \n  ổn  ', converter);
  assert.equal(t.source, 'Tôi ổn');
  assert.equal(t.ascii, 'TOIY ONQ');
});

test('Không âm thầm xóa dấu câu, chữ số và emoji', () => {
  for (const s of ['Tôi ổn!', 'A1', '😀', 'Gọi cứu hộ?']) {
    assert.throws(() => codec.encodeVietnamese(s, converter), /ngoài Base27/);
  }
  assert.throws(() => codec.encodeAscii('Hello'), /Base27/);
});

test('Bộ giải mã kiểm soát trít và ranh giới nhóm 3', () => {
  for (const invalid of ['', '12', '1234', '022x22', '01-002']) {
    assert.throws(() => codec.decodeTrits(invalid));
  }
  assert.equal(codec.decodeTrits('001 | 222').ascii, 'AZ');
});

test('Một trít lỗi thay đổi payload và có thể phát hiện qua đối chiếu', () => {
  const tx = codec.encodeVietnamese('Tôi ổn', converter);
  const damaged = codec.flipTrit(tx.ternary, 3);
  const rx = codec.decodeVietnamese(damaged, converter);
  assert.notEqual(rx.ascii, tx.ascii);
});

test('Audit converter: 56 nhóm nhập nhằng và không ghi đè im lặng', () => {
  const audit = converter.audit();
  assert.equal(audit.baseRows, 758);
  assert.equal(audit.totalPatchEntries, 336);
  assert.equal(audit.ambiguityGroups, 56);
  assert.equal(audit.criticalCollisionGroups, 5);
  assert.equal(audit.silentReverseOverwrite, 0);
  assert.equal(converter.selfTest().ok, true);
});