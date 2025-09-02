const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

// Types assumed covered by Microsoft 365 Copilot license
// Include Classic, Generative, Web-grounded, and Graph-grounded (tenant)
const M365_COVERED_TYPES = new Set(['classic', 'generative', 'web', 'tenant']);

function bestMonthlyCostForEff(eff, paygRate, packPrice, packSize, vatMult) {
  if (!Number.isFinite(eff) || eff <= 0) return 0;
  const paygCost = eff * paygRate * vatMult;
  const packs = Math.ceil(eff / packSize);
  const packCost = packs * packPrice * vatMult;
  const packsFloor = Math.floor(eff / packSize);
  const remainder = eff - packsFloor * packSize;
  const remainderCostPayg = remainder * paygRate * vatMult;
  const onePackCost = packPrice * vatMult;
  const hybridCost = (packsFloor * packPrice * vatMult) + (remainder === 0 ? 0 : Math.min(remainderCostPayg, onePackCost));
  return Math.min(paygCost, packCost, hybridCost);
}

// ======== Shared els for Calculator ========
const els = {
  messages: document.getElementById('messages'),
  buffer: document.getElementById('buffer'),
  payg: document.getElementById('payg'),
  packPrice: document.getElementById('packPrice'),
  packSize: document.getElementById('packSize'),
  vat: document.getElementById('vat'),
  vatRate: document.getElementById('vatRate'),
  agentName: document.getElementById('agentName'),
  effective: document.getElementById('effective'),
  options: document.getElementById('options'),
  recommend: document.getElementById('recommend'),
  why: document.getElementById('why'),
  breakeven: document.getElementById('breakeven'),
  recCard: document.getElementById('recCard'),
  recAgent: document.getElementById('recAgent'),
  recCost: document.getElementById('recCost'),
  recCostWith: document.getElementById('recCostWith'),
  recSave: document.getElementById('recSave'),
  recSaveWrap: document.getElementById('recSaveWrap'),
  recWithWrap: document.getElementById('recWithWrap'),
  totalUsers: document.getElementById('totalUsers'),
  licensedUsers: document.getElementById('licensedUsers'),
  effectiveM365: document.getElementById('effectiveM365'),
  m365EffWrap: document.getElementById('m365EffWrap')
};
const m365Apply = document.getElementById('m365Apply');

const parse = (el, def = 0) => {
  const n = parseFloat(el.value);
  return Number.isFinite(n) ? n : def;
};

