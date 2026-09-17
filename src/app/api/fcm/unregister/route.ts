import { NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/supabase-server';
import { OutboxRepository } from '@/modules/notifications/outbox-repository';

export const runtime = 'nodejs';

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const repo = new OutboxRepository(supabase as any);
    // Explicitly delete only if the token belongs to the user
    const success = await repo.deleteToken(token, user.id);

    if (!success) {
      return NextResponse.json({ error: 'Failed to unregister token' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[FCM Unregister API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
