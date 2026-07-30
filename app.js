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
   while(dataUrl.length>60000&&quality>0.3){quality-=0.1;dataUrl}
  document.getElementById('upload
