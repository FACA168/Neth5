// app.js - 完整版（无框架，纯原生）
window.appData = {
  currentPhone: '',
  currentVoucherCode: ''
};

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
}

function formatPhone(phone) {
  const p = String(phone);
  return p.length === 11 ? p.substring(0, 3) + '****' + p.substring(7) : p;
}

async function applySettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('加载设置失败');
    const data = await res.json();
    document.getElementById('navSiteName').textContent = data.site_name || '充值中心';
    document.title = data.site_name || '充值中心';
    document.getElementById('announcementText').textContent = data.announcement || '';
    const logoPlaceholder = document.getElementById('navLogoPlaceholder');
    if (data.logo_url) {
      logoPlaceholder.innerHTML = `<img src="${data.logo_url}" style="width:38px;height:38px;border-radius:8px;object-fit:contain;" alt="logo">`;
    } else {
      logoPlaceholder.textContent = '⛽';
    }
    const bannerWrap = document.getElementById('homeBanner');
    if (data.banner_url) {
      bannerWrap.innerHTML = `<img src="${data.banner_url}" alt="Banner">`;
    } else {
      bannerWrap.innerHTML = '<span class="banner-placeholder">🎉 品牌充值 · 代金券限时领</span>';
    }
    const csLink = document.getElementById('csLinkResult');
    const csName = data.cs_name || '在线客服';
    const csLinkHref = data.cs_link || '#';
    csLink.textContent = '💬 联系' + csName;
    csLink.href = csLinkHref;
    if (csLinkHref === '#') {
      csLink.onclick = (e) => { e.preventDefault(); showToast('客服链接暂未设置'); };
    } else {
      csLink.onclick = null;
    }
    const qrDisplay = document.getElementById('qrDisplay');
    const method = qrDisplay.getAttribute('data-payment') || 'wechat';
    const qrData = method === 'wechat' ? data.wechat_qr_url : data.alipay_qr_url;
    if (qrData) {
      qrDisplay.innerHTML = `<img src="${qrData}" alt="收款码" style="width:100%;height:100%;object-fit:contain;">`;
    } else {
      qrDisplay.innerHTML = `<span class="qr-placeholder">请在后台设置${method === 'wechat' ? '微信' : '支付宝'}收款码</span>`;
    }
  } catch (err) {
    console.error('applySettings error:', err);
    showToast('加载站点设置失败');
  }
}

