import { requireActor } from '@/lib/auth';
import { createServerClient } from '@/infrastructure/supabase-server';
import RequestForm from './request-form';
import MembershipWizard from './membership-wizard';
import { ensureSlotsForDateRange } from '@/modules/bookings/booking-queries';

export default async function RequestPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const actor = await requireActor(['MEMBER']);
  const db = await createServerClient();
  
  const params = await searchParams;
  const isMembership = params.type === 'membership';

  if (isMembership) {
    const [
      { data: member },
      { data: plans },
      { data: activeMembership },
      { data: activeApp },
      { data: settings }
    ] = await Promise.all([
      db.from('members').select('*').eq('id', actor.memberId).single(),
      db.from('membership_plans').select('*').eq('is_active', true).order('price_idr', { ascending: false }),
      db.from('memberships').select('id, status').eq('member_id', actor.memberId!).eq('status', 'ACTIVE').maybeSingle(),
      db.from('membership_applications').select('id, human_id, status, final_price_idr, created_at, rejection_reason, membership_plans(name)').eq('member_id', actor.memberId!).in('status', ['PENDING_REVIEW', 'APPROVED', 'PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED']).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('system_settings').select('key, value').in('key', ['payment_bank_name', 'payment_account_number', 'payment_account_name'])
    ]);

    const getSetting = (k: string) => {
      const s = settings?.find((x: any) => x.key === k);
      return s?.value ? String(s.value).replace(/^"|"$/g, '') : '';
    };

    const bankName = getSetting('payment_bank_name') || 'BCA';
    const accountNumber = getSetting('payment_account_number') || '1490011867027';
    const accountName = getSetting('payment_account_name') || 'PT BERKAH BERKUDA SEJAHTERA';

    return (
      <MembershipWizard
        initialData={member || {}}
        plans={plans || []}
        isRenewal={Boolean(activeMembership)}
        activeApp={activeApp as any || null}
        bankName={bankName}
        accountNumber={accountNumber}
        accountName={accountName}
      />
    );
  }

  const type = params.type === 'joyride' ? 'JOY_RIDE' : 'CASUAL_RIDE';

  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  await ensureSlotsForDateRange(today.toISOString().split('T')[0], nextWeek.toISOString().split('T')[0]);

  const [
    { data: member },
    { data: plans },
    { data: slots }
  ] = await Promise.all([
    db.from('members').select('*').eq('id', actor.memberId).single(),
    db.from('membership_plans').select('*').eq('is_active', true).order('price_idr', { ascending: false }),
    db.from('session_slots').select('*').gte('slot_date', today.toISOString().split('T')[0]).order('slot_date').order('start_time')
  ]);

  return (
    <RequestForm 
      initialData={member || {}} 
      plans={plans || []} 
      slots={slots || []} 
      initialMode={type}
    />
  );
}

