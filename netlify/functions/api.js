// netlify/functions/api.js — Netlify Functions v2（ESM）
import { Client, Databases, ID, Query } from 'node-appwrite';

const SETTINGS_COLL='settings',VOUCHERS_COLL='vouchers',ORDERS_COLL='orders',SETTINGS_ID='settings_1';

function json(d,s=200){return new Response(JSON.stringify(d),{headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'},status:s});}

function getClient(){
 const ep=process.env.APPWRITE_ENDPOINT,pj=process.env.APPWRITE_PROJECT_ID,ak=process.env.APPWRITE_API_KEY,db=process.env.APPWRITE_DATABASE_ID;
 if(!ep||!pj||!ak||!db)return null;
 const c=new Client().setEndpoint(ep).setProject(pj).setKey(ak);
 return {db:new Databases(c),databaseId:db};
}

export default async(req,ctx)=>{
 try{
  const aw=getClient();if(!aw)return json({error:'环境变量未配置'},500);
  const {db,databaseId}=aw,url=new URL(req.url),path=url.pathname,method=req.method;
  if(method==='OPTIONS')return new Response(null,{headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
  // 领券
  if(method==='POST'&&path==='/api/voucher'){
   const{phone}=await req.json();if(!phone||phone.length!==11)return json({error:'手机号格式错误'},400);
   const list=await db.listDocuments(databaseId,VOUCHERS_COLL,[Query.equal('phone',phone)]);
   let code;code=list.documents.length?list.documents[0].code:(()=>'yh'+Array.from({length:10},()=>('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')[Math.floor(Math.random()*36)]).join(''))();
   if(!list.documents.length)await db.createDocument(databaseId,VOUCHERS_COLL,ID.unique(),{phone,code,status:'active'});
   return json({code});
  }
  // 读设置（不返回密码明文，只暴露是否已设密码）
  if(method==='GET'&&path==='/api/settings'){try{const d=await db.getDocument(databaseId,SETTINGS_COLL,SETTINGS_ID);const out={...d};delete out.admin_password;out.has_password=!!d.admin_password;return json(out);}catch(e){return json({has_password:false});}}
  // 存设置
  if(method==='POST'&&path==='/api/settings'){
   const body=await req.json();let ex=false;try{await db.getDocument(databaseId,SETTINGS_COLL,SETTINGS_ID);ex=true;}catch(e){}
   if(ex)await db.updateDocument(databaseId,SETTINGS_COLL,SETTINGS_ID,body);else await db.createDocument(databaseId,SETTINGS_COLL,ID.custom(SETTINGS_ID),body);
   return json({success:true});
  }
  // 提交订单
  if(method==='POST'&&path==='/api/order'){
   const b=await req.json(),orderId='yj'+Date.now().toString().slice(-8)+Math.floor(Math.random()*90+10);
   await db.createDocument(databaseId,ORDERS_COLL,ID.custom(orderId),{phone:b.phone,voucher_code:b.voucherCode,recharge_amount:b.rechargeAmount,voucher_discount:b.voucherDiscount,actual_pay:b.actualPay,payment_method:b.paymentMethod,payment_screenshot_url:b.screenshotBase64,status:'processing',contact:b.contact});
   return json({orderId,success:true});
  }
  // 订单列表
  if(method==='GET'&&path==='/api/orders'){const list=await db.listDocuments(databaseId,ORDERS_COLL,[Query.orderDesc('$createdAt')]);return json(list.documents.map(d=>({id:d.$id,...d})));}
  // 改状态
  if(method==='PATCH'&&path==='/api/order'){const b=await req.json();await db.updateDocument(databaseId,ORDERS_COLL,b.id,{status:b.status});return json({success:true});}
  // 后台登录
  if(method==='POST'&&path==='/api/admin/login'){
   const{password}=await req.json();let doc;try{doc=await db.getDocument(databaseId,SETTINGS_COLL,SETTINGS_ID);}catch(e){return json({error:'密码错误'},401);}
   if(!doc.admin_password||doc.admin_password!==password)return json({error:'密码错误'},401);
   return json({success:true});
  }
  return json({error:'Not Found'},404);
 }catch(err){return json({error:'服务器错误: '+(err.message||err)},500);}
};
