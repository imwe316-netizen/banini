(() => {
    const PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='800' height='600' fill='%23e2e8f0'/%3E%3Ctext x='400' y='310' fill='%2394a3b8' font-family='system-ui' font-size='24' text-anchor='middle' font-weight='700'%3E이미지 준비중%3C/text%3E%3C/svg%3E`;

    function getKSTNow() { return new Date(Date.now() + 9 * 3600 * 1000); }
    const pad = n => String(n).padStart(2, '0');
    function formatKST(d) { const days = ['일', '월', '화', '수', '목', '금', '토']; return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} (${days[d.getUTCDay()]}) ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`; }
    const formatPrice = n => (n || 0).toLocaleString('ko-KR') + '원';

    let uploadedThumbs = [];
    let uploadedDetails = [];
    let editingProductId = null;

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

    async function loadOrders() {
        try {
            const res = await fetch('/api/orders');
            if (!res.ok) throw new Error('Failed to load orders');
            return await res.json();
        } catch (err) {
            console.error(err);
            showToast('주문 정보를 불러오는데 실패했습니다.');
            return [];
        }
    }

    function startClock() {
        const tick = () => {
            const debugEl = document.getElementById('kstDebug');
            if (debugEl) debugEl.innerHTML = `현재 시스템 시간(KST): ${formatKST(getKSTNow())}`;
            if (document.getElementById('admin-dashboard').classList.contains('active')) {
                updateDashboardSchedule();
            }
        }; tick(); setInterval(tick, 1000);
    }

    function formatDDayString(diffMs) {
        const days = Math.floor(diffMs / (24 * 3600 * 1000));
        const rem = diffMs % (24 * 3600 * 1000);
        const hours = Math.floor(rem / (3600 * 1000));
        const mins = Math.floor((rem % (3600 * 1000)) / (60 * 1000));
        const secs = Math.floor((rem % (60 * 1000)) / 1000);

        if (days > 0) {
            return `<span style="color:inherit">${days}일</span> ${hours}시간 ${mins}분 ${secs}초`;
        }
        return `${hours}시간 ${mins}분 ${secs}초`;
    }

    async function updateDashboardSchedule() {
        const card = document.getElementById('nextScheduleCard');
        if (!card) return;

        const products = await loadProducts();
        const now = getKSTNow().getTime();
        const activeProd = products.find(p => now >= p.startDate && now <= p.endDate);

        if (activeProd) {
            const diff = activeProd.endDate - now;
            const timeStr = formatDDayString(diff);

            card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <span class="badge badge-success" style="margin-bottom:6px">진행중 공구</span>
          <h4 style="margin:4px 0; font-size:16px; font-weight:800;">${activeProd.name}</h4>
          <p style="margin:2px 0 0; font-size:13px; color:var(--muted)">마감일시: ${formatKST(new Date(activeProd.endDate))}</p>
        </div>
        <div style="text-align:right">
          <div style="font-size:12px; color:var(--danger); font-weight:700">마감까지 남은 시간</div>
          <div style="font-size:22px; font-weight:800; color:var(--danger); font-variant-numeric:tabular-nums">${timeStr}</div>
        </div>
      </div>
    `;
            return;
        }

        const upcomingProd = products.filter(p => p.startDate > now).sort((a, b) => a.startDate - b.startDate)[0];

        if (upcomingProd) {
            const diff = upcomingProd.startDate - now;
            const timeStr = formatDDayString(diff);

            card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <span class="badge badge-gray" style="margin-bottom:6px">오픈 대기중</span>
          <h4 style="margin:4px 0; font-size:16px; font-weight:800;">${upcomingProd.name}</h4>
          <p style="margin:2px 0 0; font-size:13px; color:var(--muted)">시작일시: ${formatKST(new Date(upcomingProd.startDate))}</p>
        </div>
        <div style="text-align:right">
          <div style="font-size:12px; color:var(--primary); font-weight:700">오픈까지 남은 시간</div>
          <div style="font-size:22px; font-weight:800; color:var(--primary); font-variant-numeric:tabular-nums">${timeStr}</div>
        </div>
      </div>
    `;
            return;
        }

        card.innerHTML = `
    <div style="text-align:center; color:var(--muted); padding:4px 0; font-size:14px;">
      💡 예정되거나 진행 중인 공구 일정이 없습니다. <strong>'제품등록'</strong> 탭에서 새 상품의 공구 기간을 등록해 주세요.
    </div>
  `;
    }

    function setupImageUpload(inputEl, previewEl, counterEl, storageArr, maxCount) {
        if (!inputEl) return;
        inputEl.addEventListener('change', async e => {
            const files = Array.from(e.target.files);
            const available = maxCount - storageArr.length;
            const toAdd = files.slice(0, available);

            for (const file of toAdd) {
                const data = await new Promise(res => {
                    const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file);
                });
                storageArr.push(data);
            }
            inputEl.value = '';
            renderPreviews(previewEl, counterEl, storageArr, maxCount);
        });
    }

    function renderPreviews(previewEl, counterEl, storageArr, maxCount) {
        if (!previewEl) return;
        previewEl.innerHTML = '';
        counterEl.textContent = `${storageArr.length}/${maxCount}`;

        storageArr.forEach((data, idx) => {
            const div = document.createElement('div'); div.className = 'preview-item';
            div.innerHTML = `<img src="${data}"><button type="button" class="preview-remove">×</button>`;
            div.querySelector('button').onclick = () => {
                storageArr.splice(idx, 1);
                renderPreviews(previewEl, counterEl, storageArr, maxCount);
            };
            previewEl.appendChild(div);
        });
    }

    document.getElementById('productForm').addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(e.target);

        const yStart = fd.get('startYear'), mStart = String(fd.get('startMonth')).padStart(2, '0'), dStart = String(fd.get('startDay')).padStart(2, '0');
        const yEnd = fd.get('endYear'), mEnd = String(fd.get('endMonth')).padStart(2, '0'), dEnd = String(fd.get('endDay')).padStart(2, '0');

        const startDate = new Date(`${yStart}-${mStart}-${dStart}T00:00:00`).getTime();
        const endDate = new Date(`${yEnd}-${mEnd}-${dEnd}T23:59:59`).getTime();

        const pData = {
            category: fd.get('category'),
            name: fd.get('name').trim(),
            originalPrice: Number(fd.get('originalPrice')),
            salePrice: Number(fd.get('salePrice')),
            costPrice: Number(fd.get('costPrice')),
            specVol: fd.get('specVol').trim(),
            specMat: fd.get('specMat').trim(),
            specColor: fd.get('specColor').trim(),
            specQty: fd.get('specQty').trim(),
            startDate, endDate,
            thumbs: uploadedThumbs.length ? [...uploadedThumbs] : [PLACEHOLDER],
            details: uploadedDetails.length ? [...uploadedDetails] : [PLACEHOLDER]
        };

        try {
            let res;
            if (editingProductId) {
                res = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'update', id: editingProductId, product: pData })
                });
                if (!res.ok) throw new Error('Failed to update product');
                showToast('상품 정보가 수정되었습니다.');
            } else {
                pData.id = 'p' + Date.now();
                pData.createdAt = Date.now();
                res = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'create', product: pData })
                });
                if (!res.ok) throw new Error('Failed to create product');
                showToast('신규 제품이 등록되었습니다.');
            }

            resetForm();
            renderAdminAll();
        } catch (err) {
            console.error(err);
            showToast('저장에 실패했습니다. 다시 시도해 주세요.');
        }
    });

    function resetForm() {
        document.getElementById('productForm').reset();
        uploadedThumbs = []; uploadedDetails = [];
        renderPreviews(document.getElementById('thumbPreviews'), document.getElementById('thumbCounter'), uploadedThumbs, 5);
        renderPreviews(document.getElementById('detailPreviews'), document.getElementById('detailCounter'), uploadedDetails, 15);
        editingProductId = null;
        updateLabels('생활용품');
        document.getElementById('productSubmitBtn').textContent = '제품 등록하기';
        document.getElementById('cancelEditBtn').style.display = 'none';
    }
    document.getElementById('cancelEditBtn').onclick = resetForm;

    async function renderProductList(products) {
        const tbody = document.querySelector('#adminProductListTable tbody'); if (!tbody) return;
        const now = getKSTNow().getTime();

        tbody.innerHTML = products.map(p => {
            let status = '예정', badge = 'badge-gray';
            if (now >= p.startDate && now <= p.endDate) { status = '진행중'; badge = 'badge-success'; }
            else if (now > p.endDate) { status = '종료'; badge = 'badge-warning'; }
            return `<tr>
      <td><strong>${p.name}</strong> <span class="badge badge-gray" style="font-size:10px;padding:2px 6px;margin-left:4px">${p.category || '생활용품'}</span></td>
      <td>${formatPrice(p.salePrice)}</td>
      <td>${formatPrice(p.costPrice)}</td>
      <td>썸네일 ${p.thumbs?.length || 0}장 / 상세 ${p.details?.length || 0}장</td>
      <td><span class="badge ${badge}">${status}</span></td>
      <td>
        <button class="btn-secondary" style="padding:4px 8px;font-size:12px" onclick="editProduct('${p.id}')">수정</button>
        <button class="btn-secondary" style="padding:4px 8px;font-size:12px;color:var(--danger)" onclick="deleteProduct('${p.id}')">삭제</button>
      </td>
    </tr>`;
        }).join('') || `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--muted)">등록된 상품이 없습니다.</td></tr>`;
    }

    window.editProduct = async function (id) {
        const products = await loadProducts();
        const p = products.find(x => x.id === id); if (!p) return;
        editingProductId = id;
        const form = document.getElementById('productForm');

        form.category.value = p.category || '생활용품';
        updateLabels(p.category || '생활용품');
        form.name.value = p.name;
        form.originalPrice.value = p.originalPrice;
        form.salePrice.value = p.salePrice;
        form.costPrice.value = p.costPrice;
        form.specVol.value = p.specVol || '';
        form.specMat.value = p.specMat || '';
        form.specColor.value = p.specColor || '';
        form.specQty.value = p.specQty || '';

        const sD = new Date(p.startDate);
        form.startYear.value = sD.getFullYear(); form.startMonth.value = sD.getMonth() + 1; form.startDay.value = sD.getDate();
        const eD = new Date(p.endDate);
        form.endYear.value = eD.getFullYear(); form.endMonth.value = eD.getMonth() + 1; form.endDay.value = eD.getDate();

        uploadedThumbs = [...(p.thumbs || [])].filter(x => x !== PLACEHOLDER);
        uploadedDetails = [...(p.details || [])].filter(x => x !== PLACEHOLDER);

        renderPreviews(document.getElementById('thumbPreviews'), document.getElementById('thumbCounter'), uploadedThumbs, 5);
        renderPreviews(document.getElementById('detailPreviews'), document.getElementById('detailCounter'), uploadedDetails, 15);

        document.getElementById('productSubmitBtn').textContent = '수정 완료';
        document.getElementById('cancelEditBtn').style.display = 'inline-block';
        document.querySelector('[data-view="register"]').click();
    };

    window.deleteProduct = async function (id) {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', id })
            });
            if (!res.ok) throw new Error('Failed to delete product');
            showToast('상품이 삭제되었습니다.');
            resetForm();
            renderAdminAll();
        } catch (err) {
            console.error(err);
            showToast('삭제에 실패했습니다.');
        }
    };

    async function renderDashboard(products, orders) {
        const now = getKSTNow().getTime();

        // 총 매출 (모든 주문의 매출액 합산)
        const totalSales = orders.reduce((sum, o) => {
            const p = products.find(x => x.id === o.productId); return sum + (p ? p.salePrice * o.qty : 0);
        }, 0);

        document.getElementById('dash-sales').textContent = formatPrice(totalSales);
        document.getElementById('dash-active').textContent = products.filter(p => now >= p.startDate && now <= p.endDate).length + '개';
        document.getElementById('dash-pending').textContent = orders.filter(o => o.status === '입금확인중').length + '건';

        // 현재 진행중 공구 상품에 한해, 상태가 '입금완료'인 실구매 총수량 계산
        const activeProduct = products.find(p => now >= p.startDate && now <= p.endDate);
        let totalQty = 0;
        if (activeProduct) {
            totalQty = orders
                .filter(o => o.productId === activeProduct.id && o.status === '입금완료')
                .reduce((sum, o) => sum + o.qty, 0);
        }
        document.getElementById('dash-qty').textContent = totalQty + '개';

        updateDashboardSchedule();
    }

    function renderAdminPast(products) {
        const now = getKSTNow().getTime();
        const past = products.filter(p => p.endDate < now);
        const tbody = document.querySelector('#adminPastTable tbody'); if (!tbody) return;

        tbody.innerHTML = past.map(p => {
            const s = new Date(p.startDate), e = new Date(p.endDate);
            return `<tr><td>${p.name}</td><td>${s.getMonth() + 1}/${s.getDate()}~${e.getMonth() + 1}/${e.getDate()}</td><td>${formatPrice(p.salePrice)}</td><td>${formatPrice(p.costPrice)}</td><td>0</td><td><span class="badge badge-warning">종료</span></td></tr>`;
        }).join('') || `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--muted)">종료된 공구가 없습니다.</td></tr>`;
    }

    window.toggleOrderStatus = async function (id, currentStatus) {
        const nextStatus = currentStatus === '입금확인중' ? '입금완료' : '입금확인중';
        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updateStatus', id, status: nextStatus })
            });
            if (!res.ok) throw new Error('Failed to update status');
            showToast('주문 상태가 업데이트되었습니다.');
            renderAdminAll();
        } catch (err) {
            console.error(err);
            showToast('주문 상태 업데이트에 실패했습니다.');
        }
    };

    function renderAdminOrders(products, orders) {
        const tbody = document.querySelector('#adminOrdersTable tbody'); if (!tbody) return;

        tbody.innerHTML = orders.map(o => {
            const p = products.find(x => x.id === o.productId); const d = new Date(o.orderedAt);
            const statusBadge = o.status === '입금완료' ? 'badge-success' : 'badge-gray';
            return `<tr>
                <td>${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}</td>
                <td>${p ? p.name : '-'}</td>
                <td>${o.name}</td>
                <td>${o.depositor}</td>
                <td>${o.phone}</td>
                <td>${o.qty}개</td>
                <td>${p ? formatPrice(p.salePrice * o.qty) : '-'}</td>
                <td>
                    <span class="badge ${statusBadge}" style="cursor:pointer" onclick="toggleOrderStatus('${o.id}', '${o.status}')">
                        ${o.status}
                    </span>
                </td>
            </tr>`;
        }).join('') || `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--muted)">접수된 주문이 없습니다.</td></tr>`;
    }

    function renderSettle(products, orders) {
        const tbody = document.querySelector('#settleTable tbody'); if (!tbody) return;
        let totalProfit = 0;

        tbody.innerHTML = products.map(p => {
            const productOrders = orders.filter(o => o.productId === p.id && o.status === '입금완료');
            const qty = productOrders.reduce((sum, o) => sum + o.qty, 0);
            const sales = qty * p.salePrice;
            const profit = qty * (p.salePrice - p.costPrice);
            totalProfit += profit;

            return `<tr>
                <td><strong>${p.name}</strong></td>
                <td>${qty}개</td>
                <td>${formatPrice(sales)}</td>
                <td>${formatPrice(profit)}</td>
            </tr>`;
        }).join('') || `<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--muted)">데이터가 없습니다.</td></tr>`;

        document.getElementById('totalProfit').textContent = formatPrice(totalProfit);
    }

    function showToast(msg) { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }

    async function renderAdminAll() {
        const products = await loadProducts();
        const orders = await loadOrders();

        renderDashboard(products, orders);
        renderAdminPast(products);
        renderAdminOrders(products, orders);
        renderSettle(products, orders);
        renderProductList(products);
    }

    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
            const view = btn.dataset.view; 
            document.querySelectorAll('.admin-view').forEach(v => v.classList.toggle('active', v.id === `admin-${view}`));

            const products = await loadProducts();
            const orders = await loadOrders();
            if (view === 'dashboard') renderDashboard(products, orders); 
            if (view === 'past') renderAdminPast(products); 
            if (view === 'orders') renderAdminOrders(products, orders); 
            if (view === 'settle') renderSettle(products, orders); 
            if (view === 'register') renderProductList(products);
        });
    });

    function populateDates() {
        const now = new Date(); const years = [2025, 2026, 2027, 2028, 2029, 2030];
        ['start', 'end'].forEach(prefix => {
            const y = document.querySelector(`select[name="${prefix}Year"]`);
            const m = document.querySelector(`select[name="${prefix}Month"]`);
            const d = document.querySelector(`select[name="${prefix}Day"]`);
            if (!y || !m || !d) return;
            years.forEach(yr => { const o = document.createElement('option'); o.value = yr; o.textContent = yr + '년'; if (yr === now.getFullYear()) o.selected = true; y.appendChild(o); });
            for (let i = 1; i <= 12; i++) { const o = document.createElement('option'); o.value = i; o.textContent = i + '월'; if (i === (now.getMonth() + 1)) o.selected = true; m.appendChild(o); }
            for (let i = 1; i <= 31; i++) { const o = document.createElement('option'); o.value = i; o.textContent = i + '일'; if (i === now.getDate()) o.selected = true; d.appendChild(o); }
        });
    }

    const mMenu = document.getElementById('mMenu');
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.getElementById('adminOverlay');
    if (mMenu) {
        mMenu.onclick = () => { sidebar.classList.toggle('open'); overlay.classList.toggle('show'); };
        overlay.onclick = () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); };
    }

    function updateLabels(category) {
        const vol = document.getElementById('label-specVol');
        const mat = document.getElementById('label-specMat');
        const col = document.getElementById('label-specColor');
        if (!vol || !mat || !col) return;

        if (category === '식품' || category === '건강기능식품') {
            vol.textContent = '중량 *';
            mat.textContent = '원산지 *';
            col.textContent = '제품종류 *';
        } else {
            vol.textContent = '용량 *';
            mat.textContent = '소재 *';
            col.textContent = '색상 *';
        }
    }

    function checkAuth() {
        if (sessionStorage.getItem('admin_authenticated') === 'true') {
            return true;
        }
        const pw = prompt('관리자 비밀번호를 입력하세요:');
        if (pw === '4664') {
            sessionStorage.setItem('admin_authenticated', 'true');
            return true;
        } else {
            alert('비밀번호가 올바르지 않습니다.');
            location.href = 'index.html';
            return false;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.body.style.display = 'none';
        if (!checkAuth()) return;
        document.body.style.display = '';

        populateDates(); startClock(); renderAdminAll();
        
        const catSelect = document.querySelector('select[name="category"]');
        if (catSelect) {
            catSelect.addEventListener('change', (e) => {
                updateLabels(e.target.value);
            });
            updateLabels(catSelect.value);
        }
        
        setupImageUpload(document.getElementById('thumbImagesInput'), document.getElementById('thumbPreviews'), document.getElementById('thumbCounter'), uploadedThumbs, 5);
        setupImageUpload(document.getElementById('detailImagesInput'), document.getElementById('detailPreviews'), document.getElementById('detailCounter'), uploadedDetails, 15);
    });
})();
