#!/bin/bash
HOST="pagemdemr.com"
USER="ubuntu"
INPUT_KEY_PATH="$1"

if [ -z "$INPUT_KEY_PATH" ]; then
  exit 1
fi

cp "$INPUT_KEY_PATH" /tmp/deploy_key_test_end
chmod 600 /tmp/deploy_key_test_end
KEY_PATH="/tmp/deploy_key_test_end"

ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no $USER@$HOST << EOF
  # Get Token
  TOKEN=\$(curl -s -X POST http://localhost:3000/api/platform-auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@pagemd.com", "password":"PageMD2024!Admin"}' | jq -r .token)

  echo "Testing GET Clinic Details..."
  curl -v http://localhost:3000/api/super/clinics/ab35d395-517c-4db3-9c0b-7519c710d7a8 \
    -H "X-Platform-Token: \$TOKEN"

  echo -e "\n\nTesting POST Onboard..."
  curl -v -X POST http://localhost:3000/api/super/clinics/onboard \
    -H "Content-Type: application/json" \
    -H "X-Platform-Token: \$TOKEN" \
    -d '{
      "clinic": {
         "displayName": "Auto Test Clinic",
         "slug": "auto-test-clinic-'$(date +%s)'",
         "specialty": "Family Practice"
      },
      "dbConfig": {
         "dbName": "emr_auto_test_'$(date +%s)'"
      },
      "adminUser": {
         "email": "autotest'$(date +%s)'@example.com",
         "password": "Password123!",
         "firstName": "Test",
         "lastName": "Admin"
      }
    }'

  echo -e "\n\n📜 NEW API LOGS:"
  docker logs emr-api --tail 30
EOF

rm /tmp/deploy_key_test_end
