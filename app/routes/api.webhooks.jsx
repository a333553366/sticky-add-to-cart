import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  let topic, shop, session;

  try {
    // 1. 进行 HMAC 签名与身份验证
    // 如果签名无效（例如 Shopify 测试机器人的伪造请求），authenticate.webhook 会抛出异常
    const authResult = await authenticate.webhook(request);
    topic = authResult.topic;
    shop = authResult.shop;
    session = authResult.session;
  } catch (error) {
    // 💡 关键修复：签名验证失败时，显式返回 401 Unauthorized（满足 Shopify HMAC 校验规范）
    console.error("Webhook authentication failed:", error);
    return new Response("Unauthorized", { status: 401 });
  }

  // 如果没有 shop 信息，也返回 401
  if (!shop) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. 处理特定的 Webhook Topic
  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) {
        // 可以在这里清理 Session
      }
      break;

    // 强制性合规 Webhook（客户数据请求、客户数据删除、店铺数据删除）
    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
    case "SHOP_REDACT":
      return new Response(null, { status: 200 });

    default:
      // 对于其他未专门定义的 Topic，返回 200 OK，决不返回 404
      return new Response("Webhook received", { status: 200 });
  }

  return new Response(null, { status: 200 });
};