export const dynamic = 'force-dynamic';

import React from 'react';
import { requireActor } from '@/lib/auth';
import { ScannerClient } from './scanner-client';

export default async function CheckinScannerPage() {
  const actor = await requireActor(['ADMIN', 'GROOMER']);
  return <ScannerClient actorRole={actor.role} />;
}
