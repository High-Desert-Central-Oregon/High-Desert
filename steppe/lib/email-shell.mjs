// Canonical Steppe transactional-email shell — ONE source of truth for every email
// Steppe sends. Consumed by:
//   • the app (lib/interest-email.ts) for the /join confirmation, and
//   • docs/ops/email-templates/generate.mjs, which renders the Supabase auth templates.
// Palette matches steppe/app/(site)/tokens.css (light); type = the brand trio with
// web-safe fallbacks (email clients don't load webfonts). Table layout + inline styles
// for Gmail/Outlook/Apple Mail. Plain ESM so both a Next build and plain `node` can import it.

const C = {
  bone: "#ede6d5", // --bone   (outer bg)
  paper: "#fbf7ee", // --paper  (card)
  sand: "#e4d8bf", // --sand   (border / divider)
  deep: "#36563d", // --bg-feature (heading + button)
  sage: "#6e8a5b", // --sage-deep  (eyebrow / footer / link)
  ink: "#2a2e2c", // --ink    (body)
  inkSoft: "#5f5a4e", // --ink-soft (secondary)
};
const SANS = "'Schibsted Grotesk',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "'Besley',Georgia,'Times New Roman',serif";
const MONO = "'Martian Mono',ui-monospace,Menlo,Consolas,monospace";

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render a full brand-styled HTML email.
 * @param {object} o
 * @param {string}   o.heading        H1 (Besley, sage-deep)
 * @param {string[]} o.paragraphs     body paragraphs (plain text; escaped)
 * @param {{url:string,label:string}} [o.action]  a button + copy-paste fallback URL
 * @param {string}   [o.code]         a code to display prominently (e.g. reauth {{ .Token }})
 * @param {string}   [o.securityNote] a reassuring "if this wasn't you…" line
 * @param {string}   [o.preheader]    inbox preview text (hidden in the body)
 * @returns {string} full HTML document
 */
export function renderBrandEmail({ heading, paragraphs = [], action, code, securityNote, preheader = "" }) {
  const body = paragraphs
    .map(
      (t, i) =>
        `<p style="margin:0 0 ${i === paragraphs.length - 1 ? 0 : 10}px 0; font-family:${SANS}; font-size:15px; line-height:1.6; color:${C.ink};">${esc(t)}</p>`,
    )
    .join("");

  const actionBlock = action
    ? `
        <tr><td style="padding:20px 32px 6px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="border-radius:9px; background:${C.deep};">
              <a href="${action.url}" style="display:inline-block; padding:13px 28px; font-family:${SANS}; font-size:15px; font-weight:600; color:${C.paper}; text-decoration:none; border-radius:9px;">${esc(action.label)}</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:10px 32px 4px 32px;">
          <p style="margin:0 0 4px 0; font-family:${SANS}; font-size:12.5px; line-height:1.5; color:${C.inkSoft};">Button not working? Paste this link into your browser:</p>
          <p style="margin:0; font-family:${MONO}; font-size:11.5px; line-height:1.5; color:${C.sage}; word-break:break-all;">${action.url}</p>
        </td></tr>`
    : "";

  const codeBlock = code
    ? `
        <tr><td style="padding:18px 32px 6px 32px;">
          <div style="font-family:${MONO}; font-size:30px; font-weight:500; letter-spacing:.22em; color:${C.deep}; background:#ffffff; border:1px solid ${C.sand}; border-radius:10px; padding:16px 20px; text-align:center;">${code}</div>
        </td></tr>`
    : "";

  const security = securityNote
    ? `<p style="margin:0 0 12px 0; font-family:${SANS}; font-size:12.5px; line-height:1.6; color:${C.inkSoft};">${esc(securityNote)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${esc(heading)}</title>
</head>
<body style="margin:0; padding:0; background:${C.bone}; -webkit-font-smoothing:antialiased;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bone};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background:${C.paper}; border:1px solid ${C.sand}; border-radius:14px;">
        <tr><td style="padding:26px 32px 0 32px;">
          <div style="font-family:${MONO}; font-size:12px; letter-spacing:.22em; text-transform:uppercase; color:${C.sage};">Steppe</div>
        </td></tr>
        <tr><td style="padding:14px 32px 4px 32px;">
          <h1 style="margin:0 0 12px 0; font-family:${SERIF}; font-weight:700; font-size:24px; line-height:1.2; color:${C.deep};">${esc(heading)}</h1>
          ${body}
        </td></tr>${actionBlock}${codeBlock}
        <tr><td style="padding:20px 32px 0 32px;"><div style="height:1px; background:${C.sand}; line-height:1px;">&nbsp;</div></td></tr>
        <tr><td style="padding:16px 32px 28px 32px;">
          ${security}<img src="https://www.steppe.community/brand/steppe-strata-seal-512.png" alt="Steppe Strata Seal — Redmond, Oregon" width="96" height="96" style="display:block; width:96px; height:96px; margin:0 0 12px 0;"><p style="margin:0; font-family:${MONO}; font-size:11px; letter-spacing:.04em; color:${C.sage};">Steppe · Redmond, Oregon</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
