// ============================================================
// 充值中心 · 前端逻辑（纯 JS，无框架）
// 所有写库请求都走 /api/* （Netlify Functions 持有 service_role key）
// 与 index.html 元素 ID、netlify/functions/api.js 接口严格对齐
// ============================================================

// 全局状态
let currentPhone = '';        // 当前领券手机号
let currentVoucherCode = '';   // 当前代金券码
let selectedAmount = 0;        // 选中的充值金额
let selectedDiscount = 0;      // 选中的立减金额
let currentPayment = 'wechat'; // 当前收款方式
let screenshotBase64 = '';     // 付款截图 base64
let settings = {};             // 站点设置（含收款码、客服、Logo 等）
let adminLoggedIn = false;     // 后台是否已登录
let allOrders = [];            // 订单列表缓存（用于搜索）

// ---------- 基础工具 ----------

// 弹出居中提示
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 1800);
}

// 统一请求封装
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* 空响应忽略 */ }
  if (!res.ok) {
    throw new Error(data.error || ('请求失败(' + res.status + ')'));
  }
  return data;
}

// 切换显示的页面（首页/充值/结果/后台）
function switchPage(pageId) {
  ['pageHome', 'pageRecharge', 'pageResult', 'pageAdmin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', id === pageId);
  });
  window.scrollTo(0, 0);
}

// 返回首页
function goToHome() {
  switchPage('pageHome');
}

// ---------- 首页：领券 ----------

function claimVoucher() {
  const phoneEl = document.getElementById('inputPhone');
  const phone = (phoneEl.value || '').trim();
  const errEl = document.getElementById('phoneError');
  const btn = document.getElementById('btnClaim');
  const statusEl = document.getElementById('voucherStatusArea');
  const nextBtn = document.getElementById('btnNext');

  // 校验 11 位手机号
  if (!/^1\d{10}$/.test(phone)) {
    errEl.classList.add('visible');
    phoneEl.classList.add('input-error');
    return;
  }
  errEl.classList.remove('visible');
  phoneEl.classList.remove('input-error');

  btn.disabled = true;
  statusEl.innerHTML = '<span class="status-dot"></span>正在领取代金券…';

  api('/api/voucher', {
    method: 'POST',
    body: JSON.stringify({ phone })
  })
    .then(data => {
      currentPhone = phone;
      currentVoucherCode = data.code;
      statusEl.innerHTML = '✅ 代金券已绑定：<b>' + data.code + '</b>';
      nextBtn.disabled = false;
      toast('领取成功');
    })
    .catch(err => {
      statusEl.textContent = '❌ ' + err.message;
      toast('领取失败');
    })
    .finally(() => { btn.disabled = false; });
}

// ---------- 充值页 ----------

// 进入充值页并回填手机号/券码
function goToRecharge() {
  document.getElementById('rechargePhone').value = currentPhone;
  document.getElementById('rechargeVoucherCode').value = currentVoucherCode;
  switchPage('pageRecharge');
}

