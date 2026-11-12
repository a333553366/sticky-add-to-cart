import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import {
  authenticate,
  MONTHLY_PLAN,
  ANNUAL_PLAN,
} from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin, billing } = await authenticate.admin(request);

  let hasActivePayment = false;
  let settings = {
    enabled: true,
    position: "bottom",
    bgColor: "#ffffff",
    textColor: "#111213",
    btnColor: "#008060",
    btnTextColor: "#ffffff",
    btnText: "Add to Cart",
  };

  let previewProduct = {
    title: "Preview Product",
    price: "$19.99",
    compareAtPrice: null,
    imageUrl: null,
  };

  // 1. 检查正式订阅状态（真实收费模式 isTest: false）
  try {
    if (billing && typeof billing.check === "function") {
      const billingCheck = await billing.check({
        plans: [MONTHLY_PLAN, ANNUAL_PLAN],
        isTest: false,
      });
      hasActivePayment = Boolean(billingCheck?.hasActivePayment);
    }
  } catch (billingErr) {
    console.warn("Billing check bypassed:", billingErr?.message || billingErr);
  }

  // 2. 查询 Metafield 设置 + 店铺真实商品（保持 2.2.1 合规）
  try {
    const response = await admin.graphql(`
      #graphql
      query getStickySettingsAndProduct {
        currentAppInstallation {
          metafield(namespace: "sticky_cart", key: "settings") {
            value
          }
        }
        products(first: 1) {
          nodes {
            id
            title
            featuredImage {
              url
              altText
            }
            variants(first: 1) {
              nodes {
                price
                compareAtPrice
              }
            }
          }
        }
      }
    `);

    const resJson = await response.json();
    const rawValue = resJson?.data?.currentAppInstallation?.metafield?.value;
    if (rawValue) {
      settings = { ...settings, ...JSON.parse(rawValue) };
    }

    const realProduct = resJson?.data?.products?.nodes?.[0];
    if (realProduct) {
      const variant = realProduct.variants?.nodes?.[0];
      previewProduct = {
        title: realProduct.title || "Preview Product",
        price: variant?.price ? `$${variant.price}` : "$19.99",
        compareAtPrice: variant?.compareAtPrice ? `$${variant.compareAtPrice}` : null,
        imageUrl: realProduct.featuredImage?.url || null,
      };
    }
  } catch (err) {
    console.error("GraphQL query error:", err);
  }

  return Response.json({ settings, previewProduct, hasActivePayment });
};

