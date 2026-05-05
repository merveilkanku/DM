import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

  // Supabase Admin Client for Webhooks (bypasses RLS if service role key is used)
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xistgrankjxcaqypncar.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

  // Money Fusion Webhook
  app.post("/api/moneyfusion/webhook", express.json(), async (req, res) => {
    // Money Fusion typical webhook sends data in body or query
    const { reference, status, amount, transaction_id } = req.body;
    
    console.log(`MoneyFusion Webhook received:`, { reference, status, amount });

    if (status === 'completed' || status === 'success') {
      // reference is expected to be restaurantId:planId
      const [restaurantId, planId] = (reference || "").split(':');

      if (restaurantId && planId && supabaseAdmin) {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        const { error } = await supabaseAdmin
          .from('restaurants')
          .update({
            subscription_tier: planId,
            subscription_status: 'active',
            subscription_end_date: nextMonth.toISOString()
          })
          .eq('id', restaurantId);

        if (error) {
          console.error("Webhook Error updating database:", error);
        } else {
          console.log(`Webhook: Successfully updated restaurant ${restaurantId} via MoneyFusion`);
        }
      }
    }

    res.json({ received: true });
  });

  app.use(express.json());

  app.post("/api/moneyfusion/create-payment", async (req, res) => {
    const { planId, restaurantId, amount, currency = "USD" } = req.body;
    
    const merchantId = process.env.MONEY_FUSION_MERCHANT_ID;
    const apiKey = process.env.MONEY_FUSION_API_KEY;

    if (!merchantId || !apiKey) {
      return res.status(500).json({ error: "Money Fusion is not configured on the server" });
    }

    // Server-side price calculation
    const PLAN_PRICES: Record<string, number> = {
      'basic': 5,
      'premium': 20,
      'enterprise': 50,
      'starter': 5,
      'pro': 20,
      'elite': 50
    };

    const price = PLAN_PRICES[planId] || amount || 5;
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? `https://${req.get('host')}` 
      : `http://${req.get('host')}`;

    console.log(`🔗 [MoneyFusion] Génération lien paiement. Base URL détectée : ${baseUrl}`);

    try {
      // reference is expected to be restaurantId:planId
      const reference = `${restaurantId}:${planId}`;
      
      const successUrl = `${baseUrl}?payment_status=success`;
      const cancelUrl = `${baseUrl}?payment_status=cancel`;
      const callbackUrl = `${baseUrl}/api/moneyfusion/webhook`;
      
      // Mocking the call to Money Fusion but providing the structure they use
      const paymentUrl = `https://moneyfusion.net/pay?merchant_id=${merchantId}&amount=${price}&currency=${currency}&reference=${reference}&success_url=${encodeURIComponent(successUrl)}&error_url=${encodeURIComponent(cancelUrl)}&callback_url=${encodeURIComponent(callbackUrl)}`;

      console.log(`✅ [MoneyFusion] Payment URL générée : ${paymentUrl}`);
      res.json({ url: paymentUrl });
    } catch (error: any) {
      console.error("Money Fusion Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/email/send", async (req, res) => {
    if (!resend) {
      return res.status(500).json({ error: "Resend is not configured on the server" });
    }

    let { to, subject, html, from = "DashMeals <onboarding@resend.dev>" } = req.body;

    // Resend Sandbox Restriction: Can only send to the verified email
    const verifiedEmail = "irmerveilkanku@gmail.com";
    const recipients = Array.isArray(to) ? to : [to];
    
    // Filter recipients or redirect to verified email in sandbox mode
    const isSandbox = true; // Assuming sandbox mode unless a domain is verified
    if (isSandbox) {
      const hasUnverified = recipients.some(email => email.toLowerCase() !== verifiedEmail.toLowerCase());
      if (hasUnverified) {
        console.warn(`Resend Sandbox Mode: Redirecting email from ${to} to ${verifiedEmail}`);
        to = verifiedEmail;
        subject = `[SANDBOX FOR ${recipients.join(', ')}] ${subject}`;
      }
    }

    try {
      const { data, error } = await resend.emails.send({
        from,
        to,
        subject,
        html,
      });

      if (error) {
        console.error("Resend API Error:", error);
        // If it's a validation error related to recipients, we return a friendly message
        return res.status(400).json({ error });
      }

      res.json({ data });
    } catch (error: any) {
      console.error("Resend Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
