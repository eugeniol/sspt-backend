FROM node:12.16.3-alpine AS build
WORKDIR /app

RUN apk --update add git less openssh && \
  rm -rf /var/lib/apt/lists/* && \
  rm /var/cache/apk/*

COPY package.json .
COPY package-lock.json .

RUN npm ci --prefer-offline --no-audit
CMD node src
EXPOSE 3031
