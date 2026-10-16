/* ===================================================================
   活用ラボ — utilitários de DOM.

   Tudo é construído por nó, com textContent. Nada de innerHTML com
   conteúdo variável: o banco é local, mas a resposta digitada pelo
   usuário volta na tela do feedback, e ela nunca deve virar markup.
   =================================================================== */

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;              // só com literais do código
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(node, ...children) {
  clear(node);
  children.flat(Infinity).forEach(c => c && node.appendChild(c));
  return node;
}

/* Cor da forma-alvo, para chips, barras e a matriz. */
export function formVars(form) {
  return { '--fc': `var(--f-${form})`, '--wash': `var(--f-${form}-wash)` };
}

/* Rodapé de retorno, igual em todas as telas secundárias — mesmo padrão
   do Bunpou Lab (`← Voltar`, botão fantasma no fim da página). A logo
   continua sendo um atalho para a home, nunca a única saída. */
export function backRow(app, label = '← Voltar') {
  return h('div', { class: 'row', style: { marginTop: '22px' } },
    h('button', {
      class: 'btn btn-ghost',
      'data-nav': 'back',
      onclick: () => app.back()
    }, label)
  );
}
