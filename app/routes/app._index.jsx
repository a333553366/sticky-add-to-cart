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

  let previewProduct = {
    title: "Preview Product",
    price: "$19.99",
    compareAtPrice: null,
    imageUrl: null,
  };

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

    const json = await response.json();
    const rawValue = json?.data?.currentAppInstallation?.metafield?.value;
    if (rawValue) {
      settings = { ...settings, ...JSON.parse(rawValue) };
    }

    const realProduct = json?.data?.products?.nodes?.[0];
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

  return { settings, previewProduct };
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
  const { settings, previewProduct } = useLoaderData();
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
            <h1 style