FROM node:22-alpine
RUN npm i -g nodemon
WORKDIR /project/bairisbot
COPY ./bairisbot/package*.json ./
RUN npm install
COPY ./bairisbot/src/ ./src/
WORKDIR /project/telegramthread
COPY ./telegramthread/package*.json ./
RUN npm link
WORKDIR /project/bairisbot
RUN npm link telegramthread
WORKDIR /project
CMD ["nodemon", "--inspect=0.0.0.0:9229", "bairisbot/src/start.js"]