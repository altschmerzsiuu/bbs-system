const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const userId = '530ff626-04a6-44be-bd49-ed661f493ee4';

  const { data, error } = await supabase
    .from('notifications')
    .insert([
      {
        user_id: userId,
        event_type: 'BOOKING',
        title: 'Booking Confirmed',
        body: 'Your riding session for tomorrow at 16:00 WITA has been confirmed by Admin.',
        delivery_status: 'SENT',
        read_at: null
      },
      {
        user_id: userId,
        event_type: 'SYSTEM',
        title: 'Membership Expiring',
        body: 'Your GOLD membership will expire in 7 days. Please renew to keep your benefits.',
        delivery_status: 'SENT',
        read_at: null
      },
      {
        user_id: userId,
        event_type: 'PROMO',
        title: 'Weekend Ride Promo',
        body: 'Get 10% off for any additional rides this weekend! Use code WKND10.',
        delivery_status: 'SENT',
        read_at: new Date().toISOString()
      }
    ]);

  if (error) {
    console.error('Error inserting notifications:', error);
  } else {
    console.log('Inserted notifications successfully.');
  }
}

run();
