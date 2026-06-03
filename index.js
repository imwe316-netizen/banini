(() => {
    const PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23e2e8f0'/%3E%3Ctext x='400' y='310' fill='%2394a3b8' font-family='system-ui' font-size='24' text-anchor='middle' font-weight='700'%3E이미지 준비중%3C/text%3E%3C/svg%3E`;

    function getKSTNow() { return new Date(Date.now() + 9 * 3600 * 1000); }
    const pad = n => String(n).padStart(2, '0');
    function formatKST(d) { const days = ['일', '월', '화', '수', '목', '금', '토']; return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} (${days[d.getUTCDay()]}) ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`; }
    const formatPrice = n => (n || 0).toLocaleString('ko-KR') + '원';

    let currentActive = null;

    function startClock() {
        const el = document.getElementById('kst-time'); if (!el) return;
        const tick = () => {
            el.textContent = formatKST(getKSTNow());
        }; tick(); setInterval(tick, 1000);
    }

    async function loadProducts() {
        try {
            const res = await fetch('/api/products');
            if (!res.ok) throw new Error('Failed to load products');
            return await res.json();
        } catch (err) {
            console.error(err);
            showToast('상품 정보를 불러오는데 실패했습니다.');
            return [];
        }
    }

    async function renderPublic() {
        const products = await loadProducts();
        const now = getKSTNow().getTime();
        const active = products.find(p => now >= p.startDate && now <= p.endDate) || products[0];
        currentActive = active;
        const container = document.getElementById('public-active');
        if (!container) return;
        if (!active) {
            container.innerHTML = `<div class="empty-state"><h3>현재 진행중인 공구가 없습니다</h3></div>`;
            return;
        }
        const discount = active.originalPrice ? Math.round((1 - active.salePrice / active.originalPrice) * 100) : 0;
        const tList = active.thumbs && active.thumbs.length ? active.thumbs : [PLACEHOLDER];
        const dList = active.details && active.details.length ? active.details : [];

        container.innerHTML = `
    <div class="product-single">
      <div class="product-main">
        <div class="product-image">
          <div class="gallery-main"><img id="mainImg" src="${tList[0]}" alt=""></div>
          <div class="gallery-thumbs" id="thumbs">${tList.map((src, i) => `<button class="thumb ${i === 0 ? 'active' : ''}" data-i="${i}"><img src="${src}"></button>`).join('')}</div>
        </div>
        <div class="product-info">
          <div>
            <h1 class="product-title">${active.name}</h1>
            <div class="price-row">
              <span class="price-original">${formatPrice(active.originalPrice)}</span>
              <span class="price-sale">${formatPrice(active.salePrice)}</span>
              ${discount > 0 ? `<span class="discount-badge">${discount}% 할인</span>` : ''}
            </div>
            
            <table class="specs-table">
              <tbody>
                <tr><th>용량</th><td>${active.specVol || '-'}</td></tr>
                <tr><th>소재</th><td>${active.specMat || '-'}</td></tr>
                <tr><th>색상</th><td>${active.specColor || '-'}</td></tr>
                <tr><th>제품구성</th><td>${active.specQty || '-'}</td></tr>
              </tbody>
            </table>
          </div>
          <button id="buyBtn" class="buy-btn">구매하기</button>
        </div>
      </div>
    </div>
    <div class="detail-section card card-pad">
      <h2 class="section-title">상품 상세 정보</h2>
      <div class="detail-images-wrap">
        ${dList.map(src => `<img src="${src}" alt="상세이미지">`).join('')}
        ${dList.length === 0 ? `<p style="color:var(--muted)">등록된 상세 이미지가 없습니다.</p>` : ''}
      </div>
    </div>
  `;

        document.querySelectorAll('#thumbs .thumb').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#thumbs .thumb').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('mainImg').src = tList[+btn.dataset.i];
            });
        });

        const buyBtn = document.getElementById('buyBtn');
        if (buyBtn) buyBtn.onclick = () => openPurchaseModal();
    }

    function openPurchaseModal() { document.getElementById('purchaseModal').classList.add('show'); }
    function closePurchaseModal() { document.getElementById('purchaseModal').classList.remove('show'); }
    window.closePurchaseModal = closePurchaseModal;

    document.getElementById('orderForm').addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        if (!currentActive) return;
        const order = {
            id: 'o' + Date.now(), productId: currentActive.id,
            name: fd.get('name').trim(), phone: fd.get('phone').trim(), address: fd.get('address').trim(),
            qty: Number(fd.get('qty')), payment: '무통장', depositor: fd.get('depositor').trim(),
            orderedAt: Date.now(), status: '입금확인중'
        };

        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', order })
            });
            if (!res.ok) throw new Error('Order submission failed');
            
            closePurchaseModal(); 
            e.target.reset(); 
            showToast('주문이 접수되었습니다');
        } catch (err) {
            console.error(err);
            showToast('주문 처리에 실패했습니다. 다시 시도해 주세요.');
        }
    });

    async function renderPastPublic() {
        const products = await loadProducts();
        const now = getKSTNow().getTime();
        const past = products.filter(p => p.endDate < now);
        const grid = document.getElementById('pastCardsGrid'); if (!grid) return;
        grid.innerHTML = past.map(p => `<div class="past-card"><div class="past-card-img"><img src="${p.thumbs?.[0] || PLACEHOLDER}"></div><div class="past-card-body"><div class="past-card-name">${p.name}</div><div class="past-card-price">${formatPrice(p.salePrice)}</div></div></div>`).join('') || `<p style="color:var(--muted);grid-column:1/-1;text-align:center;padding:4px">지난 공구 내역이 없습니다.</p>`;
    }

    function showToast(msg) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }

    document.querySelectorAll('.subnav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.subnav-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
            const tab = btn.dataset.tab; document.getElementById('public-active').hidden = tab !== 'active'; document.getElementById('public-past').hidden = tab !== 'past';
            if (tab === 'past') renderPastPublic();
        });
    });

    document.addEventListener('DOMContentLoaded', () => {
        startClock(); renderPublic();
    });
})();
