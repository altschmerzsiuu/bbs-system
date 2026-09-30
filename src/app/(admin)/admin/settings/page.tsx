import { requireActor } from '@/lib/auth';
import { createServerClient } from '@/infrastructure/supabase-server';
import { SettingsClient } from './settings-client';

export const metadata = { title: 'Settings | BBS Admin' };

export default async function SettingsPage() {
  await requireActor(['ADMIN']);
  const db = await createServerClient();
  
  const { data: horses } = await db.from('horses').select('*').order('created_at', { ascending: true });
  const { data: settings } = await db.from('site_settings').select('*').eq('id', 1).single();
  const { data: schedules } = await db.from('operating_schedules').select('*').order('day_of_week', { ascending: true });
  
  return <SettingsClient initialHorses={horses || []} initialSettings={settings} initialSchedules={schedules || []} />;
}
