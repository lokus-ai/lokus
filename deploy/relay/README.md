# The hosted relay

One small VM in Google Cloud project `lokus-relay` (us-central1-a), reached at
`https://relay.lokusmd.com` (and, from before it had a name, `https://136-115-217-146.sslip.io`). Caddy gets the certificate and passes traffic to the relay;
the data file lives on its own disk (`relay-data`), which survives the VM being deleted.

Ship a new relay (needs the owner's go-ahead), from the repo root:

    sh deploy/relay/ship.sh        # build, restart on the new build, check it answers
    sh deploy/relay/ship.sh key    # once: give the relay a publish key and print it

The publish key lets `lokus release` and `lokus news` publish to every copy of the app
(`docs/releasing.md`). It is kept in `/mnt/disks/data/relay/relay.env` on the data disk, which
the relay reads when it starts; it is in neither this repo nor the VM's metadata.

`cloud-init.yaml` is what the VM was created with (`--metadata-from-file=user-data=`). When a
real domain replaces the sslip.io name, change it in the Caddy line there and in
`VITE_LOKUS_RELAY`.

Backups: the data disk is snapshotted every day at 09:00 UTC (schedule `relay-daily`), and each
snapshot is kept for 14 days. To go back to one, create a disk from the snapshot and attach it
to the VM as `relay-data`.

The relay's database gains tables on its own when a newer build starts (`ingest_keys`, `inbox`, `app_releases`, `app_news`);
nothing needs to be moved.
