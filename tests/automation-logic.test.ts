import { describe, it, expect, beforeEach } from 'vitest';

// Simulate DB State
type MembershipStatus = 'ACTIVE' | 'EXPIRED' | 'PENDING_ACTIVATION';
type BookingStatus = 'PENDING' | 'CONFIRMED' | 'EXPIRED';

interface MockMembership {
  id: string;
  memberId: string;
  status: MembershipStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  availableCredits: number;
}

interface MockBooking {
  id: string;
  status: BookingStatus;
  pendingExpiresAt: Date;
}

class AutomationSimulator {
  memberships: MockMembership[] = [];
  bookings: MockBooking[] = [];
  expirationsCount = 0;

  constructor(private today: string, private now: Date) {}

  expireMemberships() {
    let expired = 0;
    for (const m of this.memberships) {
      if (m.status === 'ACTIVE' && m.endDate < this.today) {
        if (m.availableCredits > 0) {
          this.expirationsCount++;
          m.availableCredits = 0;
        }
        m.status = 'EXPIRED';
        expired++;
      }
    }
    return expired;
  }

  activatePendingMemberships() {
    let activated = 0;
    let skipped = 0;
    for (const m of this.memberships) {
      if (m.status === 'PENDING_ACTIVATION' && m.startDate <= this.today) {
        // Invariant: Must not activate if ACTIVE exists
        const hasActive = this.memberships.some(x => x.memberId === m.memberId && x.status === 'ACTIVE');
        if (!hasActive) {
          m.status = 'ACTIVE';
          activated++;
        } else {
          skipped++;
        }
      }
    }
    return { activated, skipped };
  }

  dailyMaintenance() {
    const expired = this.expireMemberships();
    const result = this.activatePendingMemberships();
    return {
      expired,
      activated: result.activated,
      skipped: result.skipped
    };
  }

  expirePendingBookings() {
    for (const b of this.bookings) {
      if (b.status === 'PENDING' && b.pendingExpiresAt < this.now) {
        b.status = 'EXPIRED';
      }
    }
  }
}

