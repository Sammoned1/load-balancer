FROM node:18-alpine

WORKDIR /usr/src/app

RUN apk --no-cache add curl

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

COPY . .

RUN addgroup -g 1001 -S nodejs
RUN adduser -S appuser -u 1001

RUN chown -R appuser:nodejs /usr/src/app
USER appuser

EXPOSE 8080

CMD ["npm", "run", "dev"]