function calc() {
  const messages = Math.max(0, Math.floor(parse(els.messages)));
  const bufferPct = Math.max(0, parse(els.buffer));
  const paygRate = Math.max(0, parse(els.payg));
  const packPrice = Math.max(0, parse(els.packPrice));
  const packSize = Math.max(1, Math.floor(parse(els.packSize)));
  const vatOn = els.vat.checked;
  const vatRate = Math.max(0, parse(els.vatRate));
  // keep URL share in sync
  updateShareUrl();

  const eff = Math.ceil(messages * (1 + bufferPct / 100));
  const vatMult = vatOn ? (1 + vatRate / 100) : 1;

  // Preview: effective billed messages with M365 Copilot (if applied)
  const totalUsers = Math.max(0, Math.floor(parse(els.totalUsers)));
  const licensedUsers = Math.max(0, Math.floor(parse(els.licensedUsers)));
  const m365OnPreview = !!(m365Apply && m365Apply.checked) && totalUsers > 0 && licensedUsers > 0;
  let effM365 = eff;
  if (m365OnPreview) {
    const totalRatePrev = (typeof nodes !== 'undefined') ? nodes.reduce((s, n) => s + nodeMsgs(n), 0) : 0;
    const coveredRatePrev = (typeof nodes !== 'undefined') ? nodes.filter(n => M365_COVERED_TYPES.has(n.type)).reduce((s, n) => s + nodeMsgs(n), 0) : 0;
    const coveredFracPrev = totalRatePrev > 0 ? Math.min(1, coveredRatePrev / totalRatePrev) : 1; // assume fully covered if no flow
    const sharePrev = Math.min(1, licensedUsers / totalUsers);
    effM365 = Math.ceil(eff * (1 - sharePrev * coveredFracPrev));
  }
  if (els.effectiveM365 && els.m365EffWrap) {
    els.effectiveM365.textContent = effM365.toLocaleString('en-GB');
    els.m365EffWrap.style.display = m365OnPreview ? 'flex' : 'none';
  }

  // PAYG
  const paygCost = eff * paygRate * vatMult;
  const paygEffectivePerMsg = paygRate * vatMult;

  // Packs
  const packs = Math.ceil(eff / packSize);
  const packCost = packs * packPrice * vatMult;
  const packWaste = packs * packSize - eff;
  const packEffectivePerMsg = packCost / eff;

  // Hybrid (Packs + PAYG for overspill)
  const packsFloor = Math.floor(eff / packSize);
  const remainder = eff - packsFloor * packSize;
  const remainderCostPayg = remainder * paygRate * vatMult;
  const onePackCost = packPrice * vatMult;
  const remainderStrategy = remainder === 0 ? 'none' : (remainderCostPayg <= onePackCost ? 'PAYG' : 'Pack');
  const hybridPacks = packsFloor + (remainder > 0 && remainderStrategy === 'Pack' ? 1 : 0);
  const hybridCost = (packsFloor * packPrice * vatMult) + (remainder === 0 ? 0 : Math.min(remainderCostPayg, onePackCost));
  const hybridWaste = remainderStrategy === 'Pack' ? (packSize - remainder) : 0;
  const hybridEffectivePerMsg = hybridCost / eff;

  // Breakeven (ex-VAT; VAT cancels)
  const breakeven = paygRate > 0 ? Math.ceil(packPrice / paygRate) : Infinity;

  els.effective.textContent = eff.toLocaleString('en-GB');
  els.breakeven.textContent = Number.isFinite(breakeven) ? breakeven.toLocaleString('en-GB') : 'infinite';

  let optionsArr = [
    { key: 'PAYG', title: 'PAYG', cost: paygCost, perMsg: paygEffectivePerMsg },
    { key: 'Packs', title: 'Message Packs', cost: packCost, perMsg: packEffectivePerMsg },
    { key: 'Hybrid', title: 'Hybrid (Packs + PAYG)', cost: hybridCost, perMsg: hybridEffectivePerMsg }
  ].sort((a, b) => a.cost - b.cost);

  let best = optionsArr[0];
  let second = optionsArr[1] ?? optionsArr[0];
  els.recommend.textContent = best.title;
  els.why.textContent = `Saves ${GBP.format(second.cost - best.cost)} vs ${second.title} this month.`;

  // Baseline min cost (for comparisons / bubble)
  const baselineMin = Math.min(paygCost, packCost, hybridCost);
  let withMin = null;

  // Optional M365-adjusted costs (calculator-level)
  let withCosts = null;
  const m365On = m365OnPreview;
  if (m365On) {
    // Determine covered fraction from Agent Builder mix if available; otherwise assume 100% covered
    const totalRate = nodes.reduce((s, n) => s + nodeMsgs(n), 0);
    const coveredRate = nodes.filter(n => M365_COVERED_TYPES.has(n.type)).reduce((s, n) => s + nodeMsgs(n), 0);
    const coveredFrac = totalRate > 0 ? Math.min(1, coveredRate / totalRate) : 1;
    const share = Math.min(1, licensedUsers / totalUsers);
    const effWith = Math.ceil(eff * (1 - share * coveredFrac));
    const packsWith = Math.ceil(effWith / packSize);
    const packCostWith = packsWith * packPrice * vatMult;
    const packsFloorWith = Math.floor(effWith / packSize);
    const remainderWith = effWith - packsFloorWith * packSize;
    const remainderCostPaygWith = remainderWith * paygRate * vatMult;
    const onePackCostWith = packPrice * vatMult;
    const hybridCostWith = (packsFloorWith * packPrice * vatMult) + (remainderWith === 0 ? 0 : Math.min(remainderCostPaygWith, onePackCostWith));
    const paygCostWith = effWith * paygRate * vatMult;
    withCosts = { PAYG: paygCostWith, Packs: packCostWith, Hybrid: hybridCostWith };
    withMin = Math.min(paygCostWith, packCostWith, hybridCostWith);
  }

  // If M365 is applied, recompute displayed option costs and recommendation
  let useCosts = { PAYG: paygCost, Packs: packCost, Hybrid: hybridCost };
  let usePerMsg = { PAYG: paygEffectivePerMsg, Packs: packEffectivePerMsg, Hybrid: hybridEffectivePerMsg };
  let effUsedForMeta = eff;
  if (m365On && withCosts) {
    const totalRate2 = nodes.reduce((s, n) => s + nodeMsgs(n), 0);
    const coveredRate2 = nodes.filter(n => M365_COVERED_TYPES.has(n.type)).reduce((s, n) => s + nodeMsgs(n), 0);
    const coveredFrac2 = totalRate2 > 0 ? Math.min(1, coveredRate2 / totalRate2) : 1;
    const share2 = Math.min(1, licensedUsers / totalUsers);
    const effWith2 = Math.ceil(eff * (1 - share2 * coveredFrac2));
    effUsedForMeta = effWith2;
    useCosts = withCosts;
    usePerMsg = {
      PAYG: effWith2 > 0 ? withCosts.PAYG / effWith2 : 0,
      Packs: effWith2 > 0 ? withCosts.Packs / effWith2 : 0,
      Hybrid: effWith2 > 0 ? withCosts.Hybrid / effWith2 : 0
    };
    optionsArr = [
      { key: 'PAYG', title: 'PAYG', cost: useCosts.PAYG, perMsg: usePerMsg.PAYG },
      { key: 'Packs', title: 'Message Packs', cost: useCosts.Packs, perMsg: usePerMsg.Packs },
      { key: 'Hybrid', title: 'Hybrid (Packs + PAYG)', cost: useCosts.Hybrid, perMsg: usePerMsg.Hybrid }
    ].sort((a, b) => a.cost - b.cost);
    best = optionsArr[0];
    second = optionsArr[1] ?? optionsArr[0];
    els.recommend.textContent = best.title;
    els.why.textContent = `Saves ${GBP.format(second.cost - best.cost)} vs ${second.title} this month.`;
  }

  // Update recommendation bubble values
  if (els.recAgent) {
    const name = (els.agentName?.value || '').trim();
    els.recAgent.textContent = name || '—';
  }
  if (els.recCost) els.recCost.textContent = GBP.format(best.cost || 0);
  if (els.recWithWrap && els.recCostWith) {
    const showWith = !!(m365On && withMin != null);
    els.recWithWrap.style.display = showWith ? 'block' : 'none';
    els.recSaveWrap && (els.recSaveWrap.style.display = showWith ? 'block' : 'none');
    if (showWith) {
      els.recCostWith.textContent = GBP.format(withMin);
      const savings = Math.max(0, baselineMin - withMin);
      if (els.recSave) els.recSave.textContent = savings > 0 ? GBP.format(savings) : '£0.00';
    }
  }

  // Render options
  els.options.innerHTML = '';
  const frag = document.createDocumentFragment();

  const makeRow = (title, key, price, perMsg, meta = []) => {
    const wrap = document.createElement('div');
    wrap.className = 'option' + (title === best.title ? ' good' : '');
    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    wrap.appendChild(titleEl);
    const priceEl = document.createElement('div');
    priceEl.innerHTML = `<span class="price">${GBP.format(price)}</span> <span class="pm">/ month</span>`;
    wrap.appendChild(priceEl);
    const metaEl = document.createElement('div');
    metaEl.className = 'hint';
    if (m365On && withCosts) {
      const baseline = key==='PAYG' ? paygCost : (key==='Packs' ? packCost : hybridCost);
      const delta = baseline - price;
      if (delta > 0) meta.push(`saves ${GBP.format(delta)} vs baseline`);
    }
    metaEl.innerHTML = meta.join(' | ');
    wrap.appendChild(metaEl);
    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.textContent = `~ ${GBP.format(perMsg * 1000)} / 1k msgs`;
    wrap.appendChild(badge);
    frag.appendChild(wrap);
  };

  makeRow('PAYG', 'PAYG', useCosts.PAYG, usePerMsg.PAYG, [
    `${effUsedForMeta.toLocaleString('en-GB')} msgs x ${GBP.format(paygRate)} each${vatOn ? ` + VAT` : ''}`
  ]);

  // Compute displayed pack metrics
  const packsShown = (m365On && withCosts) ? Math.ceil(effUsedForMeta / packSize) : packs;
  const packWasteShown = (m365On && withCosts) ? (packsShown * packSize - effUsedForMeta) : packWaste;
  makeRow('Message Packs', 'Packs', useCosts.Packs, usePerMsg.Packs, [
    `${packsShown} x ${GBP.format(packPrice)} pack${packsShown !== 1 ? 's' : ''} (${packSize.toLocaleString('en-GB')} msgs each)${vatOn ? ` + VAT` : ''}`,
    packWasteShown > 0 ? `${packWasteShown.toLocaleString('en-GB')} unused msgs this month` : 'no unused messages'
  ]);

  // Compute displayed hybrid metrics
  const pf = Math.floor(effUsedForMeta / packSize);
  const rem = effUsedForMeta - pf * packSize;
  const strat = rem === 0 ? 'none' : ((rem * paygRate * vatMult) <= (packPrice * vatMult) ? 'PAYG' : 'Pack');
  const hybridPacksShown = pf + (rem > 0 && strat === 'Pack' ? 1 : 0);
  const hybridUnused = strat === 'Pack' ? (packSize - rem) : 0;
  makeRow('Hybrid (Packs + PAYG)', 'Hybrid', useCosts.Hybrid, usePerMsg.Hybrid, [
    `${hybridPacksShown} x ${GBP.format(packPrice)} pack${hybridPacksShown !== 1 ? 's' : ''}${
      rem > 0 ? (strat === 'PAYG' ? ` + ${rem.toLocaleString('en-GB')} msgs via PAYG` : ' (overspill covered by extra pack)') : ''
    }${vatOn ? ` + VAT` : ''}`,
    hybridUnused > 0 ? `${hybridUnused.toLocaleString('en-GB')} unused msgs this month` : 'no unused messages'
  ]);

  els.options.appendChild(frag);
  // Keep export view in sync
  if (typeof renderExport === 'function') renderExport();
}

