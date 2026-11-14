#!/bin/sh
# Ship the relay in this checkout to the hosted VM. Run from the repo root, by the owner.
#   sh deploy/relay/ship.sh            build, then restart the relay on the new build
#   sh deploy/relay/ship.sh restart    skip the build: fetch the image already built and restart
#   sh deploy/relay/ship.sh key        (once) give the relay a publish key and print it
# The publish key is what `lokus release` and `lokus news` present. It lives in a file on the
# relay's data disk and in your password manager, nowhere else.
set -e
PROJECT=lokus-relay
ZONE=us-central1-a
IMAGE=us-central1-docker.pkg.dev/lokus-relay/relay/lokus-relay:v1
ENV=/mnt/disks/data/relay/relay.env
on_vm() { gcloud compute ssh relay --project="$PROJECT" --zone="$ZONE" --command="$1"; }

if [ "$1" = "key" ]; then
  KEY=$(openssl rand -hex 32)
  on_vm "sudo sh -c 'touch $ENV && chmod 600 $ENV && grep -v ^LOKUS_PUBLISH_KEY= $ENV > $ENV.new; echo LOKUS_PUBLISH_KEY=$KEY >> $ENV.new && mv $ENV.new $ENV && chmod 600 $ENV' && sudo systemctl restart relay"
  echo "The publish key (save it in your password manager; it is not shown again):"
  echo "$KEY"
  exit 0
fi

[ "$1" = "restart" ] || gcloud builds submit --project="$PROJECT" --config=deploy/relay/cloudbuild.yaml .
# The unit on the VM was written before the relay read an env file; add that once.
on_vm "sudo sh -c 'touch $ENV && chmod 600 $ENV; U=/etc/systemd/system/relay.service; grep -q env-file \$U || sed -i \"s#-e SUPABASE_URL=#--env-file $ENV -e SUPABASE_URL=#\" \$U; systemctl daemon-reload' && sudo HOME=/var/lib/relay-home docker-credential-gcr configure-docker --registries us-central1-docker.pkg.dev && sudo HOME=/var/lib/relay-home docker pull $IMAGE && sudo systemctl restart relay && sleep 4 && curl -s -o /dev/null -w 'update check answers %{http_code} (204 = healthy, nothing published yet)\n' http://127.0.0.1:8787/v1/app/update/darwin/aarch64/2.0.0-alpha.0"
