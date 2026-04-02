import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * Splat route — catches all /auth/* paths.
 * authenticate.admin() handles the token exchange OAuth flow and redirects
 * back to the app once the session is established.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return null;
}