window.claimVoucher = async function() {
  const phoneInput = document.getElementById('inputPhone');
  const phone = phoneInput.value.trim().replace(/\D/g, '');
  phoneInput.value = phone;
  if (phone.length !== 11 || phone[0] !== '1') {
    const err = document.getElementById('phoneError');
    err.textContent = '请输入有效的11位手机号码';
    err.classList.add('visible');
    phoneInput.classList.add('input-error');
    phoneInput.focus();
    return;
  }
  document.getElementById('phoneError').classList.remove('visible');
  phoneInput.classList.remove('input-error');
  const btnClaim = document.getElementById('btnClaim');
  const btnNext = document.getElementById('btnNext');
  btnClaim.disabled = true;
  btnClaim.textContent = '⏳ 正在查询…';
  document.getElementById('voucherStatusArea').innerHTML = '<span style="color:var(--warning);font-size:13px;">🟡 正在查询…</span>';
  btnNext.disabled = true;
  try {
    const res = await fetch('/api/voucher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    if (!res.ok) throw new Error('查询失败');
    const data = await res.json();
    window.appData.currentPhone = phone;
    window.appData.currentVoucherCode = data.code;
    document.getElementById('voucherStatusArea').innerHTML = `<span style="color:var(--success);font-size:13px;font-weight:700;">🟢 券码：${data.code}</span>`;
    btnNext.disabled = false;
    showToast('✅ 代金券领取成功！');
  } catch (err) {
    document.getElementById('voucherStatusArea').innerHTML = `<span style="color:red;font-size:13px;">❌ ${err.message}</span>`;
    showToast('❌ ' + err.message);
  } finally {
    btnClaim.disabled = false;
    btnClaim.textContent = '🎫 立即领取电子代金券';
  }
};

window.goToHome = function() {
  showPage('pageHome');
  document.getElementById('inputPhone').value = '';
  document.getElementById('phoneError').classList.remove('visible');
  document.getElementById('inputPhone').classList.remove('input-error');
  document.getElementById('voucherStatusArea').innerHTML = '<span style="color:var(--text-light);font-size:13px;">🟡 等待操作中…</span>';
  document.getElementById('btnNext').disabled = true;
  window.appData.currentPhone = '';
  window.appData.currentVoucherCode = '';
};

window.goToRecharge = function() {
  if (!window.appData.currentPhone || !window.appData.currentVoucherCode) {
    showToast('请先在首页领取代金券');
    return;
  }
  document.getElementById('rechargePhone').value = window.appData.currentPhone;
  document.getElementById('rechargeVoucherCode').value = window.appData.currentVoucherCode;
  document.getElementById('rechargeContact').value = '';
  document.querySelectorAll('#amountOptions .amount-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('calcAmount').textContent = '¥0';
  document.getElementById('calcDiscount').textContent = '-¥0';
  document.getElementById('calcActual').textContent = '¥0';
  document.getElementById('uploadPreview').style.display = 'none';
  document.getElementById('uploadArea').classList.remove('has-image');
  document.querySelector('#uploadArea .upload-icon').style.display = 'block';
  document.querySelector('#uploadArea .upload-text').textContent = '点击上传付款截图';
  document.getElementById('qrDisplay').setAttribute('data-payment', 'wechat');
  document.querySelectorAll('#pageRecharge .qr-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  applySettings();
  showPage('pageRecharge');
};

window.selectAmount = function(card) {
  document.querySelectorAll('#amountOptions .amount-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  const amount = parseInt(card.getAttribute('data-amount'), 10);
  const discount = parseInt(card.getAttribute('data-discount'), 10);
  document.getElementById('calcAmount').textContent = '¥' + amount;
  document.getElementById('calcDiscount').textContent = '-¥' + discount;
  document.getElementById('calcActual').textContent = '¥' + (amount - discount);
};

window.switchPayment = function(method, btn) {
  document.querySelectorAll('#pageRecharge .qr-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('qrDisplay').setAttribute('data-payment', method);
  applySettings();
};

window.handleUpload = function(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('图片大小不能超过5MB');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('uploadPreview');
    preview.src = e.target.result;
    preview.style.display = 'block';
    document.getElementById('uploadArea').classList.add('has-image');
    document.querySelector('#uploadArea .upload-icon').style.display = 'none';
    document.querySelector('#uploadArea .upload-text').textContent = '点击更换截图';
  };
  reader.readAsDataURL(file);
  input.value = '';
};

window.submitOrder = async function() {
  const phone = document.getElementById('rechargePhone').value;
  const contact = document.getElementById('rechargeContact').value.trim();
  const selectedCard = document.querySelector('#amountOptions .amount-card.selected');
  const uploadPreview = document.getElementById('uploadPreview');
  if (!contact) { showToast('请填写联系人姓名'); return; }
  if (!selectedCard) { showToast('请选择充值金额'); return; }
  if (!uploadPreview.src || uploadPreview.style.display === 'none') { showToast('请上传付款截图'); return; }
  const amount = parseInt(selectedCard.getAttribute('data-amount'), 10);
  const discount = parseInt(selectedCard.getAttribute('data-discount'), 10);
  const actual = amount - discount;
  const paymentMethod = document.getElementById('qrDisplay').getAttribute('data-payment') || 'wechat';
  const voucherCode = document.getElementById('rechargeVoucherCode').value;
  const payload = {
    phone, contact, voucherCode,
    rechargeAmount: amount, voucherDiscount: discount, actualPay: actual,
    paymentMethod, screenshotBase64: uploadPreview.src
  };
  try {
    const res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || '提交失败');
    showToast('✅ 订单提交成功！订单号：' + result.orderId);
    const fakeOrder = {
      id: result.orderId, phone, voucherCode,
      rechargeAmount: amount, voucherDiscount: discount, actualPay: actual,
      status: 'processing'
    };
    showResultPage(fakeOrder);
  } catch (err) {
    showToast('❌ 提交失败：' + err.message);
  }
};

function showResultPage(order) {
  document.getElementById('resOrderId').textContent = order.id;
  document.getElementById('resPhone').textContent = formatPhone(order.phone);
  document.getElementById('resVoucherCode').textContent = order.voucherCode;
  document.getElementById('resAmount').textContent = '¥' + order.rechargeAmount;
  document.getElementById('resDiscount').textContent = '-¥' + order.voucherDiscount;
  document.getElementById('resActual').textContent = '¥' + order.actualPay;
  document.getElementById('resStatusCell').innerHTML = '<span class="status-badge status-processing">🟡 处理中……</span>';
  document.getElementById('resultIcon').textContent = '⏳';
  document.getElementById('resultStatus').textContent = '🟡 处理中……';
  showPage('pageResult');
}

// ---------- 后台管理 ----------
var siteNameElement = document.getElementById('navSiteName');
var clickCount = 0;
var clickTimer = null;
siteNameElement.addEventListener('click', function() {
  clickCount++;
  if (clickCount === 1) {
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clickCount = 0; }, 2000);
  }
  if (clickCount >= 5) {
    clearTimeout(clickTimer);
    clickCount = 0;
    showPage('pageAdmin');
    showToast('🔐 已进入后台管理');
  }
});

window.adminLogin = async function() {
  const pwd = document.getElementById('adminPasswordInput').value.trim();
  if (!pwd) { showToast('请输入密码'); return; }
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '登录失败');
    }
    document.getElementById('adminLoginArea').style.display = 'none';
    document.getElementById('adminContentArea').style.display = 'block';
    loadAdminData();
    showToast('✅ 登录成功');
  } catch (err) {
    showToast('❌ ' + err.message);
  }
};

