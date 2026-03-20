#!/bin/sh

echo "⏳ Waiting for database..."

until nc -z postgres 5432; do
  sleep 1
done

echo "✅ Database is up!"

npx prisma migrate deploy

echo "🚀 Starting app..."

node dist/src/main.js


#RUN chmod +x start.sh
#CMD ["sh", "start.sh"]