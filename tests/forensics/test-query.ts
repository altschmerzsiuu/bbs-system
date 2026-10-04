import { createClient } from '@supabase/supabase-js';

async function test() {
  const supabase = createClient('http://127.0.0.1:54321', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU');
  
  const { data: slot, error: slotError } = await supabase.from('session_slots').select('id').limit(1).single();
  if (slotError) { console.error('SLOT ERROR', slotError); return; }
  
  const { data, error } = await supabase
    .from('session_slots')
    .select(`
      id,
      bookings!bookings_slot_id_fkey (
        id,
        booking_participants (
          id,
          attendance_records (
            status
          )
        )
      )
    `)
    .eq('id', slot.id)
    .single();
    
    if (error) {
      console.error(error);
    } else {
      console.log('SUCCESS! DATA:', JSON.stringify(data, null, 2));
    }
}
test();
