import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OutboxRepository } from '../../../../modules/notifications/outbox-repository';
import { DeliveryDispatcher } from '../../../../modules/notifications/delivery-dispatcher';
import { NotificationWorker } from '../../../../modules/notifications/notification-worker';

export const runtime = 'nodejs';

// Prevent Next.js from aggressively caching this cron endpoint
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    // 1. Authorization: Ensure the caller has the cron secret
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Server-Only Supabase Client
    // We MUST use the service role key because the outbox RLS denies all member modifications.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Notification Worker] Missing Supabase environment variables');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 3. Dependency Injection
    const repository = new OutboxRepository(supabase as any);
    const dispatcher = new DeliveryDispatcher(repository);
    const worker = new NotificationWorker(repository, dispatcher);

    // 4. Process Pending Notifications
    // Pick up to 50 notifications in one run. 
    // If the queue is huge, the cron should run more frequently or batch size increased.
    const result = await worker.processPending(50);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Notification Worker] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
