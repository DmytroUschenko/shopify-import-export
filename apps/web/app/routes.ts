import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("auth/*", "routes/auth.$.tsx"),
  route("entities", "routes/entities._index.tsx"),
  route("import", "routes/import._index.tsx"),
] satisfies RouteConfig;