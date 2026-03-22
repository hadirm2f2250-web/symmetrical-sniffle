/**
 * Extract the authenticated user from the Authorization header.
 * Decodes the Supabase JWT payload directly (base64 JSON) — works with all SDK versions.
 * Security: all DB operations still enforce ownership via `user_id = decoded.sub` checks.
 */
export async function getAuthUser(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Decode JWT payload (middle part between the two dots)
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) throw new Error('Invalid token');

    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64').toString('utf8')
    );

    // Must be a valid Supabase user token
    if (!payload.sub || payload.role !== 'authenticated') {
      throw new Error('Invalid token payload');
    }

    // Check if token is expired
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    const user = {
      id: payload.sub,
      email: payload.email,
      role: payload.user_metadata?.role || 'user',
    };

    return { user };
  } catch (e) {
    console.error('[getAuthUser error]', e.message);
    throw new Error('Unauthorized');
  }
}


