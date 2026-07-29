// netlify/functions/api.js
// Netlify Functions v2 格式（ESM）
// 所有写库操作都通过本函数完成，前端不持有 API key
// 后端使用 Appwrite（不再用 Supabase）
import { Client, Databases, ID, Query } from 'node-appwrite';

const endpoint = process.env.APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID;

// 集合 ID（必须和 Appwrite 后台建的 Collection ID 完全一致）
const SETTINGS_COLL = 'settings';
const VOUCHERS_COLL = 'vouchers';
const ORDERS_COLL = 'orders';
const SETTINGS_ID = 'settings_1'; // 设置用固定文档 ID，方便 upsert

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);
const databases = new Databases(client);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    status
  });
}

export default async (req, context) => {
  try {
    if (!endpoint || !projectId || !apiKey || !databaseId) {
      return json({ error: '环境变量未配置（APPWRITE_*）' }, 500);
    }

    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // CORS 预检
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    // ===== 领取/查询代金券 =====
    if (method === 'POST' && path === '/api/voucher') {
      const { phone } = await req.json();
      if (!phone || phone.length !== 11) return json({ error: '手机号格式错误' }, 400);
      const list = await databases.listDocuments(databaseId, VOUCHERS_COLL, [
        Query.equal('phone', phone)
      ]);
      let code;
      if (list.documents.length) {
        code = list.documents[0].code;
      } else {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        code = 'OC-';
        for (let i = 0; i < 10; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        await databases.createDocument(databaseId, VOUCHERS_COLL, ID.unique(), {
          phone, code, status: 'active'
        });
      }
      return json({ code });
    }

    // ===== 读取站点设置 =====
    if (method === 'GET' && path === '/api/settings') {
      try {
        const doc = await databases.getDocument(databaseId, SETTINGS_COLL, SETTINGS_ID);
        return json(doc);
      } catch (e) {
        return json({}); // 还没设置过就返回空
      }
    }

    // ===== 保存站点设置（不存在则新建，存在则更新）=====
    if (method === 'POST' && path === '/api/settings') {
      const body = await req.json();
      let exists = false;
      try {
        await databases.getDocument(databaseId, SETTINGS_COLL, SETTINGS_ID);
        exists = true;
      } catch (e) { /* 不存在 */ }
      if (exists) {
        await databases.updateDocument(databaseId, SETTINGS_COLL, SETTINGS_ID, body);
      } else {
        await databases.createDocument(databaseId, SETTINGS_COLL, ID.custom(SETTINGS_ID), body);
      }
      return json({ success: true });
    }

    // ===== 提交订单 =====
    if (method === 'POST' && path === '/api/order') {
      const b = await req.json();
      const orderId = 'ORD' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
      await databases.createDocument(databaseId, ORDERS_COLL, ID.custom(orderId), {
        phone: b.phone,
        voucher_code: b.voucherCode,
        recharge_amount: b.rechargeAmount,
        voucher_discount: b.voucherDiscount,
        actual_pay: b.actualPay,
        payment_method: b.paymentMethod,
        payment_screenshot_url: b.screenshotBase64,
        status: 'processing',
        contact: b.contact
      });
      return json({ orderId, success: true });
    }

    // ===== 订单列表 =====
    if (method === 'GET' && path === '/api/orders') {
      const list = await databases.listDocuments(databaseId, ORDERS_COLL, [
        Query.orderDesc('$createdAt')
      ]);
      // 把 Appwrite 的 $id 映射成前端用的 id
      const rows = list.documents.map(d => ({ id: d.$id, ...d }));
      return json(rows);
    }

    // ===== 修改订单状态 =====
    if (method === 'PATCH' && path === '/api/order') {
      const b = await req.json();
      await databases.updateDocument(databaseId, ORDERS_COLL, b.id, { status: b.status });
      return json({ success: true });
    }

    // ===== 后台登录 =====
    if (method === 'POST' && path === '/api/admin/login') {
      const { password } = await req.json();
      let doc;
      try {
        doc = await databases.getDocument(databaseId, SETTINGS_COLL, SETTINGS_ID);
      } catch (e) {
        return json({ error: '密码错误' }, 401);
      }
      if (!doc.admin_password || doc.admin_password !== password) {
        return json({ error: '密码错误' }, 401);
      }
      return json({ success: true });
    }

    return json({ error: 'Not Found' }, 404);
  } catch (err) {
    return json({ error: '服务器错误: ' + (err.message || err) }, 500);
  }
};
