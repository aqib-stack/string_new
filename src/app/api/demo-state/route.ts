import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DB_PATH = path.join(os.tmpdir(), 'stringglobe-demo-state.json');

const DEFAULT_STATE: Record<string, unknown> = {
  stringglobe_auth_users: [],
  stringglobe_demo_shops: [],
  stringglobe_demo_racquets: [],
  stringglobe_demo_jobs: [],
  stringglobe_demo_alerts: [],
};

function ensureDbFile() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_STATE, null, 2), 'utf8');
  }
}

function readState() {
  ensureDbFile();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Record<string, unknown>) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeState(state: Record<string, unknown>) {
  ensureDbFile();
  fs.writeFileSync(DB_PATH, JSON.stringify({ ...DEFAULT_STATE, ...state }, null, 2), 'utf8');
}

export async function GET() {
  return NextResponse.json({ ok: true, state: readState() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const key = String(body.key || '').trim();
    if (!key) {
      return NextResponse.json({ error: 'Key is required.' }, { status: 400 });
    }
    const next = readState();
    next[key] = body.value;
    writeState(next);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save state.' }, { status: 500 });
  }
}

export async function DELETE() {
  writeState({ ...DEFAULT_STATE });
  return NextResponse.json({ ok: true });
}
