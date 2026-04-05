FROM node:22-alpine AS build

WORKDIR /app

# Copy workspace root configs
COPY ../../package.json ../../pnpm-workspace.yaml ../../pnpm-lock.yaml* ./
COPY ../../packages ./packages

# Copy frontend app
COPY . ./erp/frontend

WORKDIR /app/erp/frontend
RUN npm install
RUN npm run build

# Production stage — serve with nginx
FROM nginx:alpine

COPY --from=build /app/erp/frontend/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
