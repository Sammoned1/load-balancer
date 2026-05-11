FROM node:20-alpine

WORKDIR /app

COPY virtual-user.js ./
COPY influxdb-metrics.js ./

CMD ["node", "virtual-user.js"]
