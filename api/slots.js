const { createClient } = require("@supabase/supabase-js");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });

  const date = req.query?.date || new URL(req.url, "http://localhost").searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json(res, 400, { ok: false, error: "Missing or invalid date" });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("reservations")
      .select("time")
      .eq("date", date)
      .neq("status", "cancelled");

    if (error) return json(res, 500, { ok: false, error: error.message });

    const booked = (data || []).map(r => r.time);
    return json(res, 200, { ok: true, booked });
  } catch (e) {
    return json(res, 500, { ok: false, error: e?.message || "Unknown error" });
  }
};
