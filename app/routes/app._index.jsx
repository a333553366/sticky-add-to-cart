import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  let settings = {
    enabled: true,
    position: "bottom",
    bgColor: "#ffffff",
    textColor: "#111213",
    btnColor: "#008060",
    btnTextColor: "#ffffff",
    btnText: "Add to Cart",
  };

  try {
    const response = await admin.graphql(`
      #graphql
      query getStickySettings {
        currentAppInstallation {
          metafield(namespace: "sticky_cart", key: "settings") {
            value
          }
        }
      }
    `);
    const json = await response.json();
    const rawValue = json?.data?.currentAppInstallation?.metafield?.value;
    if (rawValue) {
      settings = { ...settings, ...JSON.parse(rawValue) };
    }
  } catch (err) {
    console.error("Metafield query error:", err);
  }

  return { settings };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

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
        return { success: false, error: userErrors[0].message };
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message };
  }
};

export default function StickyCartIndex() {
  const { settings } = useLoaderData();
  const fetcher = useFetcher();

  const [enabled, setEnabled] = useState(Boolean(settings?.enabled ?? true));
  const [position, setPosition] = useState(settings?.position || "bottom");
  const [bgColor, setBgColor] = useState(settings?.bgColor || "#ffffff");
  const [textColor, setTextColor] = useState(settings?.textColor || "#111213");
  const [btnColor, setBtnColor] = useState(settings?.btnColor || "#008060");
  const [btnTextColor, setBtnTextColor] = useState(settings?.btnTextColor || "#ffffff");
  const [btnText, setBtnText] = useState(settings?.btnText || "Add to Cart");

  const [toastMsg, setToastMsg] = useState("");

  const isSaving = fetcher.state === "submitting";

  useEffect(() => {
    if (fetcher.data?.success) {
      setToastMsg("Settings successfully saved!");
      const timer = setTimeout(() => setToastMsg(""), 3500);
      return () => clearTimeout(timer);
    } else if (fetcher.data?.error) {
      setToastMsg(`Error saving settings: ${fetcher.data.error}`);
    }
  }, [fetcher.data]);

  const handleSave = () => {
    const data = new FormData();
    data.append("enabled", String(enabled));
    data.append("position", position);
    data.append("bgColor", bgColor);
    data.append("textColor", textColor);
    data.append("btnColor", btnColor);
    data.append("btnTextColor", btnTextColor);
    data.append("btnText", btnText);

    fetcher.submit(data, { method: "post" });
  };

  return (
    <div style={{ padding: "32px", minHeight: "100vh", backgroundColor: "#f6f6f7", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#202223" }}>
      <div style={{ maxWidth: "880px", margin: "0 auto" }}>
        
        {/* Top Header */}
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
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
            }}
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>

        {/* Feedback Alert */}
        {toastMsg && (
          <div style={{ padding: "12px 16px", backgroundColor: fetcher.data?.error ? "#fbeae5" : "#e3f1df", border: `1px solid ${fetcher.data?.error ? "#e0b3b2" : "#9bc995"}`, borderRadius: "6px", marginBottom: "20px", color: fetcher.data?.error ? "#bf0711" : "#1a5e18", fontSize: "14px", fontWeight: "500" }}>
            {toastMsg}
          </div>
        )}

        {/* Live Preview */}
        <div style={{ background: "#ffffff", borderRadius: "8px", padding: "20px", border: "1px solid #e1e3e5", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ fontSize: "12px", fontWeight: "700", margin: 0, color: "#6d7175", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Live Preview ({position === "bottom" ? "Bottom" : "Top"})
            </h3>
            <span style={{ fontSize: "12px", color: enabled ? "#008060" : "#8c9196", fontWeight: "600" }}>
              {enabled ? "● Active" : "○ Inactive"}
            </span>
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
            transition: "all 0.2s ease"
          }}>
            <div>
              <div style={{ fontWeight: "700", fontSize: "15px", marginBottom: "3px" }}>Sample Premium Product</div>
              <div style={{ fontSize: "14px", opacity: 0.85, fontWeight: "500" }}>$49.99 <span style={{ textDecoration: "line-through", fontSize: "12px", opacity: 0.7, marginLeft: "6px" }}>$69.99</span></div>
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
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
              }}
            >
              {btnText || "Add to Cart"}
            </button>
          </div>
        </div>

        {/* Settings Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          
          {/* General Settings */}
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

          {/* Color Settings */}
          <div style={{ background: "#ffffff", borderRadius: "8px", padding: "20px", border: "1px solid #e1e3e5" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "600", margin: "0 0 16px 0" }}>Colors</h3>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "6px", color: "#4a4c4e" }}>Bar Background</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={{ width: "42px", height: "36px", border: "none", cursor: "pointer", background: "none" }} />
                <input type="text" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #c9cccf", fontSize: "14px" }} />
              </div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "6px", color: "#4a4c4e" }}>Text Color</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} style={{ width: "42px", height: "36px", border: "none", cursor: "pointer", background: "none" }} />
                <input type="text" value={textColor} onChange={(e) => setTextColor(e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #c9cccf", fontSize: "14px" }} />
              </div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "6px", color: "#4a4c4e" }}>Button Background</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="color" value={btnColor} onChange={(e) => setBtnColor(e.target.value)} style={{ width: "42px", height: "36px", border: "none", cursor: "pointer", background: "none" }} />
                <input type="text" value={btnColor} onChange={(e) => setBtnColor(e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #c9cccf", fontSize: "14px" }} />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "500", marginBottom: "6px", color: "#4a4c4e" }}>Button Text Color</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input type="color" value={btnTextColor} onChange={(e) => setBtnTextColor(e.target.value)} style={{ width: "42px", height: "36px", border: "none", cursor: "pointer", background: "none" }} />
                <input type="text" value={btnTextColor} onChange={(e) => setBtnTextColor(e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #c9cccf", fontSize: "14px" }} />
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}