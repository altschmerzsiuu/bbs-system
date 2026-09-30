// export type BookingStatus =
//   | 'PENDING'
//   | 'CONFIRMED'
//   | 'REJECTED'
//   | 'EXPIRED'
//   | 'COMPLETED'
//   | 'MEMBER_CANCELLED'
//   | 'BBS_CANCELLED'
//   | 'RESCHEDULE_REQUESTED'
//   | 'NO_SHOW';

export type BookingStatus =
    | 'PENDING'
    | 'CONFIRMED'
    | 'CANCELLED'
    | 'NO_SHOW'
    | 'COMPLETED'
    | 'RESCHEDULE_REQUESTED';

export type MemberHomeState =
    | 'NO_MEMBERSHIP'
    | 'APPLICATION_PENDING'
    | 'PAYMENT_PENDING'
    | 'ACTIVATION_PENDING'
    | 'ACTIVE'
    | 'ACTIVE_NO_CREDITS'
    | 'EXPIRED'
    | 'ACTIVE_WITH_RENEWAL';

export interface MemberHomeViewModel {
    state: MemberHomeState;
    memberName: string;

    membership?: {
        plan: string;
        allocated: number;
        used: number;
        available: number;
        endDate: string;
    } | null;

    application?: {
        id: string;
        status: string;
        type: string;
        planName: string;
        finalPrice: number;
    } | null;

    nextBooking?: {
        id: string;
        date: string;
        startTime: string;
        endTime: string;
        status: BookingStatus;
        sharedWith: string[];
    } | null;

    upcomingCount: number;
    unreadNotifications: number;
    recentRides?: {
        id: string;
        date: string;
        horseName: string | null;
    }[];

    pendingRideRequest?: {
        id: string;
        type: string;
        status: string;
        preferredDate: string | null;
        preferredTime: string | null;
    } | null;
}

export interface AdminScheduleParticipant {
    id: string;
    type: 'MEMBER' | 'CASUAL';
    name: string;
    avatarUrl: string | null;
    memberId: string | null;
    membershipId: string | null;
    casualCustomerId: string | null;
}

export interface AdminScheduleBooking {
    id: string;
    status: BookingStatus;
    notes: string | null;
    participants: AdminScheduleParticipant[];
}

export interface AdminScheduleSlot {
    id: string | null;
    date: string;
    startTime: string;
    endTime: string;
    block: string;
    capacity: number;
    isOpen: boolean;
    closedReason: string | null;
    slotExists: boolean;
    booking: AdminScheduleBooking | null;
    pendingRequests?: {
        id: string;
        memberName: string;
        type: string;
        status: string;
    }[];
}

export interface AdminSessionDetailParticipant {
    id: string;
    type: 'MEMBER' | 'CASUAL';
    name: string;
    avatarUrl: string | null;
    memberId: string | null;
    membershipId: string | null;
    casualCustomerId: string | null;

    participantStatus: BookingStatus;
    requestedSlotId: string | null;
    cancellationReason: string | null;
    cancelledAt: string | null;

    attendanceStatus:
    | 'NOT_CHECKED_IN'
    | 'ATTENDED'
    | 'NO_SHOW'
    | 'CANCELLED';
    checkedInAt: string | null;
    checkedInBy: string | null;
    checkInMethod: 'MEMBER' | 'ADMIN' | null;
    horseId?: string | null;
    horseName?: string | null;

    priceIdr: number | null;

    horse: {
        id: string;
        name: string;
        status: string;
    } | null;
}

export interface AdminSessionDetailBooking {
    id: string;
    status: BookingStatus;
    notes: string | null;
    createdAt: string;
    createdBy: string | null;

    isCasual: boolean;

    cancellationReason: string | null;
    cancelledAt: string | null;

    participants: AdminSessionDetailParticipant[];
}

export interface AdminSessionDetail {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    block: string;

    capacity: number;
    isOpen: boolean;
    closedReason: string | null;

    bookings: AdminSessionDetailBooking[];
    pendingRequests?: {
        id: string;
        memberId: string;
        memberName: string;
        memberPhone: string;
        type: string;
        status: string;
    }[];
}