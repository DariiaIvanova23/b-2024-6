FROM node:18

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 8088
EXPOSE 9229

CMD ["npm", "run", "dev"]