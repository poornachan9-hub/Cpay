const TABLE = "crypto_payments";
const REQUEST_TIMEOUT_MS = 5000;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({
      status: "error",
      configuration: "missing",
      reachable: false,
      authenticated: null,
      databaseRead: false,
    });
  }

  let endpoint;
  try {
    endpoint = new URL(
      `/rest/v1/${TABLE}?select=tx_hash&limit=1`,
      supabaseUrl
    );
    if (!["http:", "https:"].includes(endpoint.protocol)) throw new Error();
  } catch {
    return res.status(503).json({
      status: "error",
      configuration: "invalid",
      reachable: false,
      authenticated: null,
      databaseRead: false,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.ok) {
      return res.status(200).json({
        status: "ok",
        configuration: "configured",
        reachable: true,
        authenticated: true,
        databaseRead: true,
      });
    }

    const error = response.status === 401
      ? "Supabase rejected the configured key."
      : response.status === 403
        ? `Read access to ${TABLE} was denied.`
        : response.status === 404
          ? `${TABLE} is unavailable; check that its migration was applied.`
          : "The Supabase read check failed.";

    return res.status(503).json({
      status: "error",
      configuration: "configured",
      reachable: true,
      authenticated: response.status === 401 ? false : null,
      databaseRead: false,
      error,
    });
  } catch {
    return res.status(503).json({
      status: "error",
      configuration: "configured",
      reachable: false,
      authenticated: null,
      databaseRead: false,
      error: controller.signal.aborted
        ? "Supabase request timed out."
        : "Could not reach Supabase.",
    });
  } finally {
    clearTimeout(timeout);
  }
}