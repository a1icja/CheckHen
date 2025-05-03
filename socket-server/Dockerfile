FROM node:18.20

WORKDIR /app
COPY package*.json ./
COPY yarn.lock ./
COPY .yarnrc.yml ./
COPY prisma/ ./

RUN corepack enable yarn && yarn --frozen-lockfile

RUN yarn prisma generate

COPY . .
CMD ["yarn", "dev"]