/* MorseTrit browser lab — no external dependencies */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const codec = window.MorseTritCodec;
  const converter = window.CVNSSConverter;
  const DRIVER = {
    rgb: { name:'RGB', note:'RGB: 0 = đỏ, 1 = lục, 2 = lam. Trình diễn chuyển trạng thái màu, chưa có cảm biến nhận.', desc:['RED / #F65F76','GREEN / #50DB97','BLUE / #59B9FB'] },
    traffic: { name:'TRAFFIC LIGHT', note:'Đèn giao thông: 0 = đỏ, 1 = vàng, 2 = xanh. Không được kết nối tới hệ đèn giao thông thật.', desc:['ĐỎ / DỪNG','VÀNG / CHỜ','XANH / ĐI'] },
    brightness: { name:'LUMINANCE', note:'Độ sáng: 0 = thấp, 1 = trung bình, 2 = cao. Thiết bị thực cần hiệu chuẩn ngưỡng và bù ánh sáng nền.', desc:['ĐỘ SÁNG THẤP','ĐỘ SÁNG TRUNG BÌNH','ĐỘ SÁNG CAO'] },
    morse: { name:'TERNARY PULSE', note:'Morse tam phân tự định nghĩa: 0 = xung 150ms, 1 = 300ms, 2 = 500ms. Không tương thích Morse quốc tế.', desc:['XUNG NGẮN / 150ms','XUNG VỪA / 300ms','XUNG DÀI / 500ms'] },
    fsk: { name:'3-FSK AUDIO', note:'Ternary FSK phát 600 / 1000 / 1400 Hz. Đây là phát âm trình diễn; không có bộ thu microphone, giải điều chế hoặc BER thực nghiệm.', desc:['TONE / 600Hz','TONE / 1000Hz','TONE / 1400Hz'] },
    vibration: { name:'VIBRATION', note:'Rung: 0 = 100ms, 1 = 200ms, 2 = 400ms. Chỉ hoạt động trên trình duyệt/thiết bị có hỗ trợ Vibration API.', desc:['RUNG / 100ms','RUNG / 200ms','RUNG / 400ms'] }
  };
  let current = null;
  let driver = 'rgb';
  let runToken = 0;
  let playing = false;
  let audioCtx = null;
  let oscillator = null;
  let gainNode = null;
  const safeText = (el, txt) => { el.textContent = String(txt); };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  function showError(id, message) {
    const el = $(id);
    el.hidden = !message;
    el.textContent = message || '';
  }
  function renderAlphabet() {
    const grid = $('alphabetGrid');
    grid.replaceChildren();
    for (let value = 0; value < 27; value++) {
      const box = document.createElement('div');
      box.className = 'alphabet-item';
      const char = document.createElement('strong');
      char.textContent = value === 0 ? '␣' : codec.ALPHABET[value];
      const n = document.createElement('span');
      n.className = 'base-index';
      n.textContent = 'BASE ' + value;
      const trits = document.createElement('code');
      trits.textContent = [Math.floor(value/9), Math.floor(value%9/3), value%3].join('');
      box.append(char,n,trits);
      grid.appendChild(box);
    }
  }
  function updateAudit() {
    if (!converter || !codec) {
      $('auditBadge').className = 'health-dot bad';
      safeText($('auditText'),'Không tải được converter hoặc codec. Hãy xem console/network.');
      return;
    }
    const audit = converter.audit();
    const test = converter.selfTest();
    const ok = test.ok && audit.ambiguityGroups === 56 &&
      audit.criticalCollisionGroups === 5 && audit.silentReverseOverwrite === 0;
    $('auditBadge').className = 'health-dot ' + (ok ? 'ok' : 'bad');
    safeText($('auditText'), 'CVNSS4.0 ' + converter.VERSION + ' · ' + audit.baseRows +
      ' quy tắc gốc · ' + audit.totalPatchEntries + ' bản vá · ' +
      audit.ambiguityGroups + ' nhóm nhập nhằng · selfTest ' + test.tests + ' ca: ' +
      (test.ok ? 'PASS' : 'FAIL'));
    safeText($('codecVersion'), converter.VERSION);
  }
  function updateInputCounter() {
    safeText($('inputCounter'), Array.from($('sourceText').value).length + ' / 200 ký tự');
  }
  function renderStages(data) {
    safeText($('metricChars'), data.length);
    safeText($('metricTrits'), data.trits.length);
    safeText($('stageCvnss'), data.cvnss);
    safeText($('stageAscii'), data.ascii.replace(/ /g, '␣'));
    safeText($('stageValues'), data.values.join(' · '));
    const out = $('stageTriplets');
    out.replaceChildren();
    data.symbols.forEach(symbol => {
      const group = document.createElement('span');
      group.className = 'trit-group';
      group.title = (symbol.char === ' ' ? 'SPACE' : symbol.char) + ' = ' + symbol.value;
      symbol.triplet.forEach(t => {
        const el = document.createElement('i');
        el.className = 't' + t;
        el.textContent = t;
        group.appendChild(el);
      });
      out.appendChild(group);
    });
  }
  function renderRail() {
    const rail = $('tritRail');
    rail.replaceChildren();
    if (!current) return;
    const limit = Math.min(current.trits.length, 180);
    for (let i=0; i<limit; i++) {
      const item = document.createElement('span');
      item.className = 'rail-trit t' + current.trits[i];
      item.textContent = current.trits[i];
      item.dataset.index = i;
      rail.appendChild(item);
    }
    safeText($('railCaption'), 'TX: ' + current.trits.length + ' trít · ' +
      (current.trits.length>limit ? 'hiển thị ' + limit + ' trít đầu · ' : '') +
      'mỗi 3 trít tương ứng 1 ký tự.');
  }
  function placeVisual(t, live) {
    const d = DRIVER[driver];
    safeText($('signalMode'), d.name);
    safeText($('activeTrit'), t === null ? '—' : t);
    safeText($('signalDetail'), t === null ? 'Chọn phát để chạy mô phỏng' : d.desc[t]);
    const art = $('signalArt');
    art.replaceChildren();
    const state = t === null ? 1 : t;
    let child;
    switch (driver) {
      case 'rgb': {
        child = document.createElement('div');
        child.className = 'signal-orb c' + state;
        break;
      }
      case 'traffic': {
        child = document.createElement('div');
        child.className = 'traffic-assembly';
        ['red','yellow','green'].forEach((color, index) => {
          const bulb = document.createElement('div');
          bulb.className = 'traffic-light ' + color + ((index === state) ? ' on' : '');
          child.appendChild(bulb);
        });
        break;
      }
      case 'brightness': {
        child = document.createElement('div');
        child.className = 'lamp level' + state;
        break;
      }
      case 'morse': {
        child = document.createElement('div');
        child.className = 'morse-pulse level' + state;
        break;
      }
      case 'fsk': {
        child = document.createElement('div');
        child.className = 'fsk-bars';
        const frequencies = [600,1000,1400];
        for (let i=0;i<13;i++) {
          const bar = document.createElement('span');
          const wave = Math.abs(Math.sin(i * frequencies[state] / 830));
          bar.style.height = (20+100*wave) + 'px';
          child.appendChild(bar);
        }
        break;
      }
      case 'vibration': {
        child = document.createElement('div');
        child.className = 'phone' + (live ? ' shake' : '');
        const span = document.createElement('span');
        span.textContent = '≋';
        child.appendChild(span);
        break;
      }
    }
    art.appendChild(child);
  }
  function markProgress(index, total, status) {
    safeText($('playbackPosition'), index + ' / ' + total + ' trít');
    safeText($('playbackState'), status);
    $('progressBar').style.width = total ? (100*index/total).toFixed(2)+'%' : '0%';
    document.querySelectorAll('.rail-trit.selected').forEach(el => el.classList.remove('selected'));
    if (index > 0) {
      const el = $('tritRail').querySelector('[data-index="' + (index-1) + '"]');
      if (el) el.classList.add('selected');
    }
  }
  function stopAudio() {
    if (oscillator) {
      try { oscillator.stop(); } catch (_) {}
      try { oscillator.disconnect(); } catch (_) {}
      oscillator = null;
    }
    if (gainNode) {
      try { gainNode.disconnect(); } catch (_) {}
      gainNode = null;
    }
  }
  function stopPlayback() {
    runToken++;
    playing = false;
    stopAudio();
    if (navigator.vibrate) navigator.vibrate(0);
    $('playBtn').disabled = false;
    safeText($('playbackState'), 'ĐÃ DỪNG');
    placeVisual(null, false);
  }
  function tone(freq, length) {
    if (!audioCtx) return;
    stopAudio();
    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = freq;
    gainNode.gain.value = .0001;
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    gainNode.gain.setValueAtTime(.0001,now);
    gainNode.gain.linearRampToValueAtTime(.14,now+.015);
    gainNode.gain.setValueAtTime(.14,now+Math.max(.025,length/1000-.03));
    gainNode.gain.linearRampToValueAtTime(.0001,now+length/1000);
    oscillator.start(now);
    oscillator.stop(now+length/1000+.005);
  }
  async function play() {
    if (!current) {
      encode();
      if (!current) return;
    }
    if (playing) return;
    const myRun = ++runToken;
    playing = true;
    $('playBtn').disabled = true;
    const factor = 100 / Number($('speedSlider').value);
    if (driver === 'fsk' && (window.AudioContext || window.webkitAudioContext)) {
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        await audioCtx.resume();
      } catch (error) {
        safeText($('driverNote'),DRIVER.fsk.note + ' Không mở được âm thanh: '+error.message);
      }
    }
    if (myRun !== runToken) return;
    const total = current.trits.length;
    safeText($('playbackState'), 'ĐANG PHÁT');
    for (let i=0;i<total;i++) {
      if (myRun !== runToken) return;
      const trit = current.trits[i];
      placeVisual(trit, true);
      markProgress(i+1,total,'ĐANG PHÁT');
      let duration;
      if (driver === 'morse') duration = [150,300,500][trit]*factor;
      else if (driver === 'vibration') duration = [100,200,400][trit]*factor;
      else duration = 220*factor;
      if (driver === 'fsk' && audioCtx) tone([600,1000,1400][trit],duration);
      if (driver === 'vibration' && navigator.vibrate) navigator.vibrate(Math.round(duration));
      await sleep(duration);
      if (myRun !== runToken) return;
      stopAudio();
      placeVisual(null,false);
      await sleep(Math.max(55,75*factor));
    }
    if (myRun !== runToken) return;
    playing=false;
    $('playBtn').disabled=false;
    safeText($('playbackState'),'HOÀN TẤT');
    placeVisual(null,false);
  }
  function updateDriver(name) {
    if (!DRIVER[name]) return;
    stopPlayback();
    driver=name;
    document.querySelectorAll('[data-driver]').forEach(button=>{
      const selected = button.dataset.driver === name;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
    safeText($('driverNote'),DRIVER[driver].note);
    placeVisual(null,false);
  }
  function encode() {
    stopPlayback();
    showError('errorMessage','');
    showError('decodeError','');
    $('decodedBox').hidden=true;
    try {
      const encoded=codec.encodeVietnamese($('sourceText').value,converter);
      current=encoded;
      renderStages(encoded);
      renderRail();
      $('rxStream').value=encoded.ternary;
      markProgress(0,encoded.trits.length,'SẴN SÀNG');
      decode();
      return encoded;
    } catch (err) {
      current=null;
      $('rxStream').value='';
      $('tritRail').replaceChildren();
      $('decodedBox').hidden=true;
      safeText($('railCaption'),'Không có luồng hợp lệ.');
      safeText($('metricChars'),'—');
      safeText($('metricTrits'),'—');
      ['stageCvnss','stageAscii','stageValues','stageTriplets'].forEach(id=>{safeText($(id),'—');});
      markProgress(0,0,'CHƯA MÃ HÓA');
      showError('errorMessage',err.message);
      return null;
    }
  }
  function decode() {
    showError('decodeError','');
    try {
      const result=codec.decodeVietnamese($('rxStream').value,converter);
      $('decodedBox').hidden=false;
      safeText($('decodedAscii'),result.ascii.replace(/ /g,'␣'));
      safeText($('decodedVietnamese'),result.vietnamese);
      if (current) {
        const matched=codec.compareVietnamese(current.source,result.vietnamese);
        const payloadMatch = result.ascii === current.ascii;
        const good = payloadMatch && matched.equalIgnoringCase;
        $('roundtripBadge').className='roundtrip-badge'+(good?'':' warn');
        safeText($('roundtripBadge'),good?'PASS / chuẩn hóa':'KHÁC ĐẦU VÀO');
        safeText($('decodeCaveat'),good ?
          (matched.exact ? 'Trùng hoàn toàn văn bản chuẩn hóa. Luồng số giải mã chính xác.' :
          'Nội dung trùng khi bỏ phân biệt hoa/thường; Base27 A–Z không bảo toàn kiểu chữ gốc.') :
          (payloadMatch ? 'Luồng Base27 trùng, nhưng CVNSS4.0 có thể chọn một dạng chữ khác do nhập nhằng hoặc chuẩn hóa.' :
          'Luồng nhận đã thay đổi so với luồng phát; tín hiệu chưa có cơ chế kiểm tra/sửa lỗi.'));
      } else {
        $('roundtripBadge').className='roundtrip-badge';
        safeText($('roundtripBadge'),'ĐÃ GIẢI MÃ');
        safeText($('decodeCaveat'),'Không có bản phát gốc để đối chiếu.');
      }
      return result;
    } catch (err) {
      $('decodedBox').hidden=true;
      showError('decodeError',err.message);
      return null;
    }
  }
  function injectError() {
    const original=$('rxStream').value;
    try {
      const parsed=codec.decodeTrits(original);
      const position=Math.min(parsed.compact.length-1,Math.floor(parsed.compact.length/2));
      $('rxStream').value=codec.flipTrit(original,position);
      decode();
    } catch (err) {showError('decodeError',err.message);}
  }
  function restore() {
    if (!current) return;
    $('rxStream').value=current.ternary;
    decode();
  }
  function setup() {
    if (!converter || !codec) {
      showError('errorMessage','Thiếu tệp cvnss-converter.js hoặc codec.js. Mở Console/Network để kiểm tra.');
      return;
    }
    renderAlphabet();
    updateAudit();
    $('sourceText').addEventListener('input',updateInputCounter);
    $('encodeBtn').addEventListener('click',encode);
    $('resetBtn').addEventListener('click',()=>{
      $('sourceText').value='Tôi ổn';
      updateInputCounter();encode();
    });
    document.querySelectorAll('[data-sample]').forEach(button=>button.addEventListener('click',()=>{
      $('sourceText').value=button.dataset.sample;
      updateInputCounter();encode();
    }));
    document.querySelectorAll('[data-driver]').forEach(button=>button.addEventListener('click',()=>updateDriver(button.dataset.driver)));
    $('playBtn').addEventListener('click',play);
    $('stopBtn').addEventListener('click',stopPlayback);
    $('decodeBtn').addEventListener('click',decode);
    $('noiseBtn').addEventListener('click',injectError);
    $('restoreBtn').addEventListener('click',restore);
    $('speedSlider').addEventListener('input',()=>{
      safeText($('speedValue'),(Number($('speedSlider').value)/100).toFixed(2).replace(/0$/,'')+'×');
    });
    updateDriver('rgb');
    updateInputCounter();
    encode();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();