const fs = require('fs');
let sql = fs.readFileSync('supabase/migrations/0026_fix_notification_channel.sql', 'utf8');

// Replace the column list
sql = sql.replace(/insert into notification_outbox \(event_type, aggregate_id, recipient_user_id, channel, payload\)/g, 
  "insert into notification_outbox (event_type, aggregate_type, aggregate_id, recipient_user_id, channel, payload)");

// Replace BOOKING_CONFIRMED owner
sql = sql.replace(
  /values \('BOOKING_CONFIRMED', v_history_id, v_booking\.created_by, 'FCM'/g,
  "values ('BOOKING_CONFIRMED', 'booking', p_booking_id, v_booking.created_by, 'FCM'"
);

// Replace BOOKING_CONFIRMED member
sql = sql.replace(
  /select 'BOOKING_CONFIRMED', v_history_id, m\.user_id, 'FCM'/g,
  "select 'BOOKING_CONFIRMED', 'booking', p_booking_id, m.user_id, 'FCM'"
);

// Replace BOOKING_REJECTED owner
sql = sql.replace(
  /values \('BOOKING_REJECTED', v_history_id, v_booking\.created_by, 'FCM'/g,
  "values ('BOOKING_REJECTED', 'booking', p_booking_id, v_booking.created_by, 'FCM'"
);

// Replace BOOKING_BBS_CANCELLED owner
sql = sql.replace(
  /values \('BOOKING_BBS_CANCELLED', v_history_id, v_booking\.created_by, 'FCM'/g,
  "values ('BOOKING_BBS_CANCELLED', 'booking', p_booking_id, v_booking.created_by, 'FCM'"
);

// Replace BOOKING_BBS_CANCELLED member
sql = sql.replace(
  /select 'BOOKING_BBS_CANCELLED', v_history_id, m\.user_id, 'FCM'/g,
  "select 'BOOKING_BBS_CANCELLED', 'booking', p_booking_id, m.user_id, 'FCM'"
);

// Replace RESCHEDULE_APPROVED owner
sql = sql.replace(
  /values \('RESCHEDULE_APPROVED', v_history_id, v_booking\.created_by, 'FCM'/g,
  "values ('RESCHEDULE_APPROVED', 'booking', p_booking_id, v_booking.created_by, 'FCM'"
);

// Replace RESCHEDULE_APPROVED member
sql = sql.replace(
  /select 'RESCHEDULE_APPROVED', v_history_id, m\.user_id, 'FCM'/g,
  "select 'RESCHEDULE_APPROVED', 'booking', p_booking_id, m.user_id, 'FCM'"
);

// Replace RESCHEDULE_REJECTED owner
sql = sql.replace(
  /values \('RESCHEDULE_REJECTED', v_history_id, v_booking\.created_by, 'FCM'/g,
  "values ('RESCHEDULE_REJECTED', 'booking', p_booking_id, v_booking.created_by, 'FCM'"
);

// Replace MEMBERSHIP_ACTIVATED (activate_membership)
sql = sql.replace(
  /values \('MEMBERSHIP_ACTIVATED', v_new_membership_id, v_user_id, 'FCM'/g,
  "values ('MEMBERSHIP_ACTIVATED', 'membership', v_new_membership_id, v_user_id, 'FCM'"
);

// Replace MEMBERSHIP_ACTIVATED (activate_pending_memberships)
sql = sql.replace(
  /values \('MEMBERSHIP_ACTIVATED', m\.id, v_user_id, 'FCM'/g,
  "values ('MEMBERSHIP_ACTIVATED', 'membership', m.id, v_user_id, 'FCM'"
);

// Replace MEMBERSHIP_APPLICATION_* (trigger)
sql = sql.replace(
  /values \(v_event_type, NEW\.id, v_user_id, 'FCM'/g,
  "values (v_event_type, 'membership_application', NEW.id, v_user_id, 'FCM'"
);

// Header fix
sql = sql.replace(
  /-- 0026_fix_notification_channel\.sql\n-- Fix PWA_PUSH to FCM for notification channels\./g,
  "-- 0027_fix_notification_aggregate.sql\n-- Correct aggregate_type and aggregate_id mapping for all notification events."
);

fs.writeFileSync('supabase/migrations/0027_fix_notification_aggregate.sql', sql);
console.log("Migration 0027 generated successfully.");
