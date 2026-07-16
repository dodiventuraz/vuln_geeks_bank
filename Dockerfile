FROM node:22-alpine

# ImageMagick is used for server-side avatar thumbnail generation
RUN apk add --no-cache imagemagick

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
