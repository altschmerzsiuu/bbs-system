import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient as createSSRClient } from '@supabase/ssr';
import { createServiceRoleClient } from '@/infrastructure/supabase-server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/home';

  console.log('[auth/callback] Triggered with code:', code ? 'present' : 'missing', 'next:', next);

  if (code) {
    const cookieStore = await cookies();
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createSSRClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (list) => {
            list.forEach(({ name, value, options }) => {
              try {
                cookieStore.set(name, value, options);
              } catch (e) {
                console.error('[auth/callback] cookieStore.set error:', e);
              }
              try {
                response.cookies.set(name, value, options);
              } catch (e) {
                console.error('[auth/callback] response.cookies.set error:', e);
              }
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[auth/callback] exchangeCodeForSession error:', error.message, error);
      return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
    }

    if (data.user) {
      console.log('[auth/callback] User authenticated successfully:', data.user.id, data.user.email);
      let targetRedirect = next;

      try {
        const adminDb = createServiceRoleClient();

        // 1. Pastikan row di public.users ada dengan default role 'MEMBER'
        const { data: userProfile, error: selectUserErr } = await adminDb
          .from('users')
          .select('id, role')
          .eq('id', data.user.id)
          .maybeSingle();

        if (selectUserErr) {
          console.error('[auth/callback] Error checking user profile:', selectUserErr);
        }

        let role = userProfile?.role ?? 'MEMBER';

        if (!userProfile) {
          console.log('[auth/callback] Auto-provisioning user in public.users...');
          const { data: newUser, error: insertUserErr } = await adminDb.from('users').insert({
            id: data.user.id,
            email: data.user.email ?? '',
            full_name: data.user.user_metadata?.full_name ?? data.user.email?.split('@')[0] ?? 'Member',
            avatar_url: data.user.user_metadata?.avatar_url ?? null,
            role: 'MEMBER',
            is_active: true,
          }).select('role').single();

          if (insertUserErr) {
            console.error('[auth/callback] Error auto-provisioning user:', insertUserErr);
          } else if (newUser) {
            role = newUser.role;
          }
        }

        // Jika `next` tidak dispesifikasikan (atau bernilai default '/home'), tentukan rute berdasarkan role
        if (!searchParams.has('next') || searchParams.get('next') === '/home') {
          if (role === 'ADMIN') targetRedirect = '/admin';
          else if (role === 'GROOMER') targetRedirect = '/groomer';
          else targetRedirect = '/home';
        }

        // 2. Pastikan row di public.members ada (ACCOUNT != MEMBERSHIP) jika role MEMBER
        const { data: memberProfile, error: selectMemberErr } = await adminDb
          .from('members')
          .select('id')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (selectMemberErr) {
          console.error('[auth/callback] Error checking member profile:', selectMemberErr);
        }

        if (!memberProfile && role === 'MEMBER') {
          console.log('[auth/callback] Auto-provisioning member in public.members...');
          const { error: insertMemberErr } = await adminDb.from('members').insert({
            user_id: data.user.id,
            full_name: data.user.user_metadata?.full_name ?? data.user.email?.split('@')[0] ?? 'Member',
            phone: data.user.user_metadata?.phone ?? '-',
          });
          if (insertMemberErr) {
            console.error('[auth/callback] Error auto-provisioning member:', insertMemberErr);
          }
        }
      } catch (provisionErr) {
        console.error('[auth/callback] Auto-provisioning exception:', provisionErr);
      }

      console.log('[auth/callback] Redirecting to:', `${origin}${targetRedirect}`);
      const redirectResponse = NextResponse.redirect(`${origin}${targetRedirect}`);
      
      // Copy cookies to the actual response object being returned
      response.cookies.getAll().forEach(cookie => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });

      return redirectResponse;
    }
  }

  // Jika gagal, redirect ke login lagi
  console.log('[auth/callback] Failed code or user missing, redirecting to login');
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
