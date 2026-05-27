// ============================================================================
// render.ts - EJS template rendering (clean, no inliner)
// ============================================================================
// Why no juice / no CSS inliner?
//   - All CSS lives inside <style> in _layout.ejs (static hex values)
//   - Modern email clients (Gmail, Outlook 365, Apple Mail) all honor <style>
//   - Old Outlook (Word renderer) still gets media queries via <style>
//   - Simpler pipeline, fewer deps, fewer bugs
//
// Two-step render:
//   1. inner template (otp/welcome/password-reset) → HTML string
//   2. wrap with _layout.ejs (header + content + footer)
// ============================================================================

import ejs from "ejs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env, isProd } from "../config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "templates");

const ejsOptions: ejs.Options = {
  cache: isProd, // prod compile-once, dev hot reload
  filename: TEMPLATES_DIR,
};

// ============================================================================
// Shared locals - har template ko ye automatically milte hai
// ============================================================================
function defaultLocals() {
  return {
    brandName: env.EMAIL_FROM_NAME,
    year: new Date().getFullYear(),
    appUrl: env.APP_URL,
  };
}

// ============================================================================
// renderTemplate - main API
// ============================================================================
export async function renderTemplate(
  templateName: "otp" | "welcome" | "password-reset",
  data: Record<string, unknown>,
  shellOptions: { title: string; preheader: string },
): Promise<string> {
  const locals = { ...defaultLocals(), ...data };

  // Step 1: inner content
  const innerPath = path.join(TEMPLATES_DIR, `${templateName}.ejs`);
  const content = await ejs.renderFile(innerPath, locals, ejsOptions);

  // Step 2: layout wrap
  const layoutPath = path.join(TEMPLATES_DIR, "_layout.ejs");
  return ejs.renderFile(
    layoutPath,
    {
      ...locals,
      title: shellOptions.title,
      preheader: shellOptions.preheader,
      content,
    },
    ejsOptions,
  );
}