describe('O4 Lifecycle Automation Logic', () => {
  let sim: AutomationSimulator;
  
  beforeEach(() => {
    sim = new AutomationSimulator('2026-09-17', new Date('2026-09-17T15:00:00Z'));
  });

  describe('Membership Expiration', () => {
    it('ACTIVE end_date = today -> remains ACTIVE', () => {
      sim.memberships.push({ id: '1', memberId: 'm1', status: 'ACTIVE', startDate: '2026-08-17', endDate: '2026-09-17', availableCredits: 5 });
      sim.dailyMaintenance();
      expect(sim.memberships[0].status).toBe('ACTIVE');
      expect(sim.expirationsCount).toBe(0);
    });

    it('ACTIVE end_date = yesterday -> EXPIRED with exactly one EXPIRATION ledger', () => {
      sim.memberships.push({ id: '1', memberId: 'm1', status: 'ACTIVE', startDate: '2026-08-16', endDate: '2026-09-16', availableCredits: 5 });
      sim.dailyMaintenance();
      expect(sim.memberships[0].status).toBe('EXPIRED');
      expect(sim.expirationsCount).toBe(1);
    });

    it('EXPIRED -> second run does nothing', () => {
      sim.memberships.push({ id: '1', memberId: 'm1', status: 'EXPIRED', startDate: '2026-08-16', endDate: '2026-09-16', availableCredits: 0 });
      sim.dailyMaintenance();
      expect(sim.memberships[0].status).toBe('EXPIRED');
      expect(sim.expirationsCount).toBe(0); // already 0 credits, no new expiration
    });

    it('available credits = 0 -> no EXPIRATION ledger needed', () => {
      sim.memberships.push({ id: '1', memberId: 'm1', status: 'ACTIVE', startDate: '2026-08-16', endDate: '2026-09-16', availableCredits: 0 });
      sim.dailyMaintenance();
      expect(sim.memberships[0].status).toBe('EXPIRED');
      expect(sim.expirationsCount).toBe(0); // No credits to void
    });
  });

  describe('Pending Activation', () => {
    it('PENDING_ACTIVATION start_date = tomorrow -> remains pending', () => {
      sim.memberships.push({ id: '1', memberId: 'm1', status: 'PENDING_ACTIVATION', startDate: '2026-09-18', endDate: '2026-10-18', availableCredits: 10 });
      sim.dailyMaintenance();
      expect(sim.memberships[0].status).toBe('PENDING_ACTIVATION');
    });

    it('PENDING_ACTIVATION start_date = today -> ACTIVE', () => {
      sim.memberships.push({ id: '1', memberId: 'm1', status: 'PENDING_ACTIVATION', startDate: '2026-09-17', endDate: '2026-10-17', availableCredits: 10 });
      sim.dailyMaintenance();
      expect(sim.memberships[0].status).toBe('ACTIVE');
    });

    it('PENDING_ACTIVATION start_date = yesterday -> ACTIVE', () => {
      sim.memberships.push({ id: '1', memberId: 'm1', status: 'PENDING_ACTIVATION', startDate: '2026-09-16', endDate: '2026-10-16', availableCredits: 10 });
      sim.dailyMaintenance();
      expect(sim.memberships[0].status).toBe('ACTIVE');
    });

    it('already ACTIVE member exists -> must not create overlapping ACTIVE', () => {
      sim.memberships.push({ id: '1', memberId: 'm1', status: 'ACTIVE', startDate: '2026-08-17', endDate: '2026-09-17', availableCredits: 5 }); // Ends today, so stays ACTIVE
      sim.memberships.push({ id: '2', memberId: 'm1', status: 'PENDING_ACTIVATION', startDate: '2026-09-17', endDate: '2026-10-17', availableCredits: 10 });
      
      const result = sim.dailyMaintenance();
      
      expect(sim.memberships[0].status).toBe('ACTIVE');
      expect(sim.memberships[1].status).toBe('PENDING_ACTIVATION'); // Protected by invariant!
      expect(result.skipped).toBe(1);
      expect(result.activated).toBe(0);
    });
  });

  describe('Sequential Maintenance', () => {
    it('old ACTIVE ends yesterday + renewal PENDING_ACTIVATION -> exactly one ACTIVE', () => {
      sim.memberships.push({ id: '1', memberId: 'm1', status: 'ACTIVE', startDate: '2026-08-16', endDate: '2026-09-16', availableCredits: 5 }); 
      sim.memberships.push({ id: '2', memberId: 'm1', status: 'PENDING_ACTIVATION', startDate: '2026-09-17', endDate: '2026-10-17', availableCredits: 10 });
      
      const result = sim.dailyMaintenance();
      
      expect(sim.memberships[0].status).toBe('EXPIRED');
      expect(sim.memberships[1].status).toBe('ACTIVE');
      expect(sim.memberships.filter(m => m.status === 'ACTIVE').length).toBe(1);
      expect(result.expired).toBe(1);
      expect(result.activated).toBe(1);
      expect(result.skipped).toBe(0);
    });
  });

  describe('Idempotency', () => {
    it('daily_maintenance() called multiple times -> same final state', () => {
      sim.memberships.push({ id: '1', memberId: 'm1', status: 'ACTIVE', startDate: '2026-08-16', endDate: '2026-09-16', availableCredits: 5 }); 
      sim.memberships.push({ id: '2', memberId: 'm1', status: 'PENDING_ACTIVATION', startDate: '2026-09-17', endDate: '2026-10-17', availableCredits: 10 });
      
      sim.dailyMaintenance();
      sim.dailyMaintenance();
      sim.dailyMaintenance();
      
      expect(sim.memberships[0].status).toBe('EXPIRED');
      expect(sim.memberships[1].status).toBe('ACTIVE');
      expect(sim.expirationsCount).toBe(1); // Never duplicates ledger deduction!
    });
  });

  describe('Booking Expiration', () => {
    it('PENDING expired -> EXPIRED', () => {
      sim.bookings.push({ id: 'b1', status: 'PENDING', pendingExpiresAt: new Date('2026-09-17T14:00:00Z') }); // Past
      sim.expirePendingBookings();
      expect(sim.bookings[0].status).toBe('EXPIRED');
    });

    it('PENDING not expired -> unchanged', () => {
      sim.bookings.push({ id: 'b2', status: 'PENDING', pendingExpiresAt: new Date('2026-09-17T16:00:00Z') }); // Future
      sim.expirePendingBookings();
      expect(sim.bookings[0].status).toBe('PENDING');
    });

    it('EXPIRED -> unchanged', () => {
      sim.bookings.push({ id: 'b3', status: 'EXPIRED', pendingExpiresAt: new Date('2026-09-17T14:00:00Z') }); 
      sim.expirePendingBookings();
      expect(sim.bookings[0].status).toBe('EXPIRED');
    });
  });
});
