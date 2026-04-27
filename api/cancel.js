const { Resend } = require("resend");
const { createClient } = require("@supabase/supabase-js");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const resend = new Resend(process.env.RESEND_API_KEY);
    const studioEmail = process.env.STUDIO_EMAIL;
    const fromEmail = process.env.FROM_EMAIL || "PilatesEsra <onboarding@resend.dev>";

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const id = String(body?.id || "").trim();

    if (!id) return json(res, 400, { ok: false, error: "Missing reservation id" });

    // Rezervasyonu bul
    const { data: reservation, error: fetchError } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !reservation) return json(res, 404, { ok: false, error: "Reservation not found" });
    if (reservation.status === "cancelled") return json(res, 400, { ok: false, error: "already_cancelled" });

    // 24 saat kontrolü
    const reservationDateTime = new Date(`${reservation.date}T${reservation.time}:00`);
    const now = new Date();
    const hoursUntil = (reservationDateTime - now) / (1000 * 60 * 60);

    if (hoursUntil < 24) {
      return json(res, 400, { ok: false, error: "too_late", hoursUntil: Math.round(hoursUntil) });
    }

    // İptal et
    await supabase.from("reservations").update({ status: "cancelled" }).eq("id", id);

    const prettyDate = reservation.date.split("-").reverse().join(".");

    // Kullanıcıya bildirim
    if (reservation.email) {
      const isFr = reservation.lang === "fr";
      await resend.emails.send({
        from: fromEmail,
        to: [reservation.email],
        subject: isFr
          ? `Réservation annulée : ${reservation.class_type} · ${reservation.date}`
          : `Rezervasyon iptal edildi: ${reservation.class_type} · ${prettyDate}`,
        html: isFr ? `
          <div style="font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.6;max-width:520px;">
            <h2 style="color:#142826;">Votre réservation a été annulée</h2>
            <p>Bonjour ${reservation.full_name},</p>
            <div style="background:#f5f0e8;border-left:3px solid #C09040;padding:14px 18px;border-radius:4px;margin:16px 0;">
              <p style="margin:0 0 6px;"><b>Cours</b> : ${reservation.class_type}</p>
              <p style="margin:0 0 6px;"><b>Date</b> : ${reservation.date}</p>
              <p style="margin:0;"><b>Heure</b> : ${reservation.time}</p>
            </div>
            <p>Votre séance a bien été annulée. Nous espérons vous revoir bientôt.</p>
            <p>À bientôt,<br/><b>PilatesEsra</b></p>
          </div>` : `
          <div style="font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.6;max-width:520px;">
            <h2 style="color:#142826;">Rezervasyonunuz iptal edildi</h2>
            <p>Merhaba ${reservation.full_name},</p>
            <div style="background:#f5f0e8;border-left:3px solid #C09040;padding:14px 18px;border-radius:4px;margin:16px 0;">
              <p style="margin:0 0 6px;"><b>Ders</b>: ${reservation.class_type}</p>
              <p style="margin:0 0 6px;"><b>Tarih</b>: ${prettyDate}</p>
              <p style="margin:0;"><b>Saat</b>: ${reservation.time}</p>
            </div>
            <p>Seansınız başarıyla iptal edildi. Sizi tekrar görmekten mutluluk duyarız.</p>
            <p>Görüşmek üzere,<br/><b>PilatesEsra</b></p>
          </div>`
      });
    }

    // Stüdyo sahibine bildirim
    await resend.emails.send({
      from: fromEmail,
      to: [studioEmail],
      subject: `İptal: ${reservation.class_type} · ${prettyDate} · ${reservation.time} · ${reservation.full_name}`,
      html: `
        <div style="font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.6;">
          <h2 style="color:#142826;">Rezervasyon İptali</h2>
          <p><b>${reservation.full_name}</b> adlı kişi rezervasyonunu iptal etti.</p>
          <p><b>Ders</b>: ${reservation.class_type}<br/>
          <b>Tarih</b>: ${prettyDate}<br/>
          <b>Saat</b>: ${reservation.time}</p>
        </div>`
    });

    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, { ok: false, error: e?.message || "Unknown error" });
  }
};
