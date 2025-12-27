#!/bin/bash
HOST="bemypcp.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_inspect
chmod 600 /tmp/deploy_key_inspect
KEY_PATH="/tmp/deploy_key_inspect"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  docker start emr-api # Just in case
  echo "🔍 Getting DB Password..."
  # Extract password from DATABASE_URL in api container
  DB_URL=\$(docker exec emr-api sh -c 'echo \$DATABASE_URL')
  # Format postgresql://user:password@host:port/db
  # We use sed to extract content between first : and @
  # Actually, easier to let node parse it
  
  docker exec emr-api node -e '
    const url = process.env.DATABASE_URL;
    if (url) {
      const parsed = new URL(url);
      console.log("DB_PASSWORD_RAW:" + parsed.password);
      console.log("DB_PASSWORD_B64:" + Buffer.from(parsed.password).toString("base64"));
    } else {
      console.log("NO_DB_URL");
    }
  '
EOF

rm /tmp/deploy_key_inspect
