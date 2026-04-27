const { createClient } = require("@supabase/supabase-js");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("schedule")
      .select("day_of_week, time, class_type")
      .eq("is_active", true)
      .order("day_of_week", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) return json(res, 500, { ok: false, error: error.message });

    return json(res, 200, { ok: true, data: data || [] });
  } catch (e) {
    return json(res, 500, { ok: false, error: e?.message || "Unknown error" });
  }
};
