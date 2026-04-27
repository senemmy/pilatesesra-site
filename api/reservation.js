const { createClient } = require("@supabase/supabase-js");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });

  const id = req.query?.id || new URL(req.url, "http://localhost").searchParams.get("id");
  if (!id) return json(res, 400, { ok: false, error: "Missing id" });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("reservations")
      .select("full_name, class_type, date, time, status, lang")
      .eq("id", id)
      .single();

    if (error || !data) return json(res, 404, { ok: false, error: "not_found" });

    return json(res, 200, { ok: true, reservation: data });
  } catch (e) {
    return json(res, 500, { ok: false, error: e?.message || "Unknown error" });
  }
};
