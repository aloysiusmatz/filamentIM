# Stage 1: Build aplikasi React
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .

# Tangkap variabel API dari docker-compose saat proses build
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

# Jalankan build agar nilai URL tertanam ke dalam file HTML/JS
RUN npm run build

# Stage 2: Serve aplikasi menggunakan Nginx
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html

# Buat konfigurasi routing Nginx secara inline agar halaman tidak "Not Found" saat di-refresh
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]