# Appwrite 后台配置步骤

在部署 Netlify 之前，先在 Appwrite 控制台建好「数据库 + 集合 + 字段」。下面每一步对应控制台左侧菜单操作。

---

## 第 1 步：建数据库（Database）

1. 左侧菜单 → **Databases**（数据库）
2. 点 **Create database**
3. Name 填 `recharge`（随便起）
4. **Database ID** 用自动生成的，或者点右侧图标改成自定义 `recharge_db`（记住它，后面要填环境变量）
5. 记下这个 **Database ID**

---

## 第 2 步：建 3 个集合（Collection）

进入刚建的数据库，点 **Create collection** 建 3 个，**每个的 Collection ID 必须和下表完全一致**（后端代码写死了）：

| 集合名 | Collection ID（必须一致） |
|--------|---------------------------|
| 站点设置 | `settings` |
| 代金券 | `vouchers` |
| 订单 | `orders` |

> 建集合时，Collection ID 那一栏默认是一串随机 ID，点它右边的图标可以切换成「自定义」，然后手动输入 `settings` / `vouchers` / `orders`。

建好 3 个集合后，分别点进去加「字段（Attributes）」。

---

## 第 3 步：给每个集合加字段

点进集合 → **Attributes** → **Add attribute** → 选 **String** 或 **Integer**。

### 集合 `settings`
全部 **Required 都不要勾（选 No）**：

| 字段 key | 类型 | Size / 说明 |
|----------|------|-------------|
| `site_name` | String | 256 |
| `announcement` | String | 512 |
| `logo_url` | String | 100000（存 base64 图片） |
| `banner_url`chat_q
