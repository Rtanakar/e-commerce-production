// ============================================================================
// docs.routes.ts - Swagger UI + raw OpenAPI spec
// ============================================================================
// Exposes:
//   GET /docs            → Swagger UI (interactive)
//   GET /docs/openapi.json → raw spec (for Postman, SDK gen, etc.)
//
// Production toggle: env.ENABLE_DOCS or admin-only - decide per company policy
// Stripe/Twilio: docs always public.  Internal APIs: behind auth.
// ============================================================================

import { Router, type Request, type Response } from "express";
import swaggerUi from "swagger-ui-express";
import { generateOpenApiSpec } from "../../lib/openapi.js";

const router: Router = Router();

// Raw OpenAPI JSON - for tooling (Postman import, SDK generators, etc.)
router.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(generateOpenApiSpec());
});

// Swagger UI - interactive explorer
const spec = generateOpenApiSpec();
router.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(spec, {
    customSiteTitle: "E-Commerce API Docs",
    customCss: ".swagger-ui .topbar { display: none }",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  }),
);

export default router;
