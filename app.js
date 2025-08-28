
    const GBP = new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP' });

    // ======== Shared els for Calculator ========
    const els = {
      messages: document.getElementById('messages'),
      buffer: document.getElementById('buffer'),
      payg: document.getElementById('payg'),
      packPrice: document.getElementById('packPrice'),
      packSize: document.getElementById('packSize'),
      vat: document.getElementById('vat'),
      vatRate: document.getElementById('vatRate'),
      effective: document.getElementById('effective'),
      options: document.getElementById('options'),
      recommend: document.getElementById('recommend'),
      why: document.getElementById('why'),
      breakeven: document.getElementById('breakeven'),
      recCard: document.getElementById('recCard')
    };

    const parse = (el, def=0) => {
      const n = parseFloat(el.value);
      return Number.isFinite(n) ? n : def;
    };

    function calc(){
      const messages = Math.max(0, Math.floor(parse(els.messages)));
      const bufferPct = Math.max(0, parse(els.buffer));
      const paygRate = Math.max(0, parse(els.payg));
      const packPrice = Math.max(0, parse(els.packPrice));
      const packSize = Math.max(1, Math.floor(parse(els.packSize)));
      const vatOn = els.vat.checked;
      const vatRate = Math.max(0, parse(els.vatRate));

      const eff = Math.ceil(messages * (1 + bufferPct/100));
      const vatMult = vatOn ? (1 + vatRate/100) : 1;

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
      els.breakeven.textContent = Number.isFinite(breakeven) ? breakeven.toLocaleString('en-GB') : 'â€”';

      const optionsArr = [
        { key: 'PAYG', title: 'PAYG', cost: paygCost, perMsg: paygEffectivePerMsg },
        { key: 'Packs', title: 'Message Packs', cost: packCost, perMsg: packEffectivePerMsg },
        { key: 'Hybrid', title: 'Hybrid (Packs + PAYG)', cost: hybridCost, perMsg: hybridEffectivePerMsg }
      ].sort((a,b)=>a.cost-b.cost);

      const best = optionsArr[0];
      const second = optionsArr[1] ?? optionsArr[0];
      els.recommend.textContent = best.title;
      els.why.textContent = `Saves ${GBP.format(second.cost - best.cost)} vs ${second.title} this month.`;

      // Render options
      els.options.innerHTML = '';
      const frag = document.createDocumentFragment();

      const makeRow = (title, price, perMsg, meta=[]) => {
        const wrap = document.createElement('div');
        wrap.className = 'option' + (title===best.title ? ' good' : '');
        const titleEl = document.createElement('h3');
        titleEl.textContent = title;
        wrap.appendChild(titleEl);
        const priceEl = document.createElement('div');
        priceEl.innerHTML = `<span class="price">${GBP.format(price)}</span> <span class="pm">/ month</span>`;
        wrap.appendChild(priceEl);
        const metaEl = document.createElement('div');
        metaEl.className='hint';
        metaEl.innerHTML = meta.join(' Â· ');
        wrap.appendChild(metaEl);
        const badge = document.createElement('div');
        badge.className='badge';
        badge.textContent = `â‰ˆ ${GBP.format(perMsg * 1000)} / 1k msgs`;
        wrap.appendChild(badge);
        frag.appendChild(wrap);
      };

      makeRow('PAYG', paygCost, paygEffectivePerMsg, [
        `${eff.toLocaleString('en-GB')} msgs Ã— ${GBP.format(paygRate)} each${vatOn?` + VAT`:''}`
      ]);

      makeRow('Message Packs', packCost, packEffectivePerMsg, [
        `${packs} Ã— ${GBP.format(packPrice)} pack${packs!==1?'s':''} (${packSize.toLocaleString('en-GB')} msgs each)${vatOn?` + VAT`:''}`,
        packWaste>0?`${packWaste.toLocaleString('en-GB')} unused msgs this month`:'no unused messages'
      ]);

      makeRow('Hybrid (Packs + PAYG)', hybridCost, hybridEffectivePerMsg, [
        `${hybridPacks} Ã— ${GBP.format(packPrice)} pack${hybridPacks!==1?'s':''}${remainder>0 ? (remainderStrategy==='PAYG' ? ` + ${remainder.toLocaleString('en-GB')} msgs via PAYG` : ' (overspill covered by extra pack)') : ''}${vatOn?` + VAT`:''}`,
        hybridWaste>0?`${hybridWaste.toLocaleString('en-GB')} unused msgs this month`:'no unused messages'
      ]);

      els.options.appendChild(frag);
    }

    // Bind calculator inputs
    [els.messages, els.buffer, els.payg, els.packPrice, els.packSize, els.vat, els.vatRate]
      .forEach(el => el.addEventListener('input', calc));

    // ======== Tabs ========
    const tabCalc = document.getElementById('tab-calc');
    const tabFlow = document.getElementById('tab-flow');
    const viewCalc = document.getElementById('view-calc');
    const viewFlow = document.getElementById('view-flow');
    function switchTab(which){
      const isCalc = which==='calc';
      tabCalc.setAttribute('aria-selected', isCalc);
      tabFlow.setAttribute('aria-selected', !isCalc);
      viewCalc.classList.toggle('hidden', !isCalc);
      viewFlow.classList.toggle('hidden', isCalc);
    }
    tabCalc.addEventListener('click', ()=>switchTab('calc'));
    tabFlow.addEventListener('click', ()=>switchTab('flow'));

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
    const expectedVolume = document.getElementById('expectedVolume');
    const pushToCalc = document.getElementById('pushToCalc');

    let nodes = [];
    let selected = -1;
    let uid = 0;

    const typeToRate = (t, actions=0) => ({
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
      classic:'Classic', generative:'Generative', tenant:'Tenantâ€‘graph', flow:'Agent flow', toolBasic:'AI tool (Basic)', toolStandard:'AI tool (Standard)', toolPremium:'AI tool (Premium)', web:'Webâ€‘grounded'
    })[t] ?? t;

    function showFlowActions(){
      flowActionsWrap.style.display = (nodeType.value === 'flow') ? 'block' : 'none';
    }
    nodeType.addEventListener('change', showFlowActions);
    showFlowActions();

    function nodeMsgs(n){
      const rate = typeToRate(n.type, n.actions||0);
      return +(rate * n.qty).toFixed(3);
    }

    function renderNodes(){
      canvas.innerHTML='';
      nodes.forEach((n,i)=>{
        const node = document.createElement('div');
        node.className = `flow-node t-${n.type}` + (i===selected?' selected':'');
        node.dataset.i = i;
        node.innerHTML = `
          <div class="pill">${i+1}</div>
          <div>
            <h4>${n.name || typeLabel(n.type)}</h4>
            <div class="meta">${typeLabel(n.type)}${n.type==='flow'?` â€¢ ${n.actions} actions`:''} â€¢ qty ${n.qty} â€¢ ${nodeMsgs(n)} msgs</div>
            <div class="node-badges">
              <span class="node-badge">rate ${typeToRate(n.type, n.actions||0)}</span>
            </div>
          </div>
          <div class="node-actions">
            <button class="btn" data-action="edit">Edit</button>
            <button class="btn" data-action="delete">Delete</button>
          </div>`;
        canvas.appendChild(node);
      });

      // Totals
      let perRunTotal = nodes.reduce((s,n)=>s+nodeMsgs(n),0);
      perRun.textContent = perRunTotal.toFixed(3);

      // Sync calculator: total monthly messages = perRun * expected runs
      const expected = Math.max(0, Math.floor(parseFloat(expectedVolume.value)||0));
      const totalMonthly = Math.ceil(perRunTotal * expected);
      els.messages.value = totalMonthly;
      calc();
    }

    function clearInspector(){
      selected = -1;
      nodeName.value='';
      nodeType.value='classic';
      nodeQty.value='1';
      flowActions.value='3';
      addOrUpdateNode.textContent='Add step';
      showFlowActions();
    }

    function loadInspector(i){
      const n = nodes[i]; if(!n) return;
      selected = i;
      nodeName.value = n.name || '';
      nodeType.value = n.type;
      nodeQty.value = n.qty;
      flowActions.value = n.actions || 0;
      addOrUpdateNode.textContent='Update step';
      showFlowActions();
    }

    // Canvas click handling
    canvas.addEventListener('click', (e)=>{
      const wrap = e.target.closest('.flow-node');
      if(!wrap) return;
      const i = Number(wrap.dataset.i);
      const action = e.target.dataset.action;
      if(action==='delete'){ nodes.splice(i,1); clearInspector(); renderNodes(); return; }
      loadInspector(i);
      renderNodes();
    });

    addOrUpdateNode.addEventListener('click', ()=>{
      const n = {
        id: ++uid,
        name: nodeName.value.trim(),
        type: nodeType.value,
        qty: Math.max(1, Math.floor(parseFloat(nodeQty.value)||1)),
        actions: Math.max(0, Math.floor(parseFloat(flowActions.value)||0))
      };
      if(selected>=0){
        nodes[selected] = n;
      } else {
        nodes.push(n);
      }
      renderNodes();
      clearInspector();
    });

    duplicateNode.addEventListener('click', ()=>{
      if(selected<0) return;
      const base = nodes[selected];
      nodes.splice(selected+1,0,{...base,id:++uid});
      renderNodes();
    });

    deleteNode.addEventListener('click', ()=>{
      if(selected<0) return;
      nodes.splice(selected,1); clearInspector(); renderNodes();
    });

    moveUp.addEventListener('click', ()=>{
      if(selected<=0) return; const i=selected; [nodes[i-1],nodes[i]]=[nodes[i],nodes[i-1]]; selected=i-1; renderNodes();
    });
    moveDown.addEventListener('click', ()=>{
      if(selected<0 || selected>=nodes.length-1) return; const i=selected; [nodes[i],nodes[i+1]]=[nodes[i+1],nodes[i]]; selected=i+1; renderNodes();
    });

    [expectedVolume].forEach(el=>el.addEventListener('input', renderNodes));
    nodeType.addEventListener('change', showFlowActions);

    pushToCalc.addEventListener('click', ()=>{ switchTab('calc'); });

    // Initial render
    calc();
    renderNodes();
  