// 选择金额卡片
function selectAmount(el) {
  document.querySelectorAll('#amountOptions .amount-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedAmount = parseInt(el.dataset.amount, 10) || 0;
  selectedDiscount = parseInt(el.dataset.discount, 10) || 0;
  updateCalc();
}

// 更新金额计算框
function updateCalc() {
  document.getElementById('calcAmount').textContent = '¥' + selectedAmount;
  document.getElementById('calcDiscount').textContent = '-¥' + selectedDiscount;
  document.getElementById('calcActual').textContent = '¥' + (selectedAmount - selectedDiscount);
}

// 切换收款方式并渲染对应收款码
function switchPayment(method, el) {
  currentPayment = method;
  document.querySelectorAll('.qr-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderQR();
}

// 根据当前收款方式渲染收款码
function renderQR() {
  const box = document.querySelector('.qr-box');
  if (!box) return;
  const url = currentPayment === 'wechat' ? settings.wechat_qr_url : settings.alipay_qr_url;
  if (url) {
    box.innerHTML = '<img src="' + url + '" alt="收款码" style="max-width:100%;max-height:100%">';
  } else {
    box.innerHTML = '<span class="qr-placeholder">请在后台设置收款码</span>';
  }
}

// 选择付款截图
function handleUpload(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    screenshotBase64 = e.target.result; // data URL（含前缀）
    const preview = document.getElementById('uploadPreview');
    preview.src = screenshotBase64;
    preview.style.display = 'block';
    document.getElementById('uploadArea').classList.add('has-image');
  };
  reader.readAsDataURL(file);
}

// 提交订单
function submitOrder() {
  if (!selectedAmount) {
    toast('请选择充值金额');
    return;
  }
  if (!screenshotBase64) {
    toast('请上传付款截图');
    return;
  }
  const contact = (document.getElementById('rechargeContact').value || '').trim();
  const btn = document.querySelector('#pageRecharge .btn-primary');
  if (btn) btn.disabled = true;

  api('/api/order', {
    method: 'POST',
    body: JSON.stringify({
      phone: currentPhone,
      voucherCode: currentVoucherCode,
      rechargeAmount: selectedAmount,
      voucherDiscount: selectedDiscount,
      actualPay: selectedAmount - selectedDiscount,
      paymentMethod: currentPayment,
      screenshotBase64: screenshotBase64,
      contact: contact
    })
  })
    .then(data => {
      showResultPage({
        orderId: data.orderId,
        phone: currentPhone,
        voucherCode: currentVoucherCode,
        amount: selectedAmount,
        discount: selectedDiscount,
        actual: selectedAmount - selectedDiscount,
        status: 'processing'
      });
    })
    .catch(err => {
      toast('提交失败：' + err.message);
      if (btn) btn.disabled = false;
    });
}

// 展示订单结果页
function showResultPage(o) {
  document.getElementById('resOrderId').textContent = o.orderId;
  document.getElementById('resPhone').textContent = o.phone;
  document.getElementById('resVoucherCode').textContent = o.voucherCode;
  document.getElementById('resAmount').textContent = '¥' + o.amount;
  document.getElementById('resDiscount').textContent = '-¥' + o.discount;
  document.getElementById('resActual').textContent = '¥' + o.actual;
  setResultStatus(o.status);
  switchPage('pageResult');
  toast('订单已提交');

  // 重置充值页状态，方便下次使用
  selectedAmount = 0;
  selectedDiscount = 0;
  screenshotBase64 = '';
  const preview = document.getElementById('uploadPreview');
  if (preview) { preview.style.display = 'none'; preview.src = ''; }
  document.getElementById('uploadArea').classList.remove('has-image');
  document.getElementById('rechargeContact').value = '';
  updateCalc();
}

// 设置结果页状态徽章
function setResultStatus(status) {
  const map = {
    processing: { icon: '⏳', text: '🟡 处理中……', cls: 'status-processing', label: '🟡 处理中' },
    success: { icon: '✅', text: '🟢 充值成功', cls: 'status-success', label: '🟢 成功' },
    failed: { icon: '❌', text: '🔴 充值失败', cls: 'status-failed', label: '🔴 失败' }
  };
  const s = map[status] || map.processing;
  document.getElementById('resultIcon').textContent = s.icon;
  document.getElementById('resultStatus').textContent = s.text;
  document.getElementById('resStatusCell').innerHTML =
    '<span class="status-badge ' + s.cls + '">' + s.label + '</span>';
}

// ---------- 设置加载与应用 ----------

// 初始化时拉取站点设置
async function loadSettings() {
  try {
    settings = await api('/api/settings');
  } catch (e) {
    // 失败不阻断页面，使用默认值
    settings = {};
  }
  applySettings();
}

// 把设置应用到页面各处
function applySettings() {
  const s = settings || {};
  // 顶部导航
  if (s.site_name) document.getElementById('navSiteName').textContent = s.site_name;
  if (s.logo_url) document.getElementById('navLogoPlaceholder').textContent = '';
  if (s.logo_url) {
    const logo = document.getElementById('navLogoPlaceholder');
    logo.innerHTML = '<img src="' + s.logo_url + '" style="width:20px;height:20px;object-fit:contain">';
  }
  // Banner / 公告 / 客服
  if (s.announcement) document.getElementById('announcementText').textContent = s.announcement;
  if (s.cs_name || s.cs_link) {
    const cs = document.getElementById('csLinkResult');
    cs.textContent = '💬 ' + (s.cs_name || '联系在线客服');
    if (s.cs_link && s.cs_link !== '#') cs.href = s.cs_link;
  }
  // 后台表单回填
  if (document.getElementById('csNameInput')) document.getElementById('csNameInput').value = s.cs_name || '';
  if (document.getElementById('csLinkInput')) document.getElementById('csLinkInput').value = s.cs_link || '';
  if (document.getElementById('siteNameInput')) document.getElementById('siteNameInput').value = s.site_name || '';
  if (document.getElementById('announcementInput')) document.getElementById('announcementInput').value = s.announcement || '';
  if (s.logo_url && document.getElementById('logoPreview')) {
    const p = document.getElementById('logoPreview'); p.src = s.logo_url; p.style.display = 'block';
  }
  if (s.banner_url && document.getElementById('bannerPreview')) {
    const p = document.getElementById('bannerPreview'); p.src = s.banner_url; p.style.display = 'block';
  }
  if (s.wechat_qr_url && document.getElementById('wechatQRPreview')) {
    const p = document.getElementById('wechatQRPreview'); p.src = s.wechat_qr_url; p.style.display = 'block';
  }
  if (s.alipay_qr_url && document.getElementById('alipayQRPreview')) {
    const p = document.getElementById('alipayQRPreview'); p.src = s.alipay_qr_url; p.style.display = 'block';
  }
  // 充值页收款码
  renderQR();
}

// ---------- 后台管理 ----------

function adminLogin() {
  const pwd = (document.getElementById('adminPasswordInput').value || '').trim();
  if (!pwd) { toast('请输入管理密码'); return; }
  api('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password: pwd })
  })
    .then(() => {
      adminLoggedIn = true;
      document.getElementById('adminLoginArea').style.display = 'none';
      document.getElementById('adminContentArea').style.display = 'block';
      renderOrderTable();
      toast('登录成功');
    })
    .catch(err => {
      toast('登录失败：' + err.message);
    });
}

