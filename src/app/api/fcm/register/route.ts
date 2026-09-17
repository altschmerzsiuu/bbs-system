import { NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/supabase-server';
import { OutboxRepository } from '@/modules/notifications/outbox-repository';
import { createServiceRoleClient } from '@/infrastructure/supabase-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { token, deviceInfo } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Use service role client to bypass RLS for UPSERT if needed, or if RLS allows it
    // Wait, the RLS policy says:
    // create policy "Users can manage their own FCM tokens" on fcm_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
    // So the authenticated `supabase` client CAN insert/upsert its own token safely!
    const repo = new OutboxRepository(supabase as any);
    const success = await repo.upsertToken(user.id, token, deviceInfo);

    if (!success) {
      return NextResponse.json({ error: 'Failed to register token' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[FCM Register API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
