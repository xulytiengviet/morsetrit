/* MorseTrit - deterministic Base27 <-> ternary protocol. MIT */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MorseTritCodec = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ALPHABET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const SUPPORTED = /^[A-Z ]*$/;
  const TRITS = /^[012]+$/;
  function normalizeVietnamese(value) {
    return String(value == null ? '' : value).normalize('NFC').replace(/\s+/gu, ' ').trim();
  }
  function encodeAscii(ascii) {
    if (typeof ascii !== 'string' || !SUPPORTED.test(ascii) || !ascii.length) {
      throw new Error('Base27 chỉ chấp nhận A–Z và SPACE; không tự động xóa ký tự.');
    }
    const symbols = Array.from(ascii, char => {
      const value = ALPHABET.indexOf(char);
      const triplet = [Math.floor(value / 9), Math.floor(value % 9 / 3), value % 3];
      return { char, value, triplet, ternary: triplet.join('') };
    });
    return {
      ascii,
      symbols,
      values: symbols.map(s => s.value),
      trits: symbols.flatMap(s => s.triplet),
      ternary: symbols.map(s => s.ternary).join(' '),
      length: symbols.length
    };
  }
  function encodeVietnamese(text, converter) {
    if (!converter || typeof converter.convert !== 'function') {
      throw new Error('Chưa tải được CVNSS4.0 audit-safe converter.');
    }
    const source = normalizeVietnamese(text);
    if (!source) throw new Error('Hãy nhập một câu tiếng Việt trước khi mã hóa.');
    const converted = converter.convert(source, 'cqn').cvss;
    const ascii = converted.toUpperCase();
    const invalid = Array.from(new Set([...ascii].filter(ch => !ALPHABET.includes(ch))));
    if (invalid.length) {
      throw new Error('Có ký tự ngoài Base27: ' + invalid.map(ch => JSON.stringify(ch)).join(', ') +
        '. Hãy bỏ dấu câu/ký hiệu hoặc mở rộng giao thức; hệ thống không âm thầm xóa dữ liệu.');
    }
    return { source, cvnss: converted, ...encodeAscii(ascii) };
  }
  function decodeTrits(stream) {
    // Allow readable whitespace and character separators only; no silent digit deletion.
    const compact = String(stream == null ? '' : stream).replace(/[\s|]+/gu, '');
    if (!compact || !TRITS.test(compact)) {
      throw new Error('Luồng chỉ được chứa các trít 0, 1, 2 (cho phép khoảng trắng và dấu |).');
    }
    if (compact.length % 3 !== 0) {
      throw new Error('Độ dài phải chia hết cho 3 để khôi phục ranh giới ký tự Base27.');
    }
    const values = [];
    for (let i = 0; i < compact.length; i += 3) {
      values.push(Number(compact[i]) * 9 + Number(compact[i + 1]) * 3 + Number(compact[i + 2]));
    }
    return {
      compact,
      values,
      ascii: values.map(value => ALPHABET[value]).join(''),
      characterCount: values.length,
      triplets: compact.match(/.{3}/g)
    };
  }
  function decodeVietnamese(stream, converter) {
    if (!converter || typeof converter.convert !== 'function') {
      throw new Error('Chưa tải được CVNSS4.0 audit-safe converter.');
    }
    const payload = decodeTrits(stream);
    return {
      ...payload,
      vietnamese: converter.convert(payload.ascii.toLowerCase(), 'cvss').cqn
    };
  }
  function compareVietnamese(original, restored) {
    const canonical = s => normalizeVietnamese(s).toLocaleLowerCase('vi');
    return {
      equalIgnoringCase: canonical(original) === canonical(restored),
      exact: normalizeVietnamese(original) === restored,
      sourceNormalized: canonical(original),
      restoredNormalized: canonical(restored)
    };
  }
  function flipTrit(stream, position = 0) {
    const decoded = decodeTrits(stream);
    const arr = decoded.compact.split('');
    const i = Math.min(Math.max(0, Math.trunc(position)), arr.length - 1);
    arr[i] = String((Number(arr[i]) + 1) % 3);
    return arr.join('').match(/.{3}/g).join(' ');
  }
  return Object.freeze({
    ALPHABET, normalizeVietnamese, encodeAscii, encodeVietnamese,
    decodeTrits, decodeVietnamese, compareVietnamese, flipTrit
  });
});