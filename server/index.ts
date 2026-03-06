import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import { hashPassword } from "./auth";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[stripe] DATABASE_URL not set, skipping Stripe init');
    return;
  }
  try {
    console.log('[stripe] Initializing schema...');
    await runMigrations({ databaseUrl, schema: 'stripe' });
    console.log('[stripe] Schema ready');

    const stripeSync = await getStripeSync();

    const replitDomains = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || '';
    const domain = replitDomains.split(',')[0];
    if (domain) {
      const webhookBaseUrl = `https://${domain}`;
      try {
        const result = await stripeSync.findOrCreateManagedWebhook(
          `${webhookBaseUrl}/api/stripe/webhook`
        );
        if (result?.webhook?.url) {
          console.log(`[stripe] Webhook configured: ${result.webhook.url}`);
        } else {
          console.log('[stripe] Webhook setup returned no URL (may already exist)');
        }
      } catch (whErr: any) {
        console.log('[stripe] Webhook setup skipped:', whErr.message);
      }
    } else {
      console.log('[stripe] No domain found, skipping webhook setup');
    }

    stripeSync.syncBackfill()
      .then(() => console.log('[stripe] Data synced'))
      .catch((err: any) => console.error('[stripe] Sync error:', err));
  } catch (error) {
    console.error('[stripe] Init failed:', error);
  }
}

await initStripe();

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).json({ error: 'Missing signature' });
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        return res.status(500).json({ error: 'Webhook body not a Buffer' });
      }
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[stripe] Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  async function seedAdmin() {
    const adminEmail = "Compliance@rawfunded.com";
    const existing = await storage.getUserByEmail(adminEmail);
    if (!existing) {
      const hashed = await hashPassword("HumanResources");
      await storage.createUser({
        username: "Compliance",
        email: adminEmail,
        password: hashed,
      });
      const created = await storage.getUserByEmail(adminEmail);
      if (created) {
        await storage.updateUser(created.id, {
          isAdmin: true,
          tier: "titan",
          status: "approved",
          balance: 0,
          leverage: 2000,
          maxContracts: 999,
          approvedBy: "system",
          verifiedAt: new Date(),
        } as any);
        log("Admin account seeded: " + adminEmail);
      }
    }
  }
  await seedAdmin();

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
