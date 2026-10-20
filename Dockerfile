FROM node:20-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 2. Production bosqichi (Nginx)
FROM nginx:stable-alpine as production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html

# YANGI QO'SHILGAN QATOR: Biz yozgan SPA konfiguratsiyasini Nginx ichiga nusxalash
COPY .nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]