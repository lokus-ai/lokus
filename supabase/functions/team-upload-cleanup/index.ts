import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'team-note-revisions';
const BATCH_SIZE = 100;
const MAX_BATCHES = 10;

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

  const client = createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  let processedCount = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const { data: claims, error: claimError } = await client.rpc(
      'claim_team_revision_deletions',
      {
        p_limit: BATCH_SIZE,
        p_lease_seconds: 120,
      },
    );
    if (claimError) {
      console.error('[team-upload-cleanup] claim failed', safeError(claimError));
      return response(500, { error: 'claim_failed', processed: processedCount });
    }
    if (!claims?.length) break;

    const objectKeys = claims.map(({ object_key }) => object_key);
    const { error: storageError } = await client.storage
      .from(BUCKET)
      .remove(objectKeys);
    if (storageError) {
      console.error(
        '[team-upload-cleanup] Storage API deletion failed',
        safeError(storageError),
      );
      return response(500, {
        error: 'storage_delete_failed',
        processed: processedCount,
      });
    }

    const claimToken = claims[0].claim_token;
    const queueIds = claims.map(({ queue_id }) => queue_id);
    const { data: acknowledged, error: acknowledgeError } = await client.rpc(
      'complete_team_revision_deletions',
      {
        p_claim_token: claimToken,
        p_queue_ids: queueIds,
      },
    );
    if (acknowledgeError) {
      console.error(
        '[team-upload-cleanup] acknowledgement failed',
        safeError(acknowledgeError),
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

function safeError(error: {
  code?: string;
  statusCode?: string | number;
  message?: string;
}) {
  return {
    code: error.code ?? null,
    status: error.statusCode ?? null,
    message: String(error.message ?? 'unknown error').slice(0, 240),
  };
}

function getSupabaseSecretKey() {
  const encoded = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (encoded) {
    try {
      const keys = JSON.parse(encoded);
      if (typeof keys?.default === 'string' && keys.default) return keys.default;
    } catch {
      // Fall through for projects still using legacy JWT-based API keys.
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}
