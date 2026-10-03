(function () {
  'use strict';

  var KEY = 'tms_history_v1';
  
  var PRESETS = [
    { amount: 1500, recipient_name: 'DM Nature Adventures', transaction_type: 'Customer to Business' },
    { amount: 250, recipient_name: 'Demo Business', transaction_type: 'Payment' },
    { amount: 25000, recipient_name: 'Demo Company', transaction_type: 'Payment' }
  ];
  var STATUS = {
    'Payment': 'Payment completed',
    'Customer to Business': 'Payment to business completed',
    'Business to Customer': 'Payment to customer completed',
    'Send Money': 'Money sent',
    'Deposit': 'Deposit completed',
    'Withdrawal': 'Withdrawal completed'
  };
  var FIELDS = ['sender_name', 'sender_phone', 'amount', 'recipient_name', 'recipient_number',
    'transaction_type', 'date', 'time', 'reference', 'custom_message', 'balance'];

  var $ = function (id) { return document.getElementById(id); };
  var form = $('txForm');
  var currentId = null; // synthetic ID of the transaction currently shown

  /* ---------- helpers ---------- */
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function newId() {
    var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
    return 'DEMO-' + s;
  }

  function fmtAmount(v) {
    var n = parseFloat(v);
    if (!isFinite(n)) n = 0;
    return 'Ksh' + n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtDate(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1].slice(-2) : '--/--/--';
  }

  function fmtTime(v) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(v || '');
    if (!m) return '--:--';
    var hour = +m[1], minute = +m[2];
    if (hour > 23 || minute > 59) return '--:--';
    return (hour % 12 || 12) + ':' + String(minute).padStart(2, '0') + (hour < 12 ? ' AM' : ' PM');
  }

  function maskPhone(v) {
    var d = (v || '').replace(/[^\d+]/g, '');
    if (d.length < 7) return d || '';
    return d.slice(0, 4) + '***' + d.slice(-3);
  }

  function readForm() {
    var o = {};
    FIELDS.forEach(function (f) {
      var el = form.elements[f];
      o[f] = el ? el.value.trim() : '';
    });
    return o;
  }

  function writeForm(o) {
    FIELDS.forEach(function (f) {
      var el = form.elements[f];
      if (el && o[f] !== undefined) el.value = o[f];
    });
  }

  function setNow() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    form.elements.date.value = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    form.elements.time.value = p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ---------- model ---------- */
  function buildModel(o, id) {
    var rows = [
      ['Sender', (o.sender_name || 'Sender Name') + (o.sender_phone ? ' (' + maskPhone(o.sender_phone) + ')' : '')],
      ['Recipient', o.recipient_name || 'Recipient'],
      ['Account/Till', o.recipient_number || '-'],
      ['Type', o.transaction_type],
      ['Transaction ID', id || 'XXXXXX'],
      ['Date', fmtDate(o.date)],
      ['Time', fmtTime(o.time)],
      ['Reference', o.reference || '-']
    ];
    return {
      status: STATUS[o.transaction_type] || 'Transaction completed',
      amount: fmtAmount(o.amount),
      balance: fmtAmount(o.balance),
      business: o.recipient_name || 'Recipient',
      date: fmtDate(o.date),
      time: fmtTime(o.time),
      rows: rows,
      note: o.custom_message
    };
  }

  /* ---------- preview ---------- */
  function renderPreview(pop) {
    var m = buildModel(readForm(), currentId);
    $('pvStatus').textContent = m.status;
    $('pvAmount').textContent = m.amount;
    var list = $('pvList');
    list.textContent = '';
    m.rows.forEach(function (r) {
      var div = document.createElement('div');
      var dt = document.createElement('dt'); dt.textContent = r[0];
      var dd = document.createElement('dd'); dd.textContent = r[1];
      div.appendChild(dt); div.appendChild(dd); list.appendChild(div);
    });
    var note = $('pvNote');
    note.hidden = !m.note;
    note.textContent = m.note ? 'Note: ' + m.note : '';
    if (pop) {
      var n = $('notif');
      n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
    }
  }

  function messageText() {
    return messageLines(buildModel(readForm(), currentId)).map(function (line) { return line.text; }).join('\n');
  }

  function messageLines(m) {
    var lines = [
      
      { text: currentId || 'XXXXXX', kind: 'id' },
      { text: 'Confirmed.', kind: 'confirmed' },
      { text: m.amount, kind: 'amount' },
      { text: 'paid to', kind: 'body' },
      { text: m.business, kind: 'business' },
      { text: 'on ' + m.date + ' at ' + m.time, kind: 'body' },
      { text: 'Balance is ' + m.balance + '.', kind: 'body' },
      { text: 'Transaction', kind: 'section' }
    ];
    if (m.note) lines.push({ text: 'Note: ' + m.note, kind: 'note' });
    lines.push({ text: FOOTER, kind: 'footer' });
    return lines;
  }

  /* ---------- validation ---------- */
  function setErr(name, msg) {
    var el = form.elements[name], p = $('err_' + name);
    if (!p) return;
    p.textContent = msg || '';
    if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  }

  function validate() {
    var o = readForm(), first = null;
    var rules = [
      ['sender_name', !o.sender_name, 'Enter the sender name.'],
      ['amount', !(parseFloat(o.amount) > 0), 'Enter an amount greater than zero.'],
      ['recipient_name', !o.recipient_name, 'Enter the recipient or business name.'],
      ['date', !o.date, 'Choose a transaction date.'],
      ['time', !o.time, 'Choose a transaction time.']
    ];
    rules.forEach(function (r) {
      setErr(r[0], r[1] ? r[2] : '');
      if (r[1] && !first) first = r[0];
    });
    if (first) form.elements[first].focus();
    return !first;
  }

  /* ---------- history ---------- */
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function saveHistory(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { toast('Could not save history in this browser.'); }
  }

  function renderHistory() {
    var ul = $('historyList'), list = loadHistory();
    ul.textContent = '';
    if (!list.length) {
      var li = document.createElement('li');
      li.className = 'empty';
      li.style.border = '0';
      li.textContent = 'No demo transactions yet. Generate one to see it here.';
      ul.appendChild(li);
      return;
    }
    list.forEach(function (item) {
      var li = document.createElement('li');
      var meta = document.createElement('div');
      meta.className = 'meta';
      var s = document.createElement('strong');
      s.textContent = fmtAmount(item.data.amount) + ' \u2014 ' + item.data.recipient_name;
      var sub = document.createElement('span');
      sub.textContent = item.id + ' \u00b7 ' + fmtDate(item.data.date) + ' ' + item.data.time;
      meta.appendChild(s); meta.appendChild(sub);

      var btns = document.createElement('div');
      btns.className = 'btns';
      var load = document.createElement('button');
      load.type = 'button'; load.className = 'btn ghost'; load.textContent = 'Load';
      load.addEventListener('click', function () {
        writeForm(item.data); currentId = item.id; renderPreview(true);
        $('simulator').scrollIntoView();
        toast('Demo transaction loaded.');
      });
      var del = document.createElement('button');
      del.type = 'button'; del.className = 'btn ghost danger'; del.textContent = 'Delete';
      del.setAttribute('aria-label', 'Delete ' + item.id);
      del.addEventListener('click', function () {
        saveHistory(loadHistory().filter(function (h) { return h.id !== item.id; }));
        renderHistory(); toast('Demo transaction deleted.');
      });
      btns.appendChild(load); btns.appendChild(del);
      li.appendChild(meta); li.appendChild(btns);
      ul.appendChild(li);
    });
  }

  /* ---------- PNG download (canvas, no libraries) ---------- */
  function wrap(ctx, text, maxW) {
    var words = text.split(/\s+/), lines = [], line = '';
    words.forEach(function (w) {
      if (ctx.measureText(w).width > maxW) {
        if (line) { lines.push(line); line = ''; }
        var part = '';
        for (var i = 0; i < w.length; i++) {
          if (part && ctx.measureText(part + w[i]).width > maxW) { lines.push(part); part = ''; }
          part += w[i];
        }
        if (part) { lines.push(part); }
        return;
      }
      var t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    return lines;
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function downloadPng() {
    var m = buildModel(readForm(), currentId);
    var W = 720, P = 36, SC = 2, font = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
    var lines = messageLines(m), probe = document.createElement('canvas').getContext('2d');
    var layout = [], 
    lines.forEach(function (line) {
      if (line.kind === 'header') return;
       {
        probe.font = '800 14px ' + font;
        
      }
      var size = line.kind === 'amount' ? 42 : line.kind === 'id' ? 24 : line.kind === 'business' ? 26 : 21;
      var weight = line.kind === 'amount' || line.kind === 'id' || line.kind === 'business' ? '700' : '400';
      var style = line.kind === 'note' ? 'italic ' : '';
      probe.font = style + weight + ' ' + size + 'px ' + font;
      var wrapped = wrap(probe, line.text, W - P * 2 - 20);
      var lineH = size + 10, gap = line.kind === 'amount' || line.kind === 'section' ? 12 : 3;
      layout.push({ lines: wrapped, kind: line.kind, size: size, weight: weight, style: style, y: y + gap, lineH: lineH });
      y += gap + wrapped.length * lineH + (line.kind === 'amount' ? 8 : 0);
    });
    var H = y + 28;
    var c = document.createElement('canvas');
    c.width = W * SC; c.height = H * SC;
    var ctx = c.getContext('2d');
    ctx.scale(SC, SC);
    ctx.fillStyle = '#F5F7F5'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; rr(ctx, 12, 12, W - 24, H - 24, 22); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#B45309'; ctx.stroke();
    ctx.save(); rr(ctx, 12, 12, W - 24, H - 24, 22); ctx.clip();
    ctx.fillStyle = '#B45309'; ctx.fillRect(12, 12, W - 24, 56);
    ctx.fillStyle = '#fff'; ctx.font = '800 26px ' + font; ctx.textAlign = 'center';
    ctx.fillText(lines[0].text, W / 2, 49);
    layout.forEach(function (item) {
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = item.style + item.weight + ' ' + item.size + 'px ' + font;
      ctx.fillStyle = item.kind === 'id' ? '#5A685D' : item.kind === 'amount' ? '#0D2B1D' : item.kind === 'section' ? '#173F2A' : '#172018';
      item.lines.forEach(function (line, i) { ctx.fillText(line, P, item.y + (i + 1) * item.lineH - 6); });
    });
    var footerH = footerLines.length * 21 + 16;
    ctx.fillStyle = '#FEF3E2'; rr(ctx, P, footerY, W - P * 2, footerH, 10); ctx.fill();
    ctx.strokeStyle = '#B45309'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#B45309'; ctx.textAlign = 'center'; ctx.font = '800 14px ' + font;
    footerLines.forEach(function (line, i) { ctx.fillText(line, W / 2, footerY + 20 + i * 21); });
    ctx.translate(W / 2, H / 2); ctx.rotate(-0.42);
    ctx.fillStyle = 'rgba(180,83,9,0.16)'; ctx.font = '900 88px ' + font;
    ctx.textBaseline = 'middle'; ctx.fillText('DEMO / TEST', 0, 0);
    ctx.restore();

    c.toBlob(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (currentId || '.transaction') + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      toast('Demo image downloaded.');
    }, 'image/png');
  }

  /* ---------- copy ---------- */
  function copyText() {
    var text = messageText();
    function ok() { toast('Demo transaction copied.'); }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(ok, fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { toast('Copy failed. Select the text manually.'); }
      ta.remove();
    }
  }

  /* ---------- events ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;
    currentId = newId();
    var list = loadHistory();
    list.unshift({ id: currentId, data: readForm(), created: Date.now() });
    saveHistory(list.slice(0, 50));
    renderPreview(true); renderHistory();
    toast('Demo transaction generated.');
  });

  form.addEventListener('input', function (e) {
    if (e.target.hasAttribute('aria-invalid')) setErr(e.target.name, '');
    renderPreview(false);
  });

  $('clearBtn').addEventListener('click', function () {
    form.reset(); currentId = null;
    FIELDS.forEach(function (f) { if (form.elements[f]) setErr(f, ''); });
    setNow(); renderPreview(false);
  });

  document.querySelectorAll('[data-preset]').forEach(function (b) {
    b.addEventListener('click', function () {
      var p = PRESETS[+b.dataset.preset];
      writeForm({
        sender_name: form.elements.sender_name.value || 'John Doe',
        amount: p.amount, recipient_name: p.recipient_name, transaction_type: p.transaction_type,
        recipient_number: form.elements.recipient_number.value || '123456',
        reference: form.elements.reference.value || 'ORDER123'
      });
      currentId = null; renderPreview(true);
    });
  });

  $('copyBtn').addEventListener('click', copyText);
  $('downloadBtn').addEventListener('click', downloadPng);
  $('clearHistory').addEventListener('click', function () {
    if (!loadHistory().length) return;
    if (confirm('Delete all saved demo transactions from this browser?')) {
      saveHistory([]); renderHistory(); toast('History cleared.');
    }
  });

  var menuBtn = $('menuBtn'), nav = $('nav');
  menuBtn.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
  });

  setNow(); renderPreview(false); renderHistory();
})();
