import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  const stripe = process.env.STRIPE_SECRET_KEY 
    ? new Stripe(process.env.STRIPE_SECRET_KEY) 
    : null;

  const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

  // Supabase Admin Client for Webhooks (bypasses RLS if service role key is used)
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xistgrankjxcaqypncar.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

  // Webhook endpoint must come BEFORE express.json() for Stripe signature verification
  app.post("/api/stripe/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
    
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      if (webhookSecret && sig) {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        // Fallback for local testing if secret isn't provided (UNSAFE FOR PRODUCTION)
        event = JSON.parse(req.body.toString());
      }
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { restaurantId, planId } = paymentIntent.metadata;

      if (restaurantId && planId && supabaseAdmin) {
        console.log(`Webhook: Activating subscription ${planId} for restaurant ${restaurantId}`);
        
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
          console.log(`Webhook: Successfully updated restaurant ${restaurantId}`);
        }
      }
    }

    res.json({ received: true });
  });

  app.use(express.json());

  app.post("/api/stripe/create-payment-intent", async (req, res) => {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe is not configured on the server" });
    }

    let { planId, restaurantId, currency = "usd", type } = req.body;

    if (type !== 'subscription') {
      return res.status(400).json({ error: "Stripe payments are only allowed for subscriptions" });
    }

    // Server-side price calculation to prevent front-end tampering
    const PLAN_PRICES: Record<string, number> = {
      'basic': 5,
      'premium': 20,
      'enterprise': 50,
      'starter': 5, // Mapping legacy or variant names
      'pro': 20,
      'elite': 50
    };

    const priceInDollars = PLAN_PRICES[planId as keyof typeof PLAN_PRICES];
    
    if (!priceInDollars) {
      return res.status(400).json({ error: "Invalid subscription plan" });
    }

    let amount = priceInDollars * 100; // Convert to cents

    // Stripe minimum amount check (e.g., 50 cents for USD)
    // https://stripe.com/docs/currencies#minimum-and-maximum-charge-amounts
    const minAmount: Record<string, number> = {
      usd: 50,
      eur: 50,
      gbp: 30,
      cad: 50,
      aud: 50,
      jpy: 50,
      cdf: 1000, // Approximate minimum for CDF
    };

    const min = minAmount[currency.toLowerCase()] || 50;
    if (amount < min) {
      console.warn(`Amount ${amount} is below minimum for ${currency}. Increasing to ${min}.`);
      amount = min;
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: currency.toLowerCase(),
        metadata: {
          restaurantId,
          planId,
          type
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount 
      });
    } catch (error: any) {
      console.error("Stripe Error:", error);
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
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
