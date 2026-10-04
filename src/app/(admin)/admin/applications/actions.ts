'use server';

import { revalidatePath } from 'next/cache';
import { MembershipService } from '@/modules/memberships/membership-service';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { toClientError } from '@/domain/shared/errors';

export type ActionResult = { ok: true } | { ok: false; code: string; message: string };

export async function approveApplicationAction(applicationId: string, formData?: FormData): Promise<void> {
  const actor = await requireActor(['ADMIN'], true);
  const db = await createServerClient();
  const service = new MembershipService(db as never);
  await service.approveApplication(actor, applicationId);
  revalidatePath('/admin/applications');
}

export async function confirmPaymentAction(applicationId: string, formData?: FormData): Promise<void> {
  const actor = await requireActor(['ADMIN'], true);
  const db = await createServerClient();
  const service = new MembershipService(db as never);
  await service.confirmPayment(actor, applicationId);
  revalidatePath('/admin/applications');
}

export async function activateMembershipAction(applicationId: string, formData?: FormData): Promise<void> {
  const actor = await requireActor(['ADMIN'], true);
  const db = await createServerClient();
  const service = new MembershipService(db as never);
  await service.activateMembership(actor, applicationId);
  revalidatePath('/admin/applications');
}

export async function rejectApplicationAction(applicationId: string, formData?: FormData): Promise<void> {
  const actor = await requireActor(['ADMIN'], true);
  const db = await createServerClient();
  const service = new MembershipService(db as never);
  await service.rejectApplication(actor, applicationId);
  revalidatePath('/admin/applications');
}