function adminLogout() {
  adminLoggedIn = false;
  document.getElementById('adminLoginArea').style.display = 'block';
  document.getElementById('adminContentArea').style.display = 'none';
  document.getElementById('adminPasswordInput').value = '';
  switchAdminTab('orders', document.querySelector('.admin-tab'));
}

function switchAdminTab(name, el) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  const panelMap = {
    orders: 'adminPanelOrders',
    qrcodes: 'adminPanelQrcodes',
    service: 'adminPanelService',
    site: 'adminPanelSite'
  };
  const panel = document.getElementById(panelMap[name]);
  if (panel) panel.classList.add('active');
  if (el) el.classList.add('active');
  if (name === 'orders') renderOrderTable();
}

// 拉取并渲染订单表格
async function renderOrderTable() {
  const body = document.getElementById('orderTableBody');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8">加载中…</td></tr>';
  try {
    allOrders = await api('/api/orders');
  } catch (e) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#ef4444">加载失败：' + e.message + '</td></tr>';
    return;
  }
  drawOrderRows(allOrders);
}

// 根据数据绘制行
function drawOrderRows(list) {
  const body = document.getElementById('orderTableBody');
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8">暂无订单</td></tr>';
    return;
  }
  const statusText = { processing: '🟡 处理中', success: '🟢 成功', failed: '🔴 失败' };
  body.innerHTML = list.map(o => {
    return '<tr>' +
      '<td>' + esc(o.id) + '</td>' +
      '<td>' + esc(o.phone || '-') + '</td>' +
      '<td>' + esc(o.voucher_code || '-') + '</td>' +
      '<td>¥' + (o.recharge_amount || 0) + '</td>' +
      '<td>¥' + (o.actual_pay || 0) + '</td>' +
      '<td>' + (statusText[o.status] || o.status) + '</td>' +
      '<td>' +
        '<button class="btn-sm" onclick="viewPaymentScreenshot(\'' + encodeURIComponent(o.payment_screenshot_url || '') + '\')">凭证</button> ' +
        '<button class="btn-sm" onclick="changeOrderStatus(\'' + o.id + '\',\'success\')">成功</button> ' +
        '<button class="btn-sm" onclick="changeOrderStatus(\'' + o.id + '\',\'failed\')">失败</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

// 搜索订单（前端过滤）
function searchOrders() {
  const kw = (document.getElementById('orderSearchInput').value || '').trim().toLowerCase();
  if (!kw) { drawOrderRows(allOrders); return; }
  const filtered = allOrders.filter(o =>
    (o.id || '').toLowerCase().includes(kw) ||
    (o.phone || '').toLowerCase().includes(kw)
  );
  drawOrderRows(filtered);
}

// 查看付款凭证（弹窗）
function viewPaymentScreenshot(url) {
  const decoded = decodeURIComponent(url || '');
  if (!decoded) { toast('无凭证图片'); return; }
  document.getElementById('modalImage').src = decoded;
  document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}

// 修改订单状态
function changeOrderStatus(id, status) {
  api('/api/order', {
    method: 'PATCH',
    body: JSON.stringify({ id: id, status: status })
  })
    .then(() => { toast('状态已更新'); renderOrderTable(); })
    .catch(err => toast('更新失败：' + err.message));
}

// 保存收款码（微信/支付宝）
function saveQRCode(type, input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const field = type === 'wechat' ? 'wechat_qr_url' : 'alipay_qr_url';
  const statusId = type === 'wechat' ? 'wechatQRStatus' : 'alipayQRStatus';
  const reader = new FileReader();
  reader.onload = e => {
    api('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ [field]: e.target.result })
    })
      .then(() => {
        settings[field] = e.target.result;
        const preview = document.getElementById(type === 'wechat' ? 'wechatQRPreview' : 'alipayQRPreview');
        if (preview) { preview.src = e.target.result; preview.style.display = 'block'; }
        document.getElementById(statusId).textContent = '✅ 已保存';
        renderQR();
        toast('收款码已保存');
      })
      .catch(err => {
        document.getElementById(statusId).textContent = '❌ ' + err.message;
      });
  };
  reader.readAsDataURL(file);
}

// 保存客服设置
function saveServiceSettings() {
  const csName = document.getElementById('csNameInput').value.trim();
  const csLink = document.getElementById('csLinkInput').value.trim();
  api('/api/settings', {
    method: 'POST',
    body: JSON.stringify({ cs_name: csName, cs_link: csLink })
  })
    .then(() => { settings.cs_name = csName; settings.cs_link = csLink; applySettings(); toast('客服设置已保存'); })
    .catch(err => toast('保存失败：' + err.message));
}

// 保存站点图片（logo / banner）
function saveSiteImage(type, input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const field = type === 'logo' ? 'logo_url' : 'banner_url';
  const reader = new FileReader();
  reader.onload = e => {
    api('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ [field]: e.target.result })
    })
      .then(() => {
        settings[field] = e.target.result;
        const preview = document.getElementById(type === 'logo' ? 'logoPreview' : 'bannerPreview');
        if (preview) { preview.src = e.target.result; preview.style.display = 'block'; }
        applySettings();
        toast('图片已保存');
      })
      .catch(err => toast('保存失败：' + err.message));
  };
  reader.readAsDataURL(file);
}