export const action = async ({ request }) => {
  const { admin, billing, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  // 1. 发起正式订阅（真实扣费 isTest: false）
  if (actionType === "subscribe") {
    try {
      const planType = formData.get("planType");
      const selectedPlan = planType === "annual" ? ANNUAL_PLAN : MONTHLY_PLAN;
      const returnUrl = `https://${session.shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`;

      await billing.request({
        session,
        plan: selectedPlan,
        isTest: false,
        returnUrl,
      });
    } catch (error) {
      if (error instanceof Response) {
        const redirectUrl =
          error.headers.get("X-Shopify-API-Request-Failure-Reauthorize-Url") ||
          error.headers.get("Location");

        if (redirectUrl) {
          return Response.json({ confirmationUrl: redirectUrl });
        }
        throw error;
      }
      throw error;
    }
  }

  // 2. 保存插件配置
  try {
    const payload = {
      enabled: formData.get("enabled") === "true",
      position: formData.get("position") || "bottom",
      bgColor: formData.get("bgColor") || "#ffffff",
      textColor: formData.get("textColor") || "#111213",
      btnColor: formData.get("btnColor") || "#008060",
      btnTextColor: formData.get("btnTextColor") || "#ffffff",
      btnText: formData.get("btnText") || "Add to Cart",
    };

    const appRes = await admin.graphql(`
      #graphql
      query getAppInstallationId {
        currentAppInstallation {
          id
        }
      }
    `);
    const appData = await appRes.json();
    const ownerId = appData?.data?.currentAppInstallation?.id;

    if (ownerId) {
      const setResult = await admin.graphql(
        `#graphql
        mutation setStickySettings($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              key
              value
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            metafields: [
              {
                ownerId: ownerId,
                namespace: "sticky_cart",
                key: "settings",
                type: "json",
                value: JSON.stringify(payload),
              },
            ],
          },
        }
      );
      const setJson = await setResult.json();
      const userErrors = setJson?.data?.metafieldsSet?.userErrors;
      if (userErrors && userErrors.length > 0) {
        return Response.json({ success: false, error: userErrors[0].message });
      }
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ success: false, error: err?.message });
  }
};

export default function StickyCartIndex() {
  const { settings, previewProduct, hasActivePayment } = useLoaderData();
  const fetcher = useFetcher();

  const [enabled, setEnabled] = useState(Boolean(settings?.enabled ?? true));
  const [position, setPosition] = useState(settings?.position || "bottom");
  const [bgColor, setBgColor] = useState(settings?.bgColor || "#ffffff");
  const [textColor, setTextColor] = useState(settings?.textColor || "#111213");
  const [btnColor, setBtnColor] = useState(settings?.btnColor || "#008060");
  const [btnTextColor, setBtnTextColor] = useState(settings?.btnTextColor || "#ffffff");
  const [btnText, setBtnText] = useState(settings?.btnText || "Add to Cart");

  const [toastMsg, setToastMsg] = useState("");

  const isSaving =
    fetcher.state === "submitting" && fetcher.formData?.get("actionType") === "save";
  const submittingPlan =
    fetcher.state === "submitting" && fetcher.formData?.get("actionType") === "subscribe"
      ? fetcher.formData?.get("planType")
      : null;

  useEffect(() => {
    if (fetcher.data?.success) {
      setToastMsg("Settings successfully saved!");
      const timer = setTimeout(() => setToastMsg(""), 3500);
      return () => clearTimeout(timer);
    } else if (fetcher.data?.error) {
      setToastMsg(`Error saving settings: ${fetcher.data.error}`);
    }
  }, [fetcher.data]);

  useEffect(() => {
    if (fetcher.data?.confirmationUrl) {
      if (window.top) {
        window.top.location.href = fetcher.data.confirmationUrl;
      } else {
        window.location.href = fetcher.data.confirmationUrl;
      }
    }
  }, [fetcher.data]);

  const handleSave = () => {
    const data = new FormData();
    data.append("actionType", "save");
    data.append("enabled", String(enabled));
    data.append("position", position);
    data.append("bgColor", bgColor);
    data.append("textColor", textColor);
    data.append("btnColor", btnColor);
    data.append("btnTextColor", btnTextColor);
    data.append("btnText", btnText);

    fetcher.submit(data, { method: "post" });
  };

  const handleSubscribe = (planType) => {
    const data = new FormData();
    data.append("actionType", "subscribe");
    data.append("planType", planType);

    fetcher.submit(data, { method: "post" });
  };

  const textInputStyle = {
    flex: 1,
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid #c9cccf",
    fontSize: "14px",
    boxSizing: "border-box",
  };

  const colorInputStyle = {
    width: "42px",
    height: "36px",
    border: "none",
    cursor: "pointer",
    background: "none",
  };

  return (
    <div style={{ padding: "32px", minHeight: "100vh", backgroundColor: "#f6f6f7", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#202223" }}>
      <div style={{ maxWidth: "880px", margin: "0 auto" }}>
        
        <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: "700", margin: "0 0 4px 0" }}>Sticky Add to Cart</h1>
            <p style={{ fontSize: "13px", color: "#6d7175", margin: 0 }}>Configure your floating add-to-cart bar to boost conversions.</p>
          </div>
          <button 
            type="button"
            onClick={handleSave} 
            disabled={isSaving}
            style={{ 
              backgroundColor: isSaving ? "#8c9196" : "#008060", 
              color: "#ffffff", 
              border: "none", 
              padding: "10px 24px", 
              borderRadius: "6px", 
              fontSize: "14px", 
              fontWeight: "600", 
              cursor: isSaving ? "not-allowed" : "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
            }}
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>

        {toastMsg && (
          <div style={{ padding: "12px 16px", backgroundColor: fetcher.data?.error ? "#fbeae5" : "#e3f1df", border: `1px solid ${fetcher.data?.error ? "#e0b3b2" : "#9bc995"}`, borderRadius: "6px", marginBottom: "20px", color: fetcher.data?.error ? "#bf0711" : "#1a5e18", fontSize: "14px", fontWeight: "500" }}>
            {toastMsg}
          </div>
        )}

        {/* 双订阅计划展示区：月付 $39 / 年付 $289 */}
        <div style={{ background: "#ffffff", borderRadius: "8px", padding: "20px", border: "1px solid #e1e3e5", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: hasActivePayment ? "0" : "18px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: "700", margin: 0 }}>Subscription Plan</h2>
                <span style={{ 
                  backgroundColor: hasActivePayment ? "#c3e6cb" : "#e4e5e7", 
                  color: hasActivePayment ? "#155724" : "#202223", 
                  fontSize: "11px", 
                  fontWeight: "600", 
                  padding: "2px 8px", 
                  borderRadius: "10px",
                }}>
                  {hasActivePayment ? "Pro Active" : "Free Plan"}
                </span>
              </div>
              <p style={{ fontSize: "13px", color: "#6d7175", margin: 0 }}>
                {hasActivePayment 
                  ? "Your Pro subscription is active. Enjoy full customization and priority support." 
                  : "Upgrade to Pro to unlock full bar positioning, custom brand colors, and unlimited conversions."}
              </p>
            </div>
          </div>

          {!hasActivePayment && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
              {/* 1. 月付选项：$39 */}
              <div style={{ border: "1px solid #e1e3e5", borderRadius: "6px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: "600", margin: "0 0 6px 0" }}>Monthly Plan</h3>
                  <div style={{ fontSize: "22px", fontWeight: "700", color: "#202223", marginBottom: "6px" }}>
                    $39 <span style={{ fontSize: "13px", color: "#6d7175", fontWeight: "normal" }}>/ month</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#6d7175", margin: 0 }}>Billed every 30 days. Cancel anytime.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSubscribe("monthly")}
                  disabled={Boolean(submittingPlan)}
                  style={{
                    marginTop: "16px",
                    backgroundColor: "#008060",
                    color: "#ffffff",
                    border: "none",
                    padding: "9px 14px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: submittingPlan ? "not-allowed" : "pointer",
                  }}
                >
                  {submittingPlan === "monthly" ? "Redirecting..." : "Subscribe Monthly ($39/mo)"}
                </button>
              </div>

              {/* 2. 年付选项：$289 */}
              <div style={{ border: "2px solid #008060", borderRadius: "6px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", backgroundColor: "#fbfdfa" }}>
                <span style={{ position: "absolute", top: "-10px", right: "12px", backgroundColor: "#008060", color: "#ffffff", fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "10px", textTransform: "uppercase" }}>
                  Save ~38%
                </span>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: "600", margin: "0 0 6px 0" }}>Annual Plan</h3>
                  <div style={{ fontSize: "22px", fontWeight: "700", color: "#202223", marginBottom: "6px" }}>
                    $289 <span style={{ fontSize: "13px", color: "#6d7175", fontWeight: "normal" }}>/ year</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#6d7175", margin: 0 }}>$24.08/mo equivalent. Billed once per year.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSubscribe("annual")}
                  disabled={Boolean(submittingPlan)}
                  style={{
                    marginTop: "16px",
                    backgroundColor: "#008060",
                    color: "#ffffff",
                    border: "none",
                    padding: "9px 14px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: submittingPlan ? "not-allowed" : "pointer",
                  }}
                >
                  {submittingPlan === "annual" ? "Redirecting..." : "Subscribe Annual ($289/yr)"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live Preview */}
        <div style={{ background: "#ffffff", borderRadius: "8px", padding: "20px", border: "1px solid #e1e3e5", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ fontSize: "12px", fontWeight: "700", margin: 0, color: "#6d7175", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Live Preview ({position === "bottom" ? "Bottom" : "Top"})
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: enabled ? "#008060" : "#8c9196",
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  fontSize: "12px",
                  color: enabled ? "#008060" : "#8c9196",
                  fontWeight: "600",
                }}
              >
                {enabled ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          <div style={{ 
            backgroundColor: bgColor, 
            color: textColor, 
            padding: "16px 24px", 
            borderRadius: "8px", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between", 
            border: "1px solid #e1e3e5", 
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            transition: "all 0.2s ease",
            gap: "16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", overflow: "hidden" }}>
              {previewProduct.imageUrl && (
                <img 
                  src={previewProduct.imageUrl} 
                  alt={previewProduct.title} 
                  style={{ width: "44px", height: "44px", objectFit: "cover", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }} 
                />
              )}
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontWeight: "700", fontSize: "15px", marginBottom: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "360px" }}>
                  {previewProduct.title}
                </div>
                <div style={{ fontSize: "14px", opacity: 0.85, fontWeight: "500" }}>
                  {previewProduct.price}
                  {previewProduct.compareAtPrice && (
                    <span style={{ textDecoration: "line-through", fontSize: "12px", opacity: 0.7, marginLeft: "6px" }}>
                      {previewProduct.compareAtPrice}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <button 
              type="button" 
              style={{ 
                backgroundColor: btnColor, 
                color: btnTextColor, 
                border: "none", 
                padding: "12px 28px", 
                borderRadius: "6px", 
                fontWeight: "700", 
                cursor: "pointer", 
                fontSize: "14px",
                whiteSpace: "nowrap",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                flexShrink: 0,
              }}
            >
              {btnText || "Add to Cart"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          
          <div style={{ background: "#ffffff", borderRadius: "8px", padding: "20px", border: "1px solid #e1e3e5" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "600", margin: "0 0 16px 0" }}>General Settings</h3>
            
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}>
                <input 
                  type="checkbox" 
                  checked={enabled} 
                  onChange={(e) => setEnabled(e.target.checked)} 
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                Enable Sticky Bar
              </label>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "6px", color: "#4a4c4e" }}>Position</label>
              <select 
                value={position} 
                onChange={(e) => setPosition(e.target.value)} 
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #c9cccf", fontSize: "14px" }}
              >
                <option value="bottom">Bottom of screen</option>
                <option value="top">Top of screen</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "6px", color: "#4a4c4e" }}>Button Text</label>
              <input 
                type="text" 
                value={btnText} 
                onChange={(e) => setBtnText(e.target.value)} 
                placeholder="e.g. Add to Cart" 
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #c9cccf", fontSize: "14px", boxSizing: "border-box" }} 
              />
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: "8px", padding: "20px", border: "1px solid #e1e3e5" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "600", margin: "0 0 16px 0" }}>Colors</h3>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "6px", color: "#4a4c4e" }}>Bar Background</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={colorInputStyle} />
                <input type="text" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={textInputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "6px", color: "#4a4c4e" }}>Text Color</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} style={colorInputStyle} />
                <input type="text" value={textColor} onChange={(e) => setTextColor(e.target.value)} style={textInputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "6px", color: "#4a4c4e" }}>Button Background</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="color" value={btnColor} onChange={(e) => setBtnColor(e.target.value)} style={colorInputStyle} />
                <input type="text" value={btnColor} onChange={(e) => setBtnColor(e.target.value)} style={textInputStyle} />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "6px", color: "#4a4c4e" }}>Button Text Color</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="color" value={btnTextColor} onChange={(e) => setBtnTextColor(e.target.value)} style={colorInputStyle} />
                <input type="text" value={btnTextColor} onChange={(e) => setBtnTextColor(e.target.value)} style={textInputStyle} />
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}