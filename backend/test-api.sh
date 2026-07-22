#!/bin/bash
echo "=== Registering User ==="
REGISTER_RES=$(curl -s -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}')
echo $REGISTER_RES

echo -e "\n=== Logging In ==="
LOGIN_RES=$(curl -s -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}')
echo $LOGIN_RES

REFRESH_TOKEN=$(echo $LOGIN_RES | grep -o '"refreshToken":"[^"]*' | cut -d'"' -f4)

echo -e "\n=== Refreshing Token ==="
if [ -z "$REFRESH_TOKEN" ]; then
  echo "Failed to get refresh token."
else
  REFRESH_RES=$(curl -s -X POST http://localhost:5000/auth/refresh \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}")
  echo $REFRESH_RES

  NEW_REFRESH_TOKEN=$(echo $REFRESH_RES | grep -o '"refreshToken":"[^"]*' | cut -d'"' -f4)

  echo -e "\n=== Logging Out ==="
  LOGOUT_RES=$(curl -s -X POST http://localhost:5000/auth/logout \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\": \"$NEW_REFRESH_TOKEN\"}")
  echo $LOGOUT_RES
fi
