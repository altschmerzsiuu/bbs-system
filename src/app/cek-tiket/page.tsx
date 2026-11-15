import { redirect } from 'next/navigation';

export default function CekTiketDirectPage() {
  redirect('/ride?tab=check');
}