// 保存网站设置（名称/公告/管理密码）
function saveSiteSettings() {
  const siteName = document.getElementById('siteNameInput').value.trim();
  const announcement = document.getElementById('announcementInput').value.trim();
  const adminPwd = document.getElementById('adminPwdInput').value;
  const body = { site_name: siteName, announcement: announcement };
  if (adminPwd) {
    if (adminPwd.length < 4) { toast('管理密码至少4位'); return; }
    body.admin_password = adminPwd;
  }
  api('/api/settings', {
    method: 'POST',
    body: JSON.stringify(body)
  })
    .then(() => {
      settings.site_name = siteName;
      settings.announcement = announcement;
      document.getElementById('adminPwdInput').value = '';
      applySettings();
      toast('网站设置已保存');
    })
    .catch(err => toast('保存失败：' + err.message));
}

// 简单的 HTML 转义，防止 XSS
function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

// ---------- 初始化 ----------

window.addEventListener('DOMContentLoaded', () => {
  // 拉取设置（收款码/公告/客服等）
  loadSettings();

  // 连点顶部站点名 5 次进入后台
  let clickCount = 0;
  let clickTimer = null;
  const title = document.getElementById('navSiteName');
  if (title) {
    title.addEventListener('click', () => {
      clickCount++;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => { clickCount = 0; }, 2000);
      if (clickCount >= 5) {
        clickCount = 0;
        if (adminLoggedIn) {
          document.getElementById('adminContentArea').style.display = 'block';
          document.getElementById('adminLoginArea').style.display = 'none';
          renderOrderTable();
        } else {
          document.getElementById('adminLoginArea').style.display = 'block';
          document.getElementById('adminContentArea').style.display = 'none';
        }
        switchPage('pageAdmin');
      }
    });
  }

  // 默认选中第一个金额卡片（可选，这里保持未选，引导用户点击）
  updateCalc();
});
