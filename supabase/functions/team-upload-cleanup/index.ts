const BUCKET = 'team-note-revisions';
const BATCH_SIZE = 100;
const MAX_BATCHES = 10;

type DeletionClaim = {
  queue_id: string;
  object_key: string;
  claim_token: string;
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return response(405, { error: 'method_not_allowed' });
  }

  const expectedToken = Deno.env.get('TEAM_UPLOAD_CLEANUP_TOKEN') ?? '';
  const suppliedToken = request.headers.get('x-lokus-cleanup-token') ?? '';
  if (!expectedToken || !constantTimeEqual(expectedToken, suppliedToken)) {
    return response(401, { error: 'unauthorized' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const secretKey = getSupabaseSecretKey();
  if (!supabaseUrl || !secretKey) {
    console.error('[team-upload-cleanup] required project secrets are unavailable');
    return response(500, { error: 'configuration_error' });
  }

  let processedCount = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    let claims: DeletionClaim[];
    try {
      claims = await callRpc(
        supabaseUrl,
        secretKey,
        'claim_team_revision_deletions',
        {
          p_limit: BATCH_SIZE,
          p_lease_seconds: 120,
        },
      ) as DeletionClaim[];
    } catch (error) {
      console.error('[team-upload-cleanup] claim failed', safeError(error));
      return response(500, { error: 'claim_failed', processed: processedCount });
    }
    if (!claims?.length) break;

    const objectKeys = claims.map(({ object_key }) => object_key);
    try {
      await removeStorageObjects(supabaseUrl, secretKey, objectKeys);
    } catch (error) {
      console.error(
        '[team-upload-cleanup] Storage API deletion failed',
        safeError(error),
      );
      return response(500, {
        error: 'storage_delete_failed',
        processed: processedCount,
      });
    }

    const claimToken = claims[0].claim_token;
    const queueIds = claims.map(({ queue_id }) => queue_id);
    let acknowledged;
    try {
      acknowledged = await callRpc(
        supabaseUrl,
        secretKey,
        'complete_team_revision_deletions',
        {
          p_claim_token: claimToken,
          p_queue_ids: queueIds,
        },
      );
    } catch (error) {
      console.error(
        '[team-upload-cleanup] acknowledgement failed',
        safeError(error),
      );
      return response(500, {
        error: 'acknowledge_failed',
        processed: processedCount,
      });
    }
    processedCount += Number(acknowledged ?? queueIds.length);
    if (claims.length < BATCH_SIZE) break;
  }

  return response(200, { processed: processedCount });
});

async function callRpc(
  supabaseUrl: string,
  secretKey: string,
  name: string,
  parameters: Record<string, unknown>,
) {
  return apiRequest(
    `${supabaseUrl}/rest/v1/rpc/${encodeURIComponent(name)}`,
    secretKey,
    {
      method: 'POST',
      headers: {
        'content-profile': 'public',
        accept: 'application/json',
      },
      body: JSON.stringify(parameters),
    },
  );
}

async function removeStorageObjects(
  supabaseUrl: string,
  secretKey: string,
  objectKeys: string[],
) {
  return apiRequest(
    `${supabaseUrl}/storage/v1/object/${encodeURIComponent(BUCKET)}`,
    secretKey,
    {
      method: 'DELETE',
      body: JSON.stringify({ prefixes: objectKeys }),
    },
  );
}

async function apiRequest(
  url: string,
  secretKey: string,
  init: RequestInit,
) {
  const result = await fetch(url, {
    ...init,
    headers: {
      apikey: secretKey,
      ...(isLegacyJwt(secretKey)
        ? { authorization: `Bearer ${secretKey}` }
        : {}),
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  const text = await result.text();
  if (!result.ok) {
    let message = text;
    let code = null;
    try {
      const body = JSON.parse(text);
      message = body.message ?? body.error ?? text;
      code = body.code ?? null;
    } catch {
      // Keep the bounded raw response when the service did not return JSON.
    }
    throw {
      code,
      statusCode: result.status,
      message: String(message).slice(0, 240),
    };
  }
  return text ? JSON.parse(text) : null;
}

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

function safeError(error: unknown) {
  const details = error && typeof error === 'object'
    ? error as Record<string, unknown>
    : {};
  return {
    code: details.code ?? null,
    status: details.statusCode ?? null,
    message: String(details.message ?? 'unknown error').slice(0, 240),
  };
}

function getSupabaseSecretKey() {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacyKey) return legacyKey;
  const encoded = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (encoded) {
    try {
      const keys = JSON.parse(encoded);
      if (typeof keys?.default === 'string' && keys.default) return keys.default;
    } catch {
      // Fall through for projects still using legacy JWT-based API keys.
    }
  }
  return '';
}

function isLegacyJwt(value: string) {
  return value.split('.').length === 3;
}
