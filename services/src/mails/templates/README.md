# Email Templates

EJS-based transactional email templates. Outlook + Gmail + Apple Mail safe.

## Files

- `_layout.ejs` — base shell (header, content slot, footer)
- `otp.ejs` — verification code
- `welcome.ejs` — post-signup
- `password-reset.ejs` — reset link

## How rendering works

Two-step render in `../render.ts`:

1. Render inner template (`otp.ejs` etc.) with template-specific locals
2. Wrap with `_layout.ejs` — passes inner HTML as `content`

## Locals reference

### `_layout.ejs`

| Local       | Type           | Purpose                                |
| ----------- | -------------- | -------------------------------------- |
| `title`     | string         | `<title>` tag                          |
| `preheader` | string         | Hidden inbox preview text (~100 chars) |
| `brandName` | string         | Company name (header + footer)         |
| `content`   | string (raw)   | Inner template HTML (pre-rendered)     |
| `theme`     | EmailTheme     | Hex color tokens (`theme.ts`)          |
| `font`      | string         | CSS font stack                         |
| `year`      | number         | Footer copyright year                  |

### `otp.ejs`

| Local        | Type                                                          |
| ------------ | ------------------------------------------------------------- |
| `name`       | string                                                        |
| `otp`        | string (6 digits)                                             |
| `purpose`    | `"registration" \| "login" \| "password-reset" \| "email-change"` |
| `ttlMinutes` | number                                                        |

### `welcome.ejs`

| Local    | Type                       |
| -------- | -------------------------- |
| `name`   | string                     |
| `role`   | `"CUSTOMER" \| "VENDOR"`   |
| `appUrl` | string (CTA destination)   |

### `password-reset.ejs`

| Local        | Type   |
| ------------ | ------ |
| `name`       | string |
| `resetUrl`   | string |
| `ttlMinutes` | number |

## Production rules

1. **Hex colors only** — `oklch`/`hsl`/CSS vars unsupported in 30% of clients
2. **Inline styles** — Gmail strips `<style>` in some contexts
3. **Tables for layout** — Outlook 2007+ uses MS Word rendering (no flex/grid)
4. **600px max width** — Outlook desktop standard
5. **Bulletproof buttons** — `<td bgcolor>` + nested `<a>` (works in all clients)
6. **`!important` on key body styles** — Yahoo Mail overrides reset

## Editor notes

- `.ejs` is excluded from Prettier (it mangles `<%= %>` inside attributes)
- VS Code: file association `*.ejs` → `html` for syntax highlight
- Recommended extension: **EJS language support** (`DigitalBrainstem.javascript-ejs-support`)

## Adding a new template

1. Drop `your-template.ejs` here
2. Add typed wrapper in `../templates.ts`:
   ```ts
   export async function yourEmail(input: { name: string }) {
     const html = await renderTemplate("your-template", input, {
       title: "...", preheader: "..."
     });
     return { subject: "...", html };
   }
   ```
3. Add the literal `"your-template"` to the union in `render.ts`'s `templateName` param
