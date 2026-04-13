"""
secreai — Email Service (Resend API)
Sends transactional emails via https://resend.com

Usage:
  from tools.email import send_email, send_welcome_email, send_confirmation_reminder_email, send_real_confirmation_email

Requires:
  RESEND_API_KEY  in .env
  RESEND_FROM_EMAIL in .env (must be from a verified Resend domain)
"""

import os
import httpx
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

RESEND_API_KEY   = os.getenv("RESEND_API_KEY", "")
RESEND_FROM      = os.getenv("RESEND_FROM_EMAIL", "secreai <noreply@secreai.com>")
RESEND_API_URL   = "https://api.resend.com/emails"
FRONTEND_URL     = os.getenv("FRONTEND_URL", "http://localhost:3000")


def _resend_available() -> bool:
    return bool(RESEND_API_KEY) and RESEND_API_KEY.startswith("re_")


async def send_email(
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
) -> dict:
    """
    Send a single email via Resend API.
    Returns {"id": "...", "ok": True} or {"ok": False, "error": "..."}
    """
    if not _resend_available():
        print(f"⚠️  Resend not configured. Set RESEND_API_KEY in .env (get key at resend.com)")
        return {"ok": False, "error": "RESEND_API_KEY not configured"}

    payload: dict = {
        "from":    RESEND_FROM,
        "to":      [to],
        "subject": subject,
        "html":    html,
    }
    if text:
        payload["text"] = text

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                RESEND_API_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type":  "application/json",
                },
            )
        data = resp.json()
        if resp.status_code in (200, 201):
            print(f"   📧 Email sent via Resend to {to}: {data.get('id')}")
            return {"ok": True, "id": data.get("id")}
        else:
            err = data.get("message") or data.get("error") or str(data)
            print(f"   ❌ Resend error ({resp.status_code}): {err}")
            return {"ok": False, "error": err}
    except Exception as e:
        print(f"   ❌ Resend request failed: {e}")
        return {"ok": False, "error": str(e)}


# ── Email templates ───────────────────────────────────────────────────

async def send_welcome_email(to: str, name: str, tier: str) -> dict:
    """Welcome email sent after successful registration."""
    html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F0;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0D0D0D;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:36px 40px 28px;border-bottom:1px solid #222;">
            <span style="font-family:Arial Black,sans-serif;font-size:22px;letter-spacing:6px;color:#ffffff;">secreai</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 8px;font-size:13px;letter-spacing:2px;color:#00FF66;font-family:monospace;">WELCOME ABOARD</p>
            <h1 style="margin:0 0 20px;font-size:32px;color:#ffffff;font-weight:900;letter-spacing:1px;">
              Hi {name or 'there'}
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#888;line-height:1.7;">
              Your secreai account is ready. You're on the
              <strong style="color:#ffffff;">{tier.upper()} plan</strong>.
              Start your first multi-agent session now.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              {''.join([f'<tr><td style="padding:6px 0;"><span style="color:#00FF66;font-size:13px;margin-right:10px;">✓</span><span style="color:#aaa;font-size:13px;">{f}</span></td></tr>' for f in ['15 job-function AI agents', 'True parallel: Gemini + Groq', 'A4 workspace & document builder', 'RAG knowledge base integration']])}
            </table>
            <a href="{FRONTEND_URL}"
               style="display:inline-block;padding:14px 32px;background:#00FF66;color:#0D0D0D;
                      font-weight:700;font-size:13px;letter-spacing:2px;text-decoration:none;
                      border-radius:6px;">
              START USING SECREAI →
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #222;">
            <p style="margin:0;font-size:11px;color:#444;font-family:monospace;letter-spacing:1px;">
              secreai — MULTI-AGENT AI PLATFORM
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    return await send_email(
        to=to,
        subject=f"Welcome to secreai — {tier.upper()} plan activated",
        html=html,
        text=f"Welcome to secreai, {name}! Your {tier.upper()} plan is ready. Visit: {FRONTEND_URL}",
    )


async def send_confirmation_reminder_email(to: str, name: str) -> dict:
    """
    Reminder email when user hasn't confirmed yet.
    """
    html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F0;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0D0D0D;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:36px 40px 28px;border-bottom:1px solid #222;">
            <span style="font-family:Arial Black,sans-serif;font-size:22px;letter-spacing:6px;color:#ffffff;">secreai</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 8px;font-size:13px;letter-spacing:2px;color:#00FF66;font-family:monospace;">ONE MORE STEP</p>
            <h1 style="margin:0 0 20px;font-size:28px;color:#ffffff;font-weight:900;">
              Confirm your email
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#888;line-height:1.7;">
              Hi {name or 'there'}, we sent a confirmation link to
              <strong style="color:#ffffff;">{to}</strong>.
              Please check your inbox (and spam folder) and click the link to activate your account.
            </p>
            <p style="margin:0 0 24px;font-size:13px;color:#666;line-height:1.6;">
              Didn't receive it? Check your spam folder or request a new link from the login page.
            </p>
            <a href="{FRONTEND_URL}/login"
               style="display:inline-block;padding:14px 32px;background:#00FF66;color:#0D0D0D;
                      font-weight:700;font-size:13px;letter-spacing:2px;text-decoration:none;
                      border-radius:6px;">
              BACK TO LOGIN →
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #222;">
            <p style="margin:0;font-size:11px;color:#444;font-family:monospace;letter-spacing:1px;">
              secreai — MULTI-AGENT AI PLATFORM
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    return await send_email(
        to=to,
        subject="secreai — Please confirm your email address",
        html=html,
        text=f"Hi {name}, please check your inbox for the confirmation link from secreai. Visit: {FRONTEND_URL}/login",
    )


async def send_real_confirmation_email(to: str, name: str, action_link: str) -> dict:
    """
    Supabase Admin API에서 생성된 실제 인증 링크(action_link)를 Resend로 전송합니다.
    """
    html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F0;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0D0D0D;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:36px 40px 28px;border-bottom:1px solid #222;">
            <span style="font-family:Arial Black,sans-serif;font-size:22px;letter-spacing:6px;color:#ffffff;">secreai</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 8px;font-size:13px;letter-spacing:2px;color:#00FF66;font-family:monospace;">VERIFY ACCOUNT</p>
            <h1 style="margin:0 0 20px;font-size:28px;color:#ffffff;font-weight:900;">
              Confirm your email
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#888;line-height:1.7;">
              Hi {name or 'there'}, welcome to secreai! <br/>
              Please click the button below to verify your email address and activate your account.
            </p>
            <a href="{action_link}"
               style="display:inline-block;padding:14px 32px;background:#00FF66;color:#0D0D0D;
                      font-weight:700;font-size:13px;letter-spacing:2px;text-decoration:none;
                      border-radius:6px;">
              VERIFY EMAIL →
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #222;">
            <p style="margin:0;font-size:11px;color:#444;font-family:monospace;letter-spacing:1px;">
              secreai — MULTI-AGENT AI PLATFORM
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    return await send_email(
        to=to,
        subject="secreai — Verify your email address",
        html=html,
        text=f"Hi {name}, please verify your email by clicking this link: {action_link}",
    )