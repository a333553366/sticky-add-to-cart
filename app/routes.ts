import { index, route, layout } from "@react-router/dev/routes";

export default [
  index("routes/_index.jsx"),
  layout("routes/app.jsx", [
    route("app", "routes/app._index.jsx"),
  ]),
  route("privacy", "routes/privacy.jsx"),
  route("api/webhooks", "routes/api.webhooks.jsx"),
];