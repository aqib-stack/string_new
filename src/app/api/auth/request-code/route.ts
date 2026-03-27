import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/admin';
import type { UserRole } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashCode(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

async function sendCodeEmail(email: string, code: string, role: UserRole) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_FROM_EMAIL || 'StringGlobe <auth@stringglobe.app>';

  if (!apiKey) {
    console.warn('RESEND_API_KEY is missing; auth code email not sent. Generated code:', code, 'for', email);
    return { delivered: false, devCode: code };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Your StringGlobe verification code',
      html: `
        <div style="font-family:Arial,sans-serif;background:#07111d;color:#ecf3ff;padding:32px;line-height:1.5">
          <div style="max-width:560px;margin:0 auto;background:#101b2d;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:32px">
            <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9cefff;margin-bottom:12px">StringGlobe secure access</div>
            <h1 style="margin:0 0 12px;font-size:28px">Your ${role === 'STRINGER' ? 'stringer' : 'player'} verification code</h1>
            <p style="color:#b4c5de;margin:0 0 24px">Use the code below to finish your secure sign in. This code expires in 10 minutes.</p>
            <div style="font-size:36px;font-weight:700;letter-spacing:.3em;padding:18px 22px;border-radius:16px;background:#07111d;border:1px solid rgba(255,255,255,.08);text-align:center">${code}</div>
            <p style="color:#7f92b0;margin:24px 0 0">If you did not request this, you can safely ignore this email.</p>
          </div>
        </div>`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to send email code: ${text}`);
  }

  return { delivered: true };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body.email || '');
    const name = String(body.name || '').trim();
    const role = (body.role || 'PLAYER') as UserRole;
    const mode = body.mode === 'signin' ? 'signin' : 'signup';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    if (mode === 'signup' && !name) {
      return NextResponse.json({ error: 'Please enter your full name.' }, { status: 400 });
    }

    const code = `${Math.floor(100000 + Math.random() * 900000)}`;
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const docId = Buffer.from(`${email}:${role}`).toString('base64url');

    await adminDb.collection('email_codes').doc(docId).set({
      email,
      name,
      role,
      mode,
      code_hash: hashCode(code),
      expires_at: expiresAt,
      created_at: Date.now(),
      attempts: 0,
    });

    const sendResult = await sendCodeEmail(email, code, role);

    return NextResponse.json({ ok: true, expiresInMinutes: 10, ...sendResult });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to send code.' }, { status: 500 });
  }
}
