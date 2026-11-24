// Visor local mínimo para revisar los artboards (no se publica).
(function () {
  const mv = document.createElement('meta'); mv.name = 'viewport'; mv.content = 'width=390'; document.head.appendChild(mv);
  window.DCLogic = class { constructor(props) { this.props = props || {}; this.state = {}; } setState(p) { Object.assign(this.state, p); window.__dcRender(); } forceUpdate() { window.__dcRender(); } };
  const get = (vals, path, scope) => {
    path = path.trim();
    if (path === 'true') return true; if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    const parts = path.split('.');
    let v = parts[0] in scope ? scope[parts[0]] : vals[parts[0]];
    for (const p of parts.slice(1)) v = v == null ? undefined : v[p];
    return v;
  };
  const whole = /^\s*\{\{([^}]+)\}\}\s*$/;
  const interp = (s, vals, scope) => s.replace(/\{\{([^}]+)\}\}/g, (_, p) => { const v = get(vals, p, scope); return v == null ? '' : String(v); });
  function build(node, vals, scope, out) {
    if (node.nodeType === 3) { out.appendChild(document.createTextNode(interp(node.textContent, vals, scope))); return; }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'sc-for') {
      const list = get(vals, node.getAttribute('list').match(whole)[1], scope) || [];
      const as = node.getAttribute('as');
      list.forEach((item, i) => { const sc = Object.assign({}, scope, { [as]: item, $index: i }); node.childNodes.forEach((c) => build(c, vals, sc, out)); });
      return;
    }
    if (tag === 'sc-if') {
      if (get(vals, node.getAttribute('value').match(whole)[1], scope)) node.childNodes.forEach((c) => build(c, vals, scope, out));
      return;
    }
    const el = document.createElementNS(node.namespaceURI, tag);
    for (const a of node.attributes) {
      const m = a.value.match(whole);
      if (/^on[A-Z]/.test(a.name) || /^on[a-z]+$/.test(a.name) && m) {
        const fn = get(vals, m[1], scope); const ev = a.name.slice(2).toLowerCase();
        if (typeof fn === 'function') el.addEventListener(ev === 'change' ? 'change' : ev, fn);
        continue;
      }
      if (m) { const v = get(vals, m[1], scope); if (v === false || v == null) continue; el.setAttribute(a.name, v === true ? '' : String(v)); continue; }
      el.setAttribute(a.name, interp(a.value, vals, scope));
    }
    node.childNodes.forEach((c) => build(c, vals, scope, el));
    out.appendChild(el);
  }
  document.addEventListener('DOMContentLoaded', () => {
    const x = document.querySelector('x-dc');
    const tpl = x.cloneNode(true); x.innerHTML = '';
    const helmet = tpl.querySelector('helmet'); if (helmet) { document.head.append(...helmet.childNodes); helmet.remove(); }
    const code = document.querySelector('script[data-dc-script]').textContent;
    const C = new Function(code + '; return Component;')();
    const inst = new C({}); if (!inst.state) inst.state = {}; window.__dcInst = inst;
    let focusId = null;
    window.__dcRender = () => {
      const a = document.activeElement; focusId = a && a.id ? a.id : (a && a.getAttribute && a.getAttribute('aria-label'));
      const keep = {}; x.querySelectorAll('input').forEach((i, k) => keep[k] = i.value);
      const frag = document.createDocumentFragment();
      tpl.childNodes.forEach((c) => build(c, inst.renderVals(), {}, frag));
      x.innerHTML = ''; x.appendChild(frag);
      x.querySelectorAll('input').forEach((i, k) => { if (keep[k] != null) i.value = keep[k]; });
      if (focusId) { const f = x.querySelector('#' + CSS.escape(focusId)) || x.querySelector('[aria-label="' + focusId + '"]'); if (f) f.focus(); }
    };
    window.__dcRender();
  });
})();