window.adminLogout = function() {
  document.getElementById('adminLoginArea').style.display = 'block';
  document.getElementById('adminContentArea').style.display = 'none';
};

function loadAdminData() {
  renderOrderTable();
  loadQRSettings();
  loadServiceSettings();
  loadSiteSettings();
}

window.switchAdminTab = function(tabName, btn) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('adminPanel' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
  if (panel) panel.classList.add('active');
  if (tabName === 'orders') renderOrderTable();
  if (tabName === 'qrcodes') loadQRSettings();
  if (tabName === 'service') loadServiceSettings();
  if (tabName === 'site') loadSiteSettings();
};

async function renderOrderTable(filterText) {
  filterText = (filterText || '').toLowerCase();
  const tbody = document.getElementById('orderTableBody');
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) throw new Error('加载订单失败');
    let orders = await res.json();
    if (filterText) {
      orders = orders.filter(o => o.id.toLowerCase().includes(filterText) || o.phone.includes(filterText));
    }
    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-light);padding:16px;">暂无订单</td></tr>';
      return;
    }
    tbody.innerHTML = orders.map(o => {
      const badgeClass = o.status === 'processing' ? 'badge-processing' : (o.status === 'failed' ? 'badge-failed' : 'badge-success');
      const statusText = o.status === 'processing' ? '🟡 处理中' : (o.status === 'failed' ? '🔴 失败' : '🟢 成功');
      return `<tr>
        <td title="${o.id}">${o.id.substring(0, 10)}…</td>
        <td>${formatPhone(o.phone)}</td>
        <td>${o.voucher_code}</td>
        <td>¥${o.recharge_amount}</td>
        <td>¥${o.actual_pay}</td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
        <td>
          <button class="btn btn-sm btn-outline" style="font-size:11px;padding:5px 10px;" onclick="viewPaymentScreenshot('${o.id}')">查看凭证</button>
          <select onchange="changeOrderStatus('${o.id}', this.value)" style="font-size:11px;padding:5px;border-radius:6px;border:1px solid var(--border);">
            <option value="">修改状态</option>
            <option value="processing">处理中</option>
            <option value="failed">充值失败</option>
            <option value="success">充值成功</option>
          </select>
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:red;">加载失败: ${err.message}</td></tr>`;
  }
}

window.searchOrders = function() {
  renderOrderTable(document.getElementById('orderSearchInput').value.trim());
};

window.viewPaymentScreenshot = function(orderId) {
  fetch('/api/orders')
    .then(res => res.json())
    .then(orders => {
      const order = orders.find(o => o.id === orderId);
      if (!order || !order.payment_screenshot_url) { showToast('暂无凭证'); return; }
      document.getElementById('modalImage').src = order.payment_screenshot_url;
      document.getElementById('modalOverlay').style.display = 'flex';
    })
    .catch(() => showToast('加载凭证失败'));
};

window.changeOrderStatus = async function(orderId, newStatus) {
  if (!newStatus) return;
  try {
    const res = await fetch('/api/order', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId, status: newStatus })
    });
    if (!res.ok) throw new Error('更新失败');
    showToast('✅ 订单状态已更新');
    renderOrderTable(document.getElementById('orderSearchInput').value.trim());
  } catch (err) {
    showToast('❌ ' + err.message);
  }
};

function loadQRSettings() {
  fetch('/api/settings')
    .then(res => res.json())
    .then(data => {
      const w = data.wechat_qr_url;
      const a = data.alipay_qr_url;
      const wPrev = document.getElementById('wechatQRPreview');
      const aPrev = document.getElementById('alipayQRPreview');
      if (w) {
        wPrev.src = w;
        wPrev.style.display = 'inline-block';
        document.getElementById('wechatQRStatus').textContent = '已设置';
      } else {
        wPrev.style.display = 'none';
        document.getElementById('wechatQRStatus').textContent = '未设置';
      }
      if (a) else {

