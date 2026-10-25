export const meta = () => {
  return [
    { title: "Privacy Policy - Sticky Add to Cart" },
    { name: "description", content: "Privacy Policy for Sticky Add to Cart Shopify App" },
  ];
};

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: "800px", margin: "40px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif", lineHeight: "1.6", color: "#333" }}>
      <h1 style={{ borderBottom: "1px solid #eee", paddingBottom: "10px" }}>Privacy Policy</h1>
      <p style={{ color: "#666" }}>Last updated: October 25, 2026</p>

      <h2>1. Overview</h2>
      <p>
        Sticky Add to Cart (&quot;the App&quot;) provides a persistent add-to-cart bar for Shopify merchants. We are committed to protecting the privacy and security of your store and customer data.
      </p>

      <h2>2. Information We Collect</h2>
      <p>
        When you install the App, we only access information strictly necessary to provide the service:
      </p>
      <ul>
        <li><strong>Merchant Information:</strong> Store domain, email, and access tokens for API authorization.</li>
        <li><strong>Storefront Data:</strong> Product catalog identifiers and basic configuration settings (such as custom colors and button text) selected by the merchant.</li>
        <li><strong>Customer Data:</strong> The App does not collect, track, sell, or store personal personally identifiable information (PII) of your end shoppers.</li>
      </ul>

      <h2>3. How We Use Information</h2>
      <p>
        We use the collected store details solely to authenticate the App, store your widget customization preferences, and render the sticky bar on your storefront.
      </p>

      <h2>4. Data Retention and Deletion</h2>
      <p>
        We honor Shopify compliance standards, including mandatory data privacy webhooks:
      </p>
      <ul>
        <li>When a customer or merchant requests data deletion, we purge all associated metadata within the required timeframes.</li>
        <li>When you uninstall the App, your store access tokens and settings are removed from our active database.</li>
      </ul>

      <h2>5. Contact Us</h2>
      <p>
        If you have questions or concerns about this privacy policy, please contact our support team at:
        <br />
        <strong>Email:</strong> support@stickyaddtocart.com
      </p>
    </div>
  );
}