/**
 * Run with:  node seedNotificationTemplates.js
 * Or add to your package.json:
 *   "seed:templates": "node scripts/seedNotificationTemplates.js"
 *
 * Requires MONGO_URI in your environment (or a .env file).
 */

import "dotenv/config";
import mongoose from "mongoose";
import {
  NotificationTemplate,
  TEMPLATE_TYPES,
} from "./models/notificationTemplate.model.js";
import env from "./configs/env.config.js";

// ─── Template definitions ────────────────────────────────────────────────────

const templates = [
  {
    name: "OrgInvite",
    templateType: TEMPLATE_TYPES.EMAIL,
    subjectText: "You've been invited to join {{orgName}} on {{appName}}",
    bodyText: getOrgInviteHtml(),
    isActive: true,
  },
];

// ─── Seed runner ─────────────────────────────────────────────────────────────

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌  MONGO_URI is not set. Aborting.");
    process.exit(1);
  }

  await mongoose.connect(uri, {
    dbName: env.DB_NAME,
  });
  console.log("✅  Connected to MongoDB\n");

  let inserted = 0;
  let skipped = 0;

  for (const tpl of templates) {
    const exists = await NotificationTemplate.findOne({
      name: tpl.name,
      templateType: tpl.templateType,
    });

    if (exists) {
      console.log(
        `⏭   Skipping "${tpl.name}" (${tpl.templateType}) — already exists`,
      );
      skipped++;
      continue;
    }

    await NotificationTemplate.create(tpl);
    console.log(`🌱  Inserted "${tpl.name}" (${tpl.templateType})`);
    inserted++;
  }

  console.log(`\nDone — ${inserted} inserted, ${skipped} skipped.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

// ─── Template HTML ────────────────────────────────────────────────────────────
// Variables wrapped in {{}} are replaced at send-time by template.service.js:
//   {{recipientName}}   – invitee's name or email
//   {{inviterName}}     – name of the person who sent the invite
//   {{orgName}}         – organization name
//   {{orgIconUrl}}      – org icon (falls back to initials block if empty)
//   {{inviteLink}}      – full accept-invite URL
//   {{appName}}         – your product name, e.g. "Waveline"
//   {{expiryDays}}      – how many days until the invite expires

function getOrgInviteHtml() {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>You're invited to {{orgName}}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background-color: #0f0f10; font-family: 'DM Sans', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #e2e2e5; }
    .email-wrapper { width: 100%; background-color: #0f0f10; padding: 40px 16px 48px; }
    .email-center { max-width: 520px; margin-left: auto; margin-right: auto; }
 
    /* FIX 1: Logo — table-cell so mark and text always share a baseline */
    .logo-row { text-align: center; margin-bottom: 28px; }
    .logo-table { display: inline-table; border-collapse: collapse; }
    .logo-td { display: table-cell; vertical-align: middle; }
    .logo-mark {
      width: 28px; height: 28px; border-radius: 7px;
      background-color: #7c6af7;
      background-image: linear-gradient(135deg, #7c6af7 0%, #a78bfa 100%);
      display: block;
    }
    .logo-spacer { width: 8px; display: table-cell; }
    .logo-text {
      font-family: 'DM Serif Display', Georgia, serif;
      font-size: 19px; color: #ffffff; letter-spacing: -0.3px;
      line-height: 1; white-space: nowrap;
      display: table-cell; vertical-align: middle;
    }
 
    /* Card */
    .card { background-color: #1c1c1f; border-radius: 16px; border: 1px solid #2e2e32; overflow: hidden; }
    .card-stripe {
      display: block; height: 3px; line-height: 0; font-size: 0;
      background-color: #7c6af7;
      background-image: linear-gradient(90deg, #6d5cf0 0%, #a78bfa 55%, #c4b5fd 100%);
    }
    .card-body { padding: 36px 36px 32px; }
 
    /* FIX 2: Avatar — table/table-cell for reliable centering */
    .avatar-block { margin-bottom: 24px; }
    .org-avatar {
      width: 52px; height: 52px; border-radius: 12px;
      background-color: #312e81;
      background-image: linear-gradient(135deg, #312e81 0%, #4c1d95 100%);
      border: 1.5px solid #3f3f46;
      display: table; border-collapse: collapse; overflow: hidden;
    }
    .avatar-inner { display: table-cell; width: 52px; height: 52px; vertical-align: middle; text-align: center; }
    .avatar-initial {
      font-family: 'DM Serif Display', Georgia, serif;
      font-size: 22px; line-height: 1; color: #c4b5fd;
      display: inline-block; vertical-align: middle;
    }
 
    /* Text */
    .eyebrow {
      display: block; font-size: 10.5px; font-weight: 600;
      letter-spacing: 1.6px; text-transform: uppercase;
      color: #a78bfa; margin-bottom: 8px;
    }
    /* FIX 3: No <br /> in headline — flows as one line */
    .headline {
      font-family: 'DM Serif Display', Georgia, serif;
      font-size: 24px; line-height: 1.3; color: #ffffff;
      letter-spacing: -0.3px; margin-bottom: 14px;
      word-break: normal; overflow-wrap: normal;
    }
    .copy { font-size: 14.5px; line-height: 1.68; color: #9f9fa8; }
    .copy strong { color: #e0e0e5; font-weight: 600; }
    .sep { height: 1px; background-color: #2e2e32; border: none; display: block; margin: 24px 0; }
 
    /* Pills */
    .pills { margin-bottom: 26px; margin-left: -6px; }
    .pill {
      display: inline-block; background-color: #27272a;
      border: 1px solid #3a3a3e; border-radius: 99px;
      padding: 5px 13px 5px 8px; font-size: 12px; color: #9f9fa8;
      margin-left: 6px; margin-bottom: 6px; white-space: nowrap; vertical-align: middle;
    }
    .pill-dot {
      display: inline-block; width: 6px; height: 6px; border-radius: 50%;
      background-color: #a78bfa; margin-right: 6px; vertical-align: middle;
      position: relative; top: -1px;
    }
 
    /* CTA */
    .cta-row { margin-bottom: 22px; }
    .cta-btn {
      display: inline-block; background-color: #7462f0;
      background-image: linear-gradient(135deg, #6d5cf0 0%, #9d87fa 100%);
      color: #ffffff !important; text-decoration: none;
      font-family: 'DM Sans', Arial, sans-serif;
      font-size: 14.5px; font-weight: 600; line-height: 1;
      padding: 13px 28px; border-radius: 10px;
      letter-spacing: -0.1px; white-space: nowrap;
    }
 
    /* Fallback */
    .fallback-text { font-size: 11.5px; color: #52525b; line-height: 1.65; }
    .fallback-text a { color: #7c6af7; text-decoration: none; word-break: break-all; }
 
    /* Expiry */
    .expiry-box {
      margin-top: 18px; padding: 11px 14px; background-color: #1a1a1d;
      border-top: 1px solid #2e2e32; border-right: 1px solid #2e2e32;
      border-bottom: 1px solid #2e2e32; border-left: 3px solid #92400e;
      border-top-left-radius: 4px; border-bottom-left-radius: 4px;
      border-top-right-radius: 8px; border-bottom-right-radius: 8px;
    }
    .expiry-text { font-size: 12px; color: #6b6b6b; line-height: 1.55; }
    .expiry-text strong { color: #a16207; }
 
    /* FIX 4: Footer inside card-body, &#8203; before © defeats
       Gmail's "Show quoted text" heuristic */
    .footer-section { margin-top: 28px; padding-top: 20px; border-top: 1px solid #2e2e32; }
    .footer-copy { font-size: 11.5px; color: #4a4a52; line-height: 1.72; text-align: center; }
    .footer-copy a { color: #606068; text-decoration: none; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-center">
 
      <!-- FIX 1: Logo -->
      <div class="logo-row">
        <div class="logo-table">
          <div class="logo-td"><div class="logo-mark"></div></div>
          <div class="logo-spacer"></div>
          <div class="logo-text">{{appName}}</div>
        </div>
      </div>
 
      <div class="card">
        <span class="card-stripe"></span>
 
        <div class="card-body">
 
          <!-- FIX 2: Avatar -->
          <div class="avatar-block">
            <div class="org-avatar">
              <div class="avatar-inner">
                <span class="avatar-initial">{{orgInitial}}</span>
              </div>
            </div>
          </div>
 
          <span class="eyebrow">Team Invitation</span>
 
          <!-- FIX 3: Single line headline, no <br /> -->
          <h1 class="headline">You're invited to join {{orgName}}</h1>
 
          <p class="copy">
            <strong>{{inviterName}}</strong> has invited you to collaborate on
            <strong>{{orgName}}</strong>. Join to access shared channels,
            direct messages, and everything your team is working on.
          </p>
 
          <hr class="sep" />
 
          <div class="pills">
            <span class="pill"><span class="pill-dot"></span>{{orgName}}</span><span class="pill"><span class="pill-dot"></span>{{roleName}}</span>
          </div>
 
          <div class="cta-row">
            <a href="{{inviteLink}}" class="cta-btn">Accept Invitation &rarr;</a>
          </div>
 
          <p class="fallback-text">
            Button not working? Paste this link into your browser:<br />
            <a href="{{inviteLink}}">{{inviteLink}}</a>
          </p>
 
          <div class="expiry-box">
            <p class="expiry-text">
              <strong>&#9203; Expires in {{expiryDays}} days.</strong>
              This invitation link will stop working after that.
              Ask {{inviterName}} to resend if it expires.
            </p>
          </div>
 
          <!-- FIX 4: Footer inside card-body to prevent Gmail quoting -->
          <div class="footer-section">
            <p class="footer-copy">
              You received this because <strong>{{inviterName}}</strong> invited
              <a href="mailto:{{recipientEmail}}">{{recipientEmail}}</a> to {{orgName}}.<br />
              If this was a mistake, you can safely ignore this email.<br /><br />
              &#8203;&copy; {{year}} {{appName}} &middot;
              <a href="{{privacyUrl}}">Privacy Policy</a>
            </p>
          </div>
 
        </div><!-- /card-body -->
      </div><!-- /card -->
 
    </div>
  </div>
</body>
</html>`;
}
