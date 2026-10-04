'use server';

import { revalidatePath } from 'next/cache';
import { MembershipService } from '@/modules/memberships/membership-service';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { toClientError } from '@/domain/shared/errors';

export type ActionResult = { ok: true; id?: string } | { ok: false; code: string; message: string };

export async function submitMembershipApplication(planId: string, formData?: FormData): Promise<void> {
  const actor = await requireActor(['MEMBER'], true);
  const db = await createServerClient();
  const service = new MembershipService(db as never);
  await service.submitApplication(actor, { planId });
  revalidatePath('/membership');
  revalidatePath('/home');
}