// Bind calculator inputs
[els.messages, els.buffer, els.payg, els.packPrice, els.packSize, els.vat, els.vatRate]
  .forEach(el => el.addEventListener('input', calc));

// ======== Tabs ========
const tabCalc = document.getElementById('tab-calc');
const tabFlow = document.getElementById('tab-flow');
const tabExport = document.getElementById('tab-export');
const viewCalc = document.getElementById('view-calc');
const viewFlow = document.getElementById('view-flow');
const viewExport = document.getElementById('view-export');
// Export DOM refs (declared early so renderExport can run during initial calc)
const breakdown = document.getElementById('breakdown');
const copyBreakdown = document.getElementById('copyBreakdown');
const copyShareBtn = document.getElementById('copyShare');

function switchTab(which) {
  const isCalc = which === 'calc';
  const isFlow = which === 'flow';
  const isExport = which === 'export';
  tabCalc && tabCalc.setAttribute('aria-selected', isCalc);
  tabFlow && tabFlow.setAttribute('aria-selected', isFlow);
  tabExport && tabExport.setAttribute('aria-selected', isExport);
  viewCalc && viewCalc.classList.toggle('hidden', !isCalc);
  viewFlow && viewFlow.classList.toggle('hidden', !isFlow);
  viewExport && viewExport.classList.toggle('hidden', !isExport);
}
tabCalc.addEventListener('click', () => switchTab('calc'));
tabFlow.addEventListener('click', () => switchTab('flow'));
tabExport && tabExport.addEventListener('click', () => { renderExport(); switchTab('export'); });

