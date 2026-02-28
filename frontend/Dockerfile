# Stage 1: Build React
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock* ./
RUN yarn install
COPY . .
ENV REACT_APP_BACKEND_URL=""
RUN yarn build

# Stage 2: Serve dengan Nginx
FROM nginx:alpine
# Copy hasil build dari stage 1 ke folder standar Nginx
COPY --from=builder /app/build /usr/share/nginx/html

# Opsional: Copy config nginx jika kamu punya (nginx.conf)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