// Header nav mirrors the tabs (for the minimal header style)
document.querySelectorAll('.brand-nav [data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const which = btn.getAttribute('data-tab');
    if (which === 'export') { renderExport && renderExport(); }
    switchTab(which);
    // keep aria state in sync for the pill tabs too
  });
});

// ======== Shareable URL (encoded) ========
function encodeState(obj){
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach(b=>bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeState(code){
  const base = code.replace(/-/g,'+').replace(/_/g,'/');
  const pad = base.length % 4 ? '='.repeat(4 - (base.length % 4)) : '';
  const bin = atob(base + pad);
  const bytes = new Uint8Array([...bin].map(c=>c.charCodeAt(0)));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}
// short codes for node types to keep URL compact
const TYPE_TO_KEY = { classic:'c', generative:'g', tenant:'t', flow:'f', toolBasic:'b', toolStandard:'s', toolPremium:'p', web:'w' };
const KEY_TO_TYPE = Object.fromEntries(Object.entries(TYPE_TO_KEY).map(([k,v])=>[v,k]));

function gatherState(){
  const messages = Math.max(0, Math.floor(parse(els.messages)));
  const bufferPct = Math.max(0, parse(els.buffer));
  const paygRate = Math.max(0, parse(els.payg));
  const packPrice = Math.max(0, parse(els.packPrice));
  const packSize = Math.max(1, Math.floor(parse(els.packSize)));
  const vatOn = !!els.vat.checked;
  const vatRate = Math.max(0, parse(els.vatRate));
  const totalUsers = Math.max(0, Math.floor(parse(els.totalUsers)));
  const licensedUsers = Math.max(0, Math.floor(parse(els.licensedUsers)));
  const m365 = !!(m365Apply && m365Apply.checked);
  const name = (els.agentName?.value || '').trim();
  const expectedEl = document.getElementById('expectedVolume');
  const expected = Math.max(0, Math.floor(parseFloat(expectedEl?.value || '0')||0));
  const nodesCompact = (typeof nodes !== 'undefined' && Array.isArray(nodes) && nodes.length)
    ? nodes.map(n => [TYPE_TO_KEY[n.type] || 'c', Math.max(1, n.qty|0), Math.max(0, (n.actions||0)|0), n.name || ''])
    : [];
  // compact array to keep URL short; include a version (v2 supports nodes + expected)
  return { v:2, d:[messages, bufferPct, paygRate, packPrice, packSize, vatOn?1:0, vatRate, totalUsers, licensedUsers, m365?1:0, name, expected, nodesCompact] };
}
function applyState(state){
  try{
    if(!state || !Array.isArray(state.d)) return;
    const v = state.v || 1;
    const baseCount = v >= 2 ? 12 : 11; // number of base fields before extras
    const [m,b,pg,pp,ps,vatOn,vr,tu,lu,m365,name, expected = 0, nodesCompact = []] = state.d;
    if(Number.isFinite(m)) els.messages.value = String(m);
    if(Number.isFinite(b)) els.buffer.value = String(b);
    if(Number.isFinite(pg)) els.payg.value = String(pg);
    if(Number.isFinite(pp)) els.packPrice.value = String(pp);
    if(Number.isFinite(ps)) els.packSize.value = String(ps);
    if(vatOn!=null) els.vat.checked = !!vatOn;
    if(Number.isFinite(vr)) els.vatRate.value = String(vr);
    if(Number.isFinite(tu)) els.totalUsers.value = String(tu);
    if(Number.isFinite(lu)) els.licensedUsers.value = String(lu);
    if(m365!=null && m365Apply) m365Apply.checked = !!m365;
    if(els.agentName && typeof name === 'string') els.agentName.value = name;
    const expectedEl = document.getElementById('expectedVolume');
    if(expectedEl && Number.isFinite(expected)) expectedEl.value = String(expected);
    if(Array.isArray(nodesCompact) && typeof nodes !== 'undefined'){
      nodes = nodesCompact.map((row, i) => {
        const [key, qty, actions, nm] = row;
        return {
          id: ++uid,
          name: typeof nm === 'string' ? nm : '',
          type: KEY_TO_TYPE[key] || 'classic',
          qty: Math.max(1, parseInt(qty)||1),
          actions: Math.max(0, parseInt(actions)||0)
        };
      });
    }
  }catch(e){ /* ignore */ }
}
function updateShareUrl(){
  const state = gatherState();
  const code = encodeState(state);
  const url = new URL(window.location);
  url.searchParams.set('s', code);
  window.history.replaceState(null, '', url);
}
// defer applying URL state until after nodes/uid exist (declared below)

// ======== Agent builder logic ========
const canvas = document.getElementById('canvas');
const nodeName = document.getElementById('nodeName');
const nodeType = document.getElementById('nodeType');
const nodeQty = document.getElementById('nodeQty');
const flowActionsWrap = document.getElementById('flowActionsWrap');
const flowActions = document.getElementById('flowActions');
const addOrUpdateNode = document.getElementById('addOrUpdateNode');
const duplicateNode = document.getElementById('duplicateNode');
const deleteNode = document.getElementById('deleteNode');
const moveUp = document.getElementById('moveUp');
const moveDown = document.getElementById('moveDown');
const perRun = document.getElementById('perRun');
const billedPerRun = document.getElementById('billedPerRun');
const expectedVolume = document.getElementById('expectedVolume');
const pushToCalc = document.getElementById('pushToCalc');
const m365 = document.getElementById('m365');
const savingsCard = document.getElementById('savingsCard');
const m365Savings = document.getElementById('m365Savings');
const coverageHint = document.getElementById('coverageHint');
const m365CostNo = document.getElementById('m365CostNo');
const m365CostWith = document.getElementById('m365CostWith');

let nodes = [];
let selected = -1;
let uid = 0;

// Load from URL (if present) once now that nodes/uid exist
(() => {
  try{
    const url = new URL(window.location);
    const code = url.searchParams.get('s');
    if(code){ applyState(decodeState(code)); }
  }catch(e){ /* ignore */ }
})();

const typeToRate = (t, actions = 0) => ({
  classic: 1,
  generative: 2,
  tenant: 10,
  flow: 5 + (0.13 * actions),
  toolBasic: 0.1,
  toolStandard: 1.5,
  toolPremium: 10,
  web: 0
})[t] ?? 0;

const typeLabel = (t) => ({
  classic: 'Classic',
  generative: 'Generative',
  tenant: 'Tenant graph',
  flow: 'Agent flow',
  toolBasic: 'AI tool (Basic)',
  toolStandard: 'AI tool (Standard)',
  toolPremium: 'AI tool (Premium)',
  web: 'Web-grounded'
})[t] ?? t;

function showFlowActions() {
  flowActionsWrap.style.display = (nodeType.value === 'flow') ? 'block' : 'none';
}
nodeType.addEventListener('change', showFlowActions);
showFlowActions();

function nodeMsgs(n) {
  const rate = typeToRate(n.type, n.actions || 0);
  return +(rate * n.qty).toFixed(3);
}

function coverageRatio() {
  const total = Math.max(0, Math.floor(parse(els.totalUsers)));
  const licensed = Math.max(0, Math.floor(parse(els.licensedUsers)));
  if (!total || !licensed) return 0;
  return Math.max(0, Math.min(1, licensed / total));
}

function nodeMsgsBilled(n, m365On, ratio) {
  let rate = typeToRate(n.type, n.actions || 0);
  if (m365On && M365_COVERED_TYPES.has(n.type)) rate = rate * (1 - ratio);
  return +(rate * n.qty).toFixed(3);
}

function renderNodes() {
  canvas.innerHTML = '';
  nodes.forEach((n, i) => {
    const node = document.createElement('div');
    node.className = `flow-node t-${n.type}` + (i === selected ? ' selected' : '');
    node.dataset.i = i;
    node.innerHTML = `
      <div class="pill">${i + 1}</div>
      <div>
        <h4>${n.name || typeLabel(n.type)}</h4>
        <div class="meta">${typeLabel(n.type)}${n.type === 'flow' ? ` | ${n.actions} actions` : ''} | qty ${n.qty} | ${nodeMsgs(n)} msgs</div>
        <div class="node-badges">
          <span class="node-badge">rate ${typeToRate(n.type, n.actions || 0)}</span>
        </div>
      </div>
      <div class="node-actions">
        <button class="btn" data-action="edit">Edit</button>
        <button class="btn" data-action="delete">Delete</button>
      </div>`;
    canvas.appendChild(node);
  });

  // Totals
  let perRunTotal = nodes.reduce((s, n) => s + nodeMsgs(n), 0);
  perRun.textContent = perRunTotal.toFixed(3);
  
  // Sync calculator: total monthly messages = perRun * expected runs
  const expected = Math.max(0, Math.floor(parseFloat(expectedVolume.value) || 0));
  const totalMonthly = Math.ceil(perRunTotal * expected);
  if (nodes.length > 0 && expected > 0) {
    els.messages.value = totalMonthly;
  }
  calc();
  updateShareUrl();
  if (typeof renderExport === 'function') renderExport();
}

function clearInspector() {
  selected = -1;
  nodeName.value = '';
  nodeType.value = 'classic';
  nodeQty.value = '1';
  flowActions.value = '3';
  addOrUpdateNode.textContent = 'Add step';
  showFlowActions();
}

function loadInspector(i) {
  const n = nodes[i]; if (!n) return;
  selected = i;
  nodeName.value = n.name || '';
  nodeType.value = n.type;
  nodeQty.value = n.qty;
  flowActions.value = n.actions || 0;
  addOrUpdateNode.textContent = 'Update step';
  showFlowActions();
}

// Canvas click handling
canvas.addEventListener('click', (e) => {
  const wrap = e.target.closest('.flow-node');
  if (!wrap) return;
  const i = Number(wrap.dataset.i);
  const action = e.target.dataset.action;
  if (action === 'delete') { nodes.splice(i, 1); clearInspector(); renderNodes(); return; }
  loadInspector(i);
  renderNodes();
});

addOrUpdateNode.addEventListener('click', () => {
  const n = {
    id: ++uid,
    name: nodeName.value.trim(),
    type: nodeType.value,
    qty: Math.max(1, Math.floor(parseFloat(nodeQty.value) || 1)),
    actions: Math.max(0, Math.floor(parseFloat(flowActions.value) || 0))
  };
  if (selected >= 0) {
    nodes[selected] = n;
  } else {
    nodes.push(n);
  }
  renderNodes();
  clearInspector();
});

duplicateNode.addEventListener('click', () => {
  if (selected < 0) return;
  const base = nodes[selected];
  nodes.splice(selected + 1, 0, { ...base, id: ++uid });
  renderNodes();
});

deleteNode.addEventListener('click', () => {
  if (selected < 0) return;
  nodes.splice(selected, 1); clearInspector(); renderNodes();
});

moveUp.addEventListener('click', () => {
  if (selected <= 0) return; const i = selected; [nodes[i - 1], nodes[i]] = [nodes[i], nodes[i - 1]]; selected = i - 1; renderNodes();
});
moveDown.addEventListener('click', () => {
  if (selected < 0 || selected >= nodes.length - 1) return; const i = selected; [nodes[i], nodes[i + 1]] = [nodes[i + 1], nodes[i]]; selected = i + 1; renderNodes();
});

[expectedVolume].forEach(el => el.addEventListener('input', renderNodes));
// Recompute results when agent expected volume changes
[els.buffer, els.payg, els.packPrice, els.packSize, els.vat, els.vatRate]
  .forEach(el => el.addEventListener('input', calc));
// User licensing inputs affect only calculator
[els.totalUsers, els.licensedUsers]
  .forEach(el => el.addEventListener('input', calc));
if (m365Apply) m365Apply.addEventListener('change', calc);
if (els.agentName) els.agentName.addEventListener('input', updateShareUrl);
nodeType.addEventListener('change', showFlowActions);

pushToCalc.addEventListener('click', () => { switchTab('calc'); });

// Initial render
calc();
renderNodes();

// ======== Export breakdown ========

function renderExport(){
  if(!breakdown) return;
  const expected = Math.max(0, Math.floor(parseFloat(expectedVolume?.value)||0));
  const totalUsers = Math.max(0, Math.floor(parse(els.totalUsers)));
  const licensedUsers = Math.max(0, Math.floor(parse(els.licensedUsers)));
  const m365On = !!(m365Apply && m365Apply.checked) && totalUsers>0 && licensedUsers>0;
  const share = m365On ? Math.min(1, licensedUsers/totalUsers) : 0;

  // Node breakdown rows
  const nodeRows = [];
  let perRunTotal = 0, perRunBilled = 0;
  nodes.forEach((n,i)=>{
    const rate = typeToRate(n.type, n.actions||0);
    const msgs = +(rate * n.qty).toFixed(3);
    const covered = M365_COVERED_TYPES.has(n.type);
    const billed = +(msgs * (covered? (1-share):1)).toFixed(3);
    perRunTotal += msgs; perRunBilled += billed;
    nodeRows.push({
      idx:i+1,
      name:n.name || typeLabel(n.type),
      type:typeLabel(n.type),
      qty:n.qty,
      actions:n.type==='flow'?(n.actions||0):'',
      rate,
      msgs,
      covered: covered?'Yes':'No',
      billed
    });
  });

  // Effective volumes (monthly)
  const bufferPct = Math.max(0, parse(els.buffer));
  const monthly = Math.ceil(perRunTotal * expected);
  const monthlyBilled = Math.ceil(perRunBilled * expected);
  const eff = Math.ceil(monthly * (1+bufferPct/100));
  const effWith = Math.ceil(monthlyBilled * (1+bufferPct/100));

  // Pricing parameters
  const paygRate = Math.max(0, parse(els.payg));
  const packPrice = Math.max(0, parse(els.packPrice));
  const packSize = Math.max(1, Math.floor(parse(els.packSize)));
  const vatOn = els.vat.checked;
  const vatRate = Math.max(0, parse(els.vatRate));
  const vatMult = vatOn ? (1 + vatRate/100) : 1;

  // Helper: best monthly cost
  const bestCostFor = (E) => {
    const payg = E * paygRate * vatMult;
    const packs = Math.ceil(E / packSize);
    const packCost = packs * packPrice * vatMult;
    const pf = Math.floor(E / packSize);
    const rem = E - pf*packSize;
    const remPayg = rem * paygRate * vatMult;
    const onePack = packPrice * vatMult;
    const hybrid = (pf * packPrice * vatMult) + (rem===0?0:Math.min(remPayg, onePack));
    return { PAYG:payg, Packs:packCost, Hybrid:hybrid };
  };

  const costsBase = bestCostFor(eff);
  const costsWith = bestCostFor(effWith);

  // Build HTML tables
  let html = '';
  html += `<div class="section-title">Node breakdown (per run)</div>`;
  html += `<table class="table"><thead><tr><th>#</th><th>Name</th><th>Type</th><th>Qty</th><th>Actions</th><th>Rate</th><th>Msgs/run</th><th>Covered</th><th>Billed/run${m365On?' (M365 Copilot)':''}</th></tr></thead><tbody>`;
  nodeRows.forEach(r=>{
    html += `<tr><td>${r.idx}</td><td>${r.name}</td><td>${r.type}</td><td>${r.qty}</td><td>${r.actions}</td><td>${r.rate}</td><td>${r.msgs}</td><td>${r.covered}</td><td>${r.billed}</td></tr>`;
  });
  html += `<tr><td colspan="6"><strong>Totals</strong></td><td><strong>${perRunTotal.toFixed(3)}</strong></td><td></td><td><strong>${perRunBilled.toFixed(3)}</strong></td></tr>`;
  html += `</tbody></table>`;

  html += `<div class="section-title">Volumes (monthly)</div>`;
  html += `<table class="table"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>`;
  html += `<tr><td>Runs/month</td><td>${expected.toLocaleString('en-GB')}</td></tr>`;
  html += `<tr><td>Messages/month (baseline)</td><td>${monthly.toLocaleString('en-GB')}</td></tr>`;
  html += `<tr><td>Messages/month (with M365 Copilot)</td><td>${monthlyBilled.toLocaleString('en-GB')}</td></tr>`;
  html += `<tr><td>Effective (incl. buffer)</td><td>${eff.toLocaleString('en-GB')}</td></tr>`;
  html += `<tr><td>Effective with M365 Copilot (incl. buffer)</td><td>${effWith.toLocaleString('en-GB')}</td></tr>`;
  html += `</tbody></table>`;

  html += `<div class="section-title">Pricing summary</div>`;
  html += `<table class="table"><thead><tr><th>Option</th><th>Baseline</th><th>With M365 Copilot</th><th>Savings</th></tr></thead><tbody>`;
  ['PAYG','Packs','Hybrid'].forEach(k=>{
    const b = costsBase[k]; const w = costsWith[k]; const s = Math.max(0,b-w);
    html += `<tr><td>${k}</td><td>${GBP.format(b)}</td><td>${GBP.format(w)}</td><td>${GBP.format(s)}</td></tr>`;
  });
  html += `</tbody></table>`;

  breakdown.innerHTML = html;

  // Copy TSV
  if(copyBreakdown){
    copyBreakdown.onclick = () => {
      const lines = [];
      lines.push(['#','Name','Type','Qty','Actions','Rate','Msgs/run','Covered','Billed/run'].join('\t'));
      nodeRows.forEach(r=>lines.push([r.idx,r.name,r.type,r.qty,r.actions,r.rate,r.msgs,r.covered,r.billed].join('\t')));
      lines.push('');
      lines.push(['Metric','Value'].join('\t'));
      lines.push(['Runs/month', expected].join('\t'));
      lines.push(['Messages/month (baseline)', monthly].join('\t'));
      lines.push(['Messages/month (with M365 Copilot)', monthlyBilled].join('\t'));
      lines.push(['Effective (incl. buffer)', eff].join('\t'));
      lines.push(['Effective with M365 Copilot (incl. buffer)', effWith].join('\t'));
      lines.push('');
      lines.push(['Option','Baseline','With M365 Copilot','Savings'].join('\t'));
      ['PAYG','Packs','Hybrid'].forEach(k=>{
        const b = costsBase[k]; const w = costsWith[k]; const s = Math.max(0,b-w);
        lines.push([k, b, w, s].join('\t'));
      });
      const tsv = lines.join('\n');
      navigator.clipboard?.writeText(tsv).then(()=>{
        copyBreakdown.textContent = 'Copied!';
        setTimeout(()=>copyBreakdown.textContent='Copy as TSV',1200);
      }).catch(()=>{
        // Fallback
        const ta = document.createElement('textarea'); ta.value = tsv; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        copyBreakdown.textContent = 'Copied!'; setTimeout(()=>copyBreakdown.textContent='Copy as TSV',1200);
      });
    };
  }
  if(copyShareBtn){
    copyShareBtn.onclick = () => {
      updateShareUrl();
      const link = window.location.href;
      navigator.clipboard?.writeText(link).then(()=>{
        copyShareBtn.textContent = 'Link copied!';
        setTimeout(()=>copyShareBtn.textContent='Copy Share URL',1200);
      }).catch(()=>{
        const ta = document.createElement('textarea'); ta.value = link; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        copyShareBtn.textContent = 'Link copied!'; setTimeout(()=>copyShareBtn.textContent='Copy Share URL',1200);
      });
    };
  }
}

// Re-render export when things change
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) renderExport(); });
window.addEventListener('focus', renderExport);